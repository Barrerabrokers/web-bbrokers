import postgres from "postgres";
import { getCrmLeadById } from "@/lib/db";
import { syncLeadEmailReplies } from "@/lib/crm-email-replies";

// Events are persisted before delivery, so a provider outage is retried next run.
export async function processCrmEmailNotifications() {
  const url = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!url) throw new Error("Falta la conexión a la base de datos.");
  if (!process.env.RESEND_API_KEY || !process.env.CONTACT_EMAIL_FROM) throw new Error("Faltan RESEND_API_KEY o CONTACT_EMAIL_FROM.");
  const origin = process.env.NEXTAUTH_URL || "https://barrerabrokers.com";
  const sql = postgres(url, { ssl: "require", max: 1, prepare: false });
  let sent = 0;
  let failed = 0;
  let imported = 0;
  try {
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS crm_email_alert_state (id TEXT PRIMARY KEY, enabled_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      INSERT INTO crm_email_alert_state (id) VALUES ('primary') ON CONFLICT DO NOTHING;
      CREATE TABLE IF NOT EXISTS crm_email_reply_checks (lead_id UUID PRIMARY KEY, checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS crm_email_alert_outbox (
        event_key TEXT PRIMARY KEY, agent_id UUID NOT NULL, lead_id UUID NOT NULL,
        subject TEXT NOT NULL, body TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        sent_at TIMESTAMPTZ, lease_until TIMESTAMPTZ, attempts INTEGER NOT NULL DEFAULT 0
      );
    `);
    // A single worker owns the poll and delivery pass, including overlapping cron requests.
    const [lock] = await sql`SELECT pg_try_advisory_lock(735208441) AS acquired`;
    if (!lock.acquired) return { sent, failed, imported, busy: true };
    try {
      const leads = await sql`
        SELECT l.id, l.assigned_agent_id, COALESCE(c.checked_at, (SELECT enabled_at FROM crm_email_alert_state WHERE id = 'primary')) AS since FROM crm_leads l
        JOIN crm_email_accounts a ON a.agent_id = l.assigned_agent_id
        LEFT JOIN crm_email_reply_checks c ON c.lead_id = l.id
        WHERE a.provider = 'google-oauth' AND a.google_scopes LIKE '%gmail.readonly%'
          AND COALESCE(l.email, '') <> ''
        ORDER BY c.checked_at ASC NULLS FIRST, l.id LIMIT 20
      `;
      const deadline = Date.now() + 180000;
      for (const row of leads) {
        if (Date.now() > deadline) break;
        const checkStarted = new Date();
        try {
          const lead = await getCrmLeadById(String(row.id), { includeAll: true });
          if (lead) {
            const result = await syncLeadEmailReplies({ lead, agentId: String(row.assigned_agent_id), origin, since: new Date(new Date(row.since).getTime() - 60000) });
            imported += result.imported;
            if (result.available) await sql`INSERT INTO crm_email_reply_checks (lead_id, checked_at) VALUES (${row.id}, ${checkStarted})
              ON CONFLICT (lead_id) DO UPDATE SET checked_at = EXCLUDED.checked_at`;
          }
        } catch {
          failed += 1;
          console.error("No se pudieron sincronizar respuestas del contacto", row.id);
        }
      }
      // Notify the first recorded opening once per email, not image-proxy reloads.
      await sql`
        INSERT INTO crm_email_alert_outbox (event_key, agent_id, lead_id, subject, body)
        SELECT 'open:' || t.id, COALESCE(l.assigned_agent_id, t.agent_id), l.id,
          'Tu cliente abrió un correo',
          concat_ws(E'\n', concat_ws(' ', l.first_name, l.last_name), 'Asunto: ' || COALESCE(t.subject, 'Sin asunto'))
        FROM crm_email_trackings t JOIN crm_leads l ON l.id = t.lead_id
        WHERE t.first_opened_at >= (SELECT enabled_at FROM crm_email_alert_state WHERE id = 'primary')
          AND COALESCE(l.assigned_agent_id, t.agent_id) IS NOT NULL
        ON CONFLICT DO NOTHING
      `;
      // Use the message date, not import time, to avoid alerts for historical Gmail imports.
      await sql`
        INSERT INTO crm_email_alert_outbox (event_key, agent_id, lead_id, subject, body)
        SELECT 'reply:' || act.external_id, COALESCE(l.assigned_agent_id, act.created_by), l.id,
          'Tu cliente respondió un correo',
          concat_ws(E'\n', concat_ws(' ', l.first_name, l.last_name), act.title)
        FROM crm_activities act JOIN crm_leads l ON l.id = act.lead_id
        WHERE act.external_source = 'gmail_inbound' AND act.external_id IS NOT NULL
          AND act.scheduled_at >= (SELECT enabled_at FROM crm_email_alert_state WHERE id = 'primary')
          AND COALESCE(l.assigned_agent_id, act.created_by) IS NOT NULL
        ON CONFLICT DO NOTHING
      `;
      const pending = await sql`
        SELECT o.*, a.email FROM crm_email_alert_outbox o JOIN agents a ON a.id = o.agent_id
        WHERE o.sent_at IS NULL AND (o.lease_until IS NULL OR o.lease_until < NOW())
        ORDER BY o.created_at LIMIT 50
      `;
      for (const alert of pending) {
        if (!alert.email) { failed += 1; continue; }
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
      await sql`SELECT pg_advisory_unlock(735208441)`;
    }
  } finally { await sql.end(); }
}
