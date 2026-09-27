import postgres from "postgres";
import { getCrmEmailAccountWithSecret } from "@/lib/db";
import { getAccessTokenForGoogleAccount } from "@/lib/google-oauth";

type Sql = ReturnType<typeof postgres>;
export function meetingDb() {
  const url = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!url) throw new Error("Falta conexión a la base de datos.");
  return postgres(url, {ssl:"require",max:1,prepare:false});
}
let schemaPromise: Promise<void> | undefined;
export async function ensureMeetingLifecycle(sql: Sql) {
  if (!schemaPromise) schemaPromise = initializeMeetingLifecycle(sql).catch(error => {schemaPromise=undefined;throw error;});
  await schemaPromise;
}
async function initializeMeetingLifecycle(sql: Sql) {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS crm_activity_results (
      activity_id UUID PRIMARY KEY REFERENCES crm_activities(id) ON DELETE CASCADE,
      outcome TEXT NOT NULL DEFAULT '', updated_by UUID REFERENCES agents(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    ALTER TABLE crm_activity_results ADD COLUMN IF NOT EXISTS outcome_status TEXT NOT NULL DEFAULT 'completed';
    CREATE TABLE IF NOT EXISTS crm_meeting_schedules (
      activity_id UUID PRIMARY KEY REFERENCES crm_activities(id) ON DELETE RESTRICT,
      ends_at TIMESTAMPTZ, calendar_agent_id UUID REFERENCES agents(id),
      cancelled_at TIMESTAMPTZ, checked_at TIMESTAMPTZ);
    ALTER TABLE crm_meeting_schedules ALTER COLUMN ends_at DROP NOT NULL;
    CREATE TABLE IF NOT EXISTS crm_meeting_result_history (
      id BIGSERIAL PRIMARY KEY, activity_id UUID NOT NULL REFERENCES crm_activities(id) ON DELETE RESTRICT,
      outcome TEXT NOT NULL, outcome_status TEXT NOT NULL, actor_id UUID REFERENCES agents(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    ALTER TABLE crm_activity_results ENABLE ROW LEVEL SECURITY;
    ALTER TABLE crm_meeting_schedules ENABLE ROW LEVEL SECURITY;
    ALTER TABLE crm_meeting_result_history ENABLE ROW LEVEL SECURITY;
    CREATE OR REPLACE FUNCTION crm_require_meeting() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      -- ON CONFLICT will run the UPDATE trigger; don't treat existing leads as new inserts.
      IF TG_OP='INSERT' AND EXISTS(SELECT 1 FROM crm_leads WHERE id=NEW.id) THEN RETURN NEW; END IF;
      IF TG_OP='UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
      IF EXISTS(SELECT 1 FROM crm_meeting_schedules s JOIN crm_activities a ON a.id=s.activity_id
        LEFT JOIN crm_activity_results r ON r.activity_id=a.id
        WHERE a.lead_id=NEW.id AND (s.ends_at<=NOW() OR s.cancelled_at IS NOT NULL) AND COALESCE(TRIM(r.outcome),'')='') THEN
        RAISE EXCEPTION 'Registrá el resultado o el motivo de cancelación de la reunión pendiente antes de cambiar el estado.';
      END IF;
      IF lower(trim(translate(NEW.status,'óÓ','oO')))='reunion' AND NOT EXISTS(
        SELECT 1 FROM crm_activities a JOIN crm_meeting_schedules s ON s.activity_id=a.id
        LEFT JOIN crm_activity_results r ON r.activity_id=a.id
        WHERE a.lead_id=NEW.id AND a.type='reunion' AND a.external_source='google_calendar'
          AND a.external_id IS NOT NULL AND a.scheduled_at>NOW() AND s.ends_at>a.scheduled_at
          AND s.cancelled_at IS NULL AND COALESCE(r.outcome_status,'completed')<>'cancelled') THEN
        RAISE EXCEPTION 'Para cambiar a Reunión primero debés agendar día y horario en el calendario.';
      END IF;
      RETURN NEW;
    END; $$;
    CREATE OR REPLACE TRIGGER crm_lead_meeting_required BEFORE INSERT OR UPDATE OF status ON crm_leads
      FOR EACH ROW EXECUTE FUNCTION crm_require_meeting();
  `);
}

export async function registerScheduledMeeting(activityId: string, endsAt: string, agentId: string, moveToMeeting = false) {
  const sql=meetingDb();
  try { await ensureMeetingLifecycle(sql); await sql.begin(async tx=>{
    const [activity]=await tx`SELECT a.lead_id FROM crm_activities a JOIN crm_leads l ON l.id=a.lead_id WHERE a.id=${activityId} FOR UPDATE OF l`;
    if(!activity)throw new Error("No se encontró la reunión guardada.");
    await tx`INSERT INTO crm_meeting_schedules(activity_id,ends_at,calendar_agent_id) VALUES(${activityId},${endsAt},${agentId}) ON CONFLICT DO NOTHING`;
  });
    // Keep the confirmed calendar booking even when a pending outcome blocks the status transition.
    if(moveToMeeting)await sql`UPDATE crm_leads SET status='Reunion',updated_at=NOW() WHERE id=(SELECT lead_id FROM crm_activities WHERE id=${activityId})`;
  } finally {await sql.end();}
}

export async function meetingCalendarToken(agentId: string) {
  const account=await getCrmEmailAccountWithSecret(agentId);
  if(!account)throw new Error("El organizador debe reconectar Google Calendar.");
  return getAccessTokenForGoogleAccount({account,origin:process.env.NEXTAUTH_URL || "https://barrerabrokers.com"});
}

// Synchronize actual end times and cancellations, then produce a durable reminder.
export async function processMeetingOutcomes() {
  const sql=meetingDb();let checked=0,failed=0;
  try {
    await ensureMeetingLifecycle(sql);
    const [lock]=await sql`SELECT pg_try_advisory_lock(735208445) AS acquired`;
    if(!lock.acquired)return {checked,failed};
    try {
      const rows=await sql`SELECT a.id,a.external_id,a.created_by,s.calendar_agent_id FROM crm_activities a
        LEFT JOIN crm_meeting_schedules s ON s.activity_id=a.id LEFT JOIN crm_activity_results r ON r.activity_id=a.id
        WHERE a.type='reunion' AND a.external_source='google_calendar' AND a.external_id IS NOT NULL
          AND a.scheduled_at>=NOW()-INTERVAL '90 days' AND COALESCE(TRIM(r.outcome),'')=''
          AND s.cancelled_at IS NULL ORDER BY s.checked_at ASC NULLS FIRST LIMIT 50`;
      const tokens=new Map<string,string>();const deadline=Date.now()+45000;
      for(const row of rows) {
        if(Date.now()>deadline)break;
        try {
          const owner=row.calendar_agent_id || row.created_by;
          if(!tokens.has(owner))tokens.set(owner,await meetingCalendarToken(owner));
          const response=await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(row.external_id)}`,{headers:{Authorization:`Bearer ${tokens.get(owner)}`},signal:AbortSignal.timeout(8000),cache:"no-store"});
          const event=await response.json().catch(()=>null);
          // A permission/not-found error is not proof of cancellation.
          if(!response.ok)throw new Error("No se pudo verificar Calendar.");
          if(event?.status==='cancelled') {
            await sql`INSERT INTO crm_meeting_schedules(activity_id,calendar_agent_id,cancelled_at,checked_at)
              VALUES(${row.id},${owner},NOW(),NOW()) ON CONFLICT(activity_id) DO UPDATE
              SET cancelled_at=COALESCE(crm_meeting_schedules.cancelled_at,NOW()),checked_at=NOW()`;
          } else if(event?.start?.dateTime && event?.end?.dateTime) {
            await sql.begin(async tx=>{
              await tx`UPDATE crm_activities SET scheduled_at=${event.start.dateTime} WHERE id=${row.id}`;
              await tx`INSERT INTO crm_meeting_schedules(activity_id,ends_at,calendar_agent_id,checked_at)
                VALUES(${row.id},${event.end.dateTime},${owner},NOW()) ON CONFLICT(activity_id) DO UPDATE SET ends_at=EXCLUDED.ends_at,checked_at=NOW()`;
            });
          }
          checked++;
        } catch {failed++;await sql`UPDATE crm_meeting_schedules SET checked_at=NOW() WHERE activity_id=${row.id}`;}
      }
      const [table]=await sql`SELECT to_regclass('public.crm_notifications') AS present`;
      if(table.present)await sql`INSERT INTO crm_notifications(id,recipient_agent_id,lead_id,event_key,type,title,body,href)
        SELECT gen_random_uuid(),COALESCE(l.assigned_agent_id,a.created_by),a.lead_id,'meeting-outcome:'||a.id,'meeting_outcome',
          'Resultado de reunión pendiente','Registrá el resultado o el motivo de cancelación para completar el seguimiento.',
          '/admin/crm/'||a.lead_id||'?activity=reunion#reuniones-crm'
        FROM crm_activities a JOIN crm_meeting_schedules s ON s.activity_id=a.id JOIN crm_leads l ON l.id=a.lead_id
        LEFT JOIN crm_activity_results r ON r.activity_id=a.id
        WHERE (s.ends_at<=NOW() OR s.cancelled_at IS NOT NULL) AND COALESCE(TRIM(r.outcome),'')=''
        ON CONFLICT(event_key) DO UPDATE SET recipient_agent_id=EXCLUDED.recipient_agent_id`;
      return {checked,failed};
    } finally {await sql`SELECT pg_advisory_unlock(735208445)`;}
  } finally {await sql.end();}
}
