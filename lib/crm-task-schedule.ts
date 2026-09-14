import postgres from "postgres";
import { createHash } from "crypto";
import { getCrmEmailAccountWithSecret } from "@/lib/db";
import { getAccessTokenForGoogleAccount } from "@/lib/google-oauth";

type Sql = ReturnType<typeof postgres>;
export async function ensureTaskSchedules(sql: Sql) {
  await sql`CREATE TABLE IF NOT EXISTS crm_task_schedules (
    id UUID PRIMARY KEY, activity_id UUID UNIQUE REFERENCES crm_activities(id) ON DELETE SET NULL,
    reminder_minutes INTEGER NOT NULL DEFAULT 60 CHECK (reminder_minutes IN (60,720,1440)),
    calendar_agent_id UUID, calendar_event_id TEXT, calendar_version TEXT,
    assignment_version TEXT, reminder_version TEXT, checked_at TIMESTAMPTZ,
    last_error TEXT
  )`;
  await sql`ALTER TABLE crm_task_schedules ENABLE ROW LEVEL SECURITY`;
}

export function taskVersion(values: unknown[]) {
  return createHash("sha256").update(JSON.stringify(values)).digest("hex");
}

export function taskReminderDue(scheduledAt: string, minutes: number, now = Date.now()) {
  const starts = new Date(scheduledAt).getTime();
  return now >= starts - minutes * 60000 && now < starts;
}

// A durable queue keeps tasks in the CRM even when Google or email is unavailable.
// Deterministic Google IDs and Resend keys make retries safe after a timeout.
export async function processCrmTaskSchedules(activityId?: string) {
  const url = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!url) throw new Error("Falta la conexión a la base de datos.");
  const sql = postgres(url, { ssl: "require", max: 1, prepare: false });
  const origin = process.env.NEXTAUTH_URL || "https://barrerabrokers.com";
  let synced = 0, sent = 0, failed = 0;
  try {
    await ensureTaskSchedules(sql);
    const [lock] = await sql`SELECT pg_try_advisory_lock(735208442) AS acquired`;
    if (!lock.acquired) return { synced, sent, failed, pending: true };
    try {
      // Recover existing dated tasks too, preserving the calendar where older events were created.
      await sql`INSERT INTO crm_task_schedules (id,activity_id,calendar_agent_id,calendar_event_id)
        SELECT id,id,CASE WHEN external_source='google_calendar' THEN created_by END,
          CASE WHEN external_source='google_calendar' THEN external_id END
        FROM crm_activities WHERE type='tarea' AND scheduled_at > NOW()
          AND (${activityId || null}::uuid IS NULL OR id=${activityId || null}::uuid)
        ON CONFLICT DO NOTHING`;
      const rows = await sql`SELECT s.*, a.title,a.body,a.scheduled_at,a.lead_id,
          COALESCE(l.assigned_agent_id,a.created_by) AS agent_id,
          agent.email,concat_ws(' ',l.first_name,l.last_name) AS contact_name
        FROM crm_task_schedules s LEFT JOIN crm_activities a ON a.id=s.activity_id
        LEFT JOIN crm_leads l ON l.id=a.lead_id
        LEFT JOIN agents agent ON agent.id=COALESCE(l.assigned_agent_id,a.created_by)
        WHERE (${activityId || null}::uuid IS NULL OR s.id=${activityId || null}::uuid)
        ORDER BY (a.scheduled_at > NOW() AND s.reminder_version IS NULL
          AND a.scheduled_at - make_interval(mins => s.reminder_minutes) <= NOW()) DESC NULLS LAST,
          s.checked_at ASC NULLS FIRST LIMIT 100`;
      const deadline = Date.now() + (activityId ? 20000 : 45000);
      const tokens = new Map<string, string>();
      const token = async (agentId: string) => {
        if (tokens.has(agentId)) return tokens.get(agentId)!;
        const account = await getCrmEmailAccountWithSecret(agentId);
        if (!account || account.provider !== "google-oauth") throw new Error("El agente debe conectar Google en Correo de CRM.");
        const value = await getAccessTokenForGoogleAccount({ origin, account });
        tokens.set(agentId, value);
        return value;
      }
      const calendar = async (agentId: string, path: string, method: string, body?: object) => {
        return fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events${path}`, {
          method, headers: { Authorization: `Bearer ${await token(agentId)}`, "Content-Type": "application/json" },
          ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000),
        });
      }
      const email = async (to: string, subject: string, body: string, key: string) => {
        if (!to || !process.env.RESEND_API_KEY || !process.env.CONTACT_EMAIL_FROM) throw new Error("Falta configurar el correo del agente o el servicio de avisos.");
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `crm-task-${key}` },
          body: JSON.stringify({ from: process.env.CONTACT_EMAIL_FROM, to: [to], subject, text: body }),
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new Error(`No se pudo enviar el aviso (${response.status}).`);
        sent++;
      }
      let processed = 0;
      for (const row of rows) {
        if (Date.now() > deadline) break;
        processed++;
        const errors: string[] = [];
        await sql`UPDATE crm_task_schedules SET checked_at=NOW() WHERE id=${row.id}`;
        const active = Boolean(row.activity_id && row.scheduled_at && row.agent_id);
        try {
          if (row.calendar_event_id && (!active || row.calendar_agent_id !== row.agent_id)) {
            const response = await calendar(row.calendar_agent_id, `/${encodeURIComponent(row.calendar_event_id)}`, "DELETE");
            if (!response.ok && ![404,410].includes(response.status)) throw new Error(`No se pudo actualizar el calendario anterior (${response.status}).`);
            await sql`UPDATE crm_task_schedules SET calendar_agent_id=NULL,calendar_event_id=NULL,calendar_version=NULL WHERE id=${row.id}`;
            row.calendar_event_id = null; row.calendar_version = null;
          }
          if (!row.activity_id) {
            await sql`DELETE FROM crm_task_schedules WHERE id=${row.id}`;
            continue;
          }
          if (active) {
            const start = new Date(row.scheduled_at).toISOString();
            const version = taskVersion([row.agent_id,row.title,row.body,start,row.reminder_minutes]);
            if (row.calendar_version !== version) {
              const id = row.calendar_event_id || `bb${String(row.id).replace(/-/g, "")}`;
              const payload = {
                summary: row.title,
                description: `${row.body || ""}\nContacto: ${row.contact_name}\n${origin}/admin/crm/${row.lead_id}?activity=tarea`,
                start: { dateTime: start, timeZone: "America/Argentina/Buenos_Aires" },
                end: { dateTime: new Date(new Date(start).getTime()+30*60000).toISOString(), timeZone: "America/Argentina/Buenos_Aires" },
                reminders: { useDefault: false, overrides: [{ method: "popup", minutes: row.reminder_minutes }] },
                // Tasks are internal. Never invite the contact as an attendee.
                attendees: [],
              };
              // Persist identity before the external call so deletion/reassignment can recover timeouts.
              await sql`UPDATE crm_task_schedules SET calendar_agent_id=${row.agent_id},calendar_event_id=${id} WHERE id=${row.id}`;
              let response = await calendar(row.agent_id, `/${encodeURIComponent(id)}`, "PATCH", payload);
              if (response.status === 404) response = await calendar(row.agent_id, "", "POST", { id, ...payload });
              if (response.status === 409) response = await calendar(row.agent_id, `/${encodeURIComponent(id)}`, "PATCH", payload);
              if (!response.ok) throw new Error(`Google Calendar no pudo guardar la tarea (${response.status}).`);
              await sql`UPDATE crm_task_schedules SET calendar_version=${version} WHERE id=${row.id}`;
              synced++;
            }
          }
        } catch (error) { errors.push(error instanceof Error ? error.message : "Error de calendario."); }
        // Email is independent of Google connectivity.
        if (active && new Date(row.scheduled_at).getTime() > Date.now()) {
          const start = new Date(row.scheduled_at).toISOString();
          const assignment = taskVersion([row.id,row.agent_id,start]);
          const reminder = taskVersion([assignment,row.reminder_minutes]);
          const body = `${row.title}\nContacto: ${row.contact_name}\nFecha: ${new Date(start).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })} (Argentina)\n${row.body || ""}\n\n${origin}/admin/crm/${row.lead_id}?activity=tarea`;
          try {
            if (row.assignment_version !== assignment) {
              await email(row.email, "Tenés una tarea agendada", body, `assigned-${assignment}`);
              await sql`UPDATE crm_task_schedules SET assignment_version=${assignment} WHERE id=${row.id}`;
            }
            if (row.reminder_version !== reminder && taskReminderDue(start,row.reminder_minutes)) {
              await email(row.email, "Recordatorio de tarea", body, `reminder-${reminder}`);
              await sql`UPDATE crm_task_schedules SET reminder_version=${reminder} WHERE id=${row.id}`;
            }
          } catch (error) { errors.push(error instanceof Error ? error.message : "Error de correo."); }
        }
        if (errors.length) failed++;
        await sql`UPDATE crm_task_schedules SET last_error=${errors.join(" ") || null} WHERE id=${row.id}`;
      }
      return { synced, sent, failed, pending: failed > 0 || processed < rows.length };
    } finally { await sql`SELECT pg_advisory_unlock(735208442)`; }
  } finally { await sql.end(); }
}
