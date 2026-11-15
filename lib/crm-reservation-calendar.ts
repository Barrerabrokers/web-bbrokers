import { createHash, randomUUID } from "crypto";
import type postgres from "postgres";
import { getSharedDatabase, releaseSharedDatabase } from "@/lib/database-pool";
import { getCrmEmailAccountWithSecret } from "@/lib/db";
import { getAccessTokenForGoogleAccount } from "@/lib/google-oauth";
import { hasGoogleCalendarAccess } from "@/lib/google-calendar-connection";
import { shouldRunRuntimeSchemaMigrations } from "@/lib/runtime-schema";
import { acquireWorkerLease, releaseWorkerLease } from "@/lib/database-worker-lease";
import type { PurchaseHistoryData } from "@/lib/crm-purchases";

type Sql = ReturnType<typeof postgres>;
export const RESERVATION_CALENDAR_SCHEMA = `CREATE TABLE IF NOT EXISTS crm_reservation_calendars (
  id UUID PRIMARY KEY, activity_id UUID REFERENCES crm_activities(id) ON DELETE SET NULL,
  recipient_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL, synced_version TEXT, checked_at TIMESTAMPTZ, last_error TEXT,
  UNIQUE(activity_id, recipient_id)
);
ALTER TABLE crm_reservation_calendars ENABLE ROW LEVEL SECURITY;`;
export async function ensureReservationCalendars(sql: Sql) {
  if (shouldRunRuntimeSchemaMigrations()) await sql.unsafe(RESERVATION_CALENDAR_SCHEMA);
}

// Called inside the same transaction as the purchase: saving both succeeds or neither does.
export async function updateReservationActivities(tx: Sql, leadId: string, history: PurchaseHistoryData, actorId: string) {
  const signatures = history.operations.filter(operation => operation.id && operation.signingAt);
  const keep = signatures.map(operation => operation.id!);
  await tx`DELETE FROM crm_activities WHERE lead_id=${leadId} AND external_source='reservation_signature'
    AND NOT (external_id=ANY(${keep}))`;
  for (const operation of signatures) {
    const title = `Firma · ${operation.development} · UF ${operation.units.join(", ")}`;
    const body = `Firma vinculada a ${operation.type === "RESERVA" ? "reserva" : "compra"}.\nFecha de reserva: ${operation.reservationDate || (operation.type === "RESERVA" ? operation.date : null) || "No informada"}.\nEditar fecha y hora desde Compras y reservas.`;
    await tx`INSERT INTO crm_activities(id,lead_id,type,title,body,scheduled_at,created_by,external_source,external_id)
      VALUES(${randomUUID()},${leadId},'nota',${title},${body},${operation.signingAt!},${actorId},'reservation_signature',${operation.id!})
      ON CONFLICT(external_source,external_id) WHERE external_source IS NOT NULL AND external_id IS NOT NULL
      DO UPDATE SET title=EXCLUDED.title,body=EXCLUDED.body,scheduled_at=EXCLUDED.scheduled_at`;
  }
}

export async function processReservationCalendars(leadId?: string) {
  const sql = getSharedDatabase();
  let synced = 0, failed = 0;
  try {
    await ensureReservationCalendars(sql);
    const lease = await acquireWorkerLease(sql, "reservation-calendar");
    if (!lease) return { synced, failed, pending: true };
    try {
      // Reconcile recipients every run, including reassignment and newly added administrators.
      await sql`INSERT INTO crm_reservation_calendars(id,activity_id,recipient_id,event_id)
        SELECT gen_random_uuid(),a.id,agent.id,
          'bbr'||replace(a.id::text,'-','')||replace(agent.id::text,'-','')
        FROM crm_activities a JOIN crm_leads l ON l.id=a.lead_id
        JOIN agents agent ON agent.active AND (agent.role='admin' OR agent.id=l.assigned_agent_id)
        WHERE a.external_source='reservation_signature' AND a.scheduled_at IS NOT NULL
          AND (${leadId || null}::uuid IS NULL OR a.lead_id=${leadId || null}::uuid)
        ON CONFLICT(activity_id,recipient_id) DO NOTHING`;
      const rows = await sql`SELECT q.*,a.title,a.body,a.scheduled_at,a.lead_id,
          concat_ws(' ',l.first_name,l.last_name) AS contact_name,
          (a.id IS NOT NULL AND agent.active AND (agent.role='admin' OR agent.id=l.assigned_agent_id)) AS active
        FROM crm_reservation_calendars q LEFT JOIN crm_activities a ON a.id=q.activity_id
        LEFT JOIN crm_leads l ON l.id=a.lead_id JOIN agents agent ON agent.id=q.recipient_id
        WHERE (${leadId || null}::uuid IS NULL OR a.lead_id=${leadId || null}::uuid OR q.activity_id IS NULL)
        ORDER BY q.checked_at ASC NULLS FIRST LIMIT 100`;
      const deadline = Date.now() + (leadId ? 20000 : 45000);
      const tokens = new Map<string, string>();
      let processed = 0;
      for (const row of rows) {
        if (Date.now() > deadline) break;
        processed++;
        await sql`UPDATE crm_reservation_calendars SET checked_at=NOW() WHERE id=${row.id}`;
        const version = createHash("sha256").update(JSON.stringify([row.title,row.body,row.scheduled_at,row.contact_name])).digest("hex");
        if (row.active && row.synced_version === version) continue;
        try {
          let token = tokens.get(row.recipient_id);
          if (!token) {
            const account = await getCrmEmailAccountWithSecret(row.recipient_id);
            if (!account || !hasGoogleCalendarAccess(account)) throw new Error("Firma en agenda del CRM; falta conectar Google Calendar.");
            token = await getAccessTokenForGoogleAccount({ origin: process.env.NEXTAUTH_URL || "https://barrerabrokers.com", account });
            tokens.set(row.recipient_id, token);
          }
          const calendar = (path: string, method: string, body?: object) => fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events${path}`, {
            method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(8000),
          });
          let eventPath = `/${encodeURIComponent(row.event_id)}`;
          if (!row.active) {
            const response = await calendar(eventPath, "DELETE");
            if (!response.ok && ![404,410].includes(response.status)) throw new Error("No se pudo retirar la firma anterior de Google Calendar.");
            await sql`DELETE FROM crm_reservation_calendars WHERE id=${row.id}`;
            continue;
          }
          const start = new Date(row.scheduled_at).toISOString();
          const payload = {
            summary: row.title,
            description: `Contacto: ${row.contact_name}\n${row.body}\n${process.env.NEXTAUTH_URL || "https://barrerabrokers.com"}/admin/crm/${row.lead_id}#purchase-information`,
            start: { dateTime: start, timeZone: "America/Argentina/Buenos_Aires" },
            end: { dateTime: new Date(new Date(start).getTime() + 60 * 60000).toISOString(), timeZone: "America/Argentina/Buenos_Aires" },
            attendees: [], reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 60 }] },
          };
          let response = await calendar(eventPath, "PATCH", payload);
          if (response.status === 410) {
            row.event_id = `bbr${randomUUID().replace(/-/g, "")}`;
            await sql`UPDATE crm_reservation_calendars SET event_id=${row.event_id},synced_version=NULL WHERE id=${row.id}`;
            eventPath = `/${encodeURIComponent(row.event_id)}`;
          }
          if ([404,410].includes(response.status)) response = await calendar("", "POST", { id: row.event_id, ...payload });
          if (response.status === 409) response = await calendar(eventPath, "PATCH", payload);
          if (!response.ok) throw new Error(`No se pudo sincronizar la firma (${response.status}).`);
          await sql`UPDATE crm_reservation_calendars SET synced_version=${version},last_error=NULL WHERE id=${row.id}`;
          synced++;
        } catch (error) {
          failed++;
          await sql`UPDATE crm_reservation_calendars SET last_error=${error instanceof Error ? error.message : "Error de calendario"} WHERE id=${row.id}`;
        }
      }
      return { synced, failed, pending: failed > 0 || processed < rows.length };
    } finally { await releaseWorkerLease(sql, "reservation-calendar", lease); }
  } finally { await releaseSharedDatabase(sql); }
}
