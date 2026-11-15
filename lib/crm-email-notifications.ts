import { acquireWorkerLease, releaseWorkerLease } from "@/lib/database-worker-lease";
import postgres from "postgres";
import { syncRecentCrmReplies } from "@/lib/crm-email-inbox-sync";
import { shouldRunRuntimeSchemaMigrations } from "@/lib/runtime-schema";

// Events are persisted before delivery, so a provider outage is retried next run.
export async function processCrmEmailNotifications() {
  const url = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!url) throw new Error("Falta la conexión a la base de datos.");
  const origin = process.env.NEXTAUTH_URL || "https://barrerabrokers.com";
  const sql = postgres(url, { ssl: "require", max: 1, prepare: false });
  let sent = 0;
  let failed = 0;
  let imported = 0;
  try {
    if (shouldRunRuntimeSchemaMigrations()) await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS crm_email_alert_state (id TEXT PRIMARY KEY, enabled_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS crm_email_reply_checks (lead_id UUID PRIMARY KEY, checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS crm_email_alert_outbox (
        event_key TEXT PRIMARY KEY, agent_id UUID NOT NULL, lead_id UUID NOT NULL,
        subject TEXT NOT NULL, body TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        sent_at TIMESTAMPTZ, lease_until TIMESTAMPTZ, attempts INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS crm_notifications (
        id UUID PRIMARY KEY, recipient_agent_id UUID NULL REFERENCES agents(id) ON DELETE CASCADE,
        lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE, event_key TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '', href TEXT NOT NULL DEFAULT '',
        read_by UUID[] NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await sql`INSERT INTO crm_email_alert_state (id) VALUES ('primary') ON CONFLICT DO NOTHING`;
    // A single worker owns the poll and delivery pass, including overlapping cron requests.
    const lease = await acquireWorkerLease(sql,"email-notifications");
    if (!lease) return { sent, failed, imported, busy: true };
    try {
      const registerReplyNotifications=()=>sql`
        INSERT INTO crm_notifications(id,recipient_agent_id,lead_id,event_key,type,title,body,href,created_at)
        SELECT gen_random_uuid(),COALESCE(act.created_by,l.assigned_agent_id),l.id,'email-reply:'||act.external_id,'email_reply',
          CONCAT_WS(' ',NULLIF(BTRIM(CONCAT_WS(' ',l.first_name,l.last_name)),''),'respondió tu correo'),
          act.title,'/admin/crm/'||l.id||'?activity=correo',COALESCE(act.scheduled_at,act.created_at)
        FROM crm_activities act JOIN crm_leads l ON l.id=act.lead_id
        WHERE act.external_source='gmail_inbound' AND act.external_id IS NOT NULL
          AND act.scheduled_at >= (SELECT enabled_at FROM crm_email_alert_state WHERE id='primary')
          AND COALESCE(act.created_by,l.assigned_agent_id) IS NOT NULL
          AND act.title NOT IN ('Respuesta por correo: Tu cliente respondió un correo','Respuesta por correo: Tu cliente abrió un correo')
        ON CONFLICT(event_key) DO NOTHING`;
      await registerReplyNotifications();
      const replies=await syncRecentCrmReplies(sql,origin);
      imported+=replies.imported;failed+=replies.failed;
      await registerReplyNotifications();
      // Notify the first recorded opening once per email, not image-proxy reloads.
      await sql`
        INSERT INTO crm_email_alert_outbox (event_key, agent_id, lead_id, subject, body)
        SELECT 'open:' || t.id, COALESCE(t.agent_id, l.assigned_agent_id), l.id,
          'Tu cliente abrió un correo',
          concat_ws(E'\n', concat_ws(' ', l.first_name, l.last_name), 'Asunto: ' || COALESCE(t.subject, 'Sin asunto'))
        FROM crm_email_trackings t JOIN crm_leads l ON l.id = t.lead_id
        WHERE t.first_opened_at >= (SELECT enabled_at FROM crm_email_alert_state WHERE id = 'primary')
          AND COALESCE(t.agent_id, l.assigned_agent_id) IS NOT NULL
        ON CONFLICT DO NOTHING
      `;
      // Use the message date, not import time, to avoid alerts for historical Gmail imports.
      await sql`
        INSERT INTO crm_email_alert_outbox (event_key, agent_id, lead_id, subject, body)
        SELECT 'reply:' || act.external_id, COALESCE(act.created_by, l.assigned_agent_id), l.id,
          'Tu cliente respondió un correo',
          concat_ws(E'\n', concat_ws(' ', l.first_name, l.last_name), act.title)
        FROM crm_activities act JOIN crm_leads l ON l.id = act.lead_id
        WHERE act.external_source = 'gmail_inbound' AND act.external_id IS NOT NULL
          AND BTRIM(COALESCE(l.email, '')) <> ''
          AND act.title NOT IN ('Respuesta por correo: Tu cliente respondió un correo', 'Respuesta por correo: Tu cliente abrió un correo')
          AND act.scheduled_at >= (SELECT enabled_at FROM crm_email_alert_state WHERE id = 'primary')
          AND COALESCE(act.created_by, l.assigned_agent_id) IS NOT NULL
        ON CONFLICT DO NOTHING
      `;
      const pending = await sql`
        SELECT o.*, a.email FROM crm_email_alert_outbox o JOIN agents a ON a.id = o.agent_id
        WHERE o.sent_at IS NULL AND (o.lease_until IS NULL OR o.lease_until < NOW())
          AND (o.event_key NOT LIKE 'reply:%' OR EXISTS (
            SELECT 1 FROM crm_activities act JOIN crm_leads l ON l.id=act.lead_id
            WHERE 'reply:' || act.external_id=o.event_key AND act.lead_id=o.lead_id
              AND act.external_source='gmail_inbound' AND BTRIM(COALESCE(l.email,''))<>''
              AND act.title NOT IN ('Respuesta por correo: Tu cliente respondió un correo', 'Respuesta por correo: Tu cliente abrió un correo')
          ))
        ORDER BY o.created_at LIMIT 50
      `;
      for (const alert of pending) {
        if (!alert.email || !process.env.RESEND_API_KEY || !process.env.CONTACT_EMAIL_FROM) { failed += 1; continue; }
        // Leave time to reconcile a timeout using the same Resend idempotency key.
        await sql`UPDATE crm_email_alert_outbox SET lease_until = NOW() + INTERVAL '10 minutes', attempts = attempts + 1 WHERE event_key = ${alert.event_key}`;
        try {
          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `crm-alert-${alert.event_key}` },
            body: JSON.stringify({ from: process.env.CONTACT_EMAIL_FROM, to: [alert.email], subject: alert.subject,
              text: `${alert.body}\n\nVer contacto en el CRM:\n${origin}/admin/crm/${alert.lead_id}?activity=correo` }),
            signal: AbortSignal.timeout(15000),
          });
          if (!response.ok) throw new Error(`Proveedor de correo: ${response.status}`);
          await sql`UPDATE crm_email_alert_outbox SET sent_at = NOW(), lease_until = NULL WHERE event_key = ${alert.event_key}`;
          sent += 1;
        } catch {
          failed += 1;
          console.error("No se pudo entregar la notificación CRM", alert.event_key);
        }
      }
      return { sent, failed, imported, busy: false };
    } finally {
      await releaseWorkerLease(sql,"email-notifications",lease);
    }
  } finally { await sql.end(); }
}
