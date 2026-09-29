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

// The production migration has already installed these CRM objects. Request paths
// only verify them: executing DDL here caused locks and connection timeouts.
export async function ensureMeetingLifecycle(sql: Sql) {
  if (!schemaPromise) schemaPromise = verifyMeetingLifecycle(sql).catch(error => {
    schemaPromise = undefined;
    throw error;
  });
  await schemaPromise;
}

async function verifyMeetingLifecycle(sql: Sql) {
  const [state] = await sql`SELECT
    to_regclass('public.crm_activity_results') IS NOT NULL AS activity_results,
    to_regclass('public.crm_meeting_schedules') IS NOT NULL AS schedules,
    to_regclass('public.crm_meeting_result_history') IS NOT NULL AS history,
    to_regprocedure('crm_require_meeting()') IS NOT NULL AS meeting_trigger_function,
    EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'crm_lead_meeting_required' AND NOT tgisinternal) AS meeting_trigger`;
  if (!state?.activity_results || !state?.schedules || !state?.history || !state?.meeting_trigger_function || !state?.meeting_trigger) {
    throw new Error('La migración de ciclo de vida de reuniones no está aplicada.');
  }
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
