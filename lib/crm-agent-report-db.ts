import postgres from "postgres";
import { EMPTY_COUNTS, responseRate, type AgentReport, type ReportRange } from "./crm-agent-report";

// A single statement gives totals, chart and detail the same database snapshot.
export const AGENT_REPORT_SQL = `
WITH activity_events AS (
 SELECT 'activity:' || a.id::text id, a.lead_id, a.created_by agent_id,
   CASE WHEN a.type = 'correo' AND a.external_source = 'gmail_inbound' THEN 'respuesta' ELSE a.type END channel,
   COALESCE(a.scheduled_at, a.created_at) at, a.title, a.body
 FROM crm_activities a
 WHERE (a.type IN ('llamada','whatsapp','reunion')
    OR (a.type = 'correo' AND (a.external_source = 'gmail_inbound'
       OR a.external_id LIKE 'email-tracking:%' OR a.title ILIKE 'Correo enviado:%'
       OR a.external_source = 'crm_workflow')))
   AND NOT (a.type='whatsapp' AND (COALESCE(a.external_source,'')='whatsapp_inbound'
     OR a.title ILIKE 'WhatsApp recibido%' OR a.title ILIKE 'Respuesta por WhatsApp%'))
), booking_events AS (
 SELECT 'booking:' || b.id::text id, NULL::uuid lead_id, b.agent_id,
   'reunion'::text channel, b.starts_at at, 'Reunión con ' || b.guest_name title,
   b.notes body
 FROM crm_meeting_bookings b
 WHERE NOT EXISTS (
   SELECT 1 FROM crm_activities a LEFT JOIN crm_leads l ON l.id = a.lead_id
   WHERE a.type = 'reunion' AND a.created_by = b.agent_id
     AND ((a.external_source = 'google_calendar' AND NULLIF(b.google_event_id,'') = a.external_id)
       OR (a.scheduled_at = b.starts_at AND lower(l.email) = lower(b.guest_email)))
 )
), inbox_events AS (
 SELECT 'whatsapp:' || m.id::text id, c.lead_id, m.sender_agent_id agent_id,
   'whatsapp'::text channel, m.created_at at, 'WhatsApp enviado al cliente'::text title, m.content body
 FROM crm_whatsapp_messages m JOIN crm_whatsapp_conversations c ON c.id = m.conversation_id
 WHERE c.channel = 'whatsapp' AND m.direction = 'outbound' AND m.sender_type = 'agent'
   AND m.status IN ('sent','delivered','read')
   AND NOT EXISTS (SELECT 1 FROM crm_activities a WHERE a.type = 'whatsapp' AND a.external_id = m.whatsapp_message_id)
), events AS (
 SELECT * FROM activity_events UNION ALL SELECT * FROM booking_events UNION ALL SELECT * FROM inbox_events
), scoped AS (
 SELECT e.* FROM events e
 WHERE ($1::uuid IS NULL OR e.agent_id = $1::uuid)
   AND e.at >= $2::timestamptz AND e.at < $3::timestamptz
), emailed AS (
 SELECT agent_id, lead_id, min(at) first_sent FROM scoped WHERE channel = 'correo' GROUP BY agent_id, lead_id
), recipients AS (
 SELECT e.*, EXISTS (
   SELECT 1 FROM crm_activities r
   WHERE r.type = 'correo' AND r.external_source = 'gmail_inbound'
     AND r.lead_id = e.lead_id AND r.created_by IS NOT DISTINCT FROM e.agent_id
     AND COALESCE(r.scheduled_at,r.created_at) >= e.first_sent
     AND COALESCE(r.scheduled_at,r.created_at) < $3::timestamptz
 ) answered FROM emailed e
), totals AS (
 SELECT count(*) FILTER (WHERE channel='llamada')::int llamada,
 count(*) FILTER (WHERE channel='correo')::int correo,
 count(*) FILTER (WHERE channel='whatsapp')::int whatsapp,
 count(*) FILTER (WHERE channel='reunion')::int reunion,
 count(*) FILTER (WHERE channel='respuesta')::int respuesta FROM scoped
), days AS (
 SELECT to_char(at AT TIME ZONE 'America/Argentina/Buenos_Aires','YYYY-MM-DD') AS "day",
 count(*) FILTER (WHERE channel='llamada')::int llamada,
 count(*) FILTER (WHERE channel='correo')::int correo,
 count(*) FILTER (WHERE channel='whatsapp')::int whatsapp,
 count(*) FILTER (WHERE channel='reunion')::int reunion,
 count(*) FILTER (WHERE channel='respuesta')::int respuesta
 FROM scoped GROUP BY 1 ORDER BY 1
), team AS (
 SELECT s.agent_id id, COALESCE(a.name,'Sin autor registrado') name,
 count(*) FILTER (WHERE channel='llamada')::int llamada,
 count(*) FILTER (WHERE channel='correo')::int correo,
 count(*) FILTER (WHERE channel='whatsapp')::int whatsapp,
 count(*) FILTER (WHERE channel='reunion')::int reunion,
 count(*) FILTER (WHERE channel='respuesta')::int respuesta,
 (SELECT count(*)::int FROM recipients r WHERE r.agent_id IS NOT DISTINCT FROM s.agent_id) contacted,
 (SELECT count(*)::int FROM recipients r WHERE r.agent_id IS NOT DISTINCT FROM s.agent_id AND r.answered) replied
 FROM scoped s LEFT JOIN agents a ON a.id = s.agent_id GROUP BY s.agent_id,a.name ORDER BY count(*) DESC, name
), detail AS (
 SELECT s.id, s.lead_id "leadId", s.agent_id "agentId", COALESCE(a.name,'Sin autor registrado') agent,
 COALESCE(NULLIF(trim(concat_ws(' ',l.first_name,l.last_name)),''),s.title) contact,
 s.channel, s.at, s.title, left(s.body,4000) body,
 (s.lead_id IS NOT NULL AND ($6::boolean OR l.assigned_agent_id = $1::uuid)) "canOpen"
 FROM scoped s LEFT JOIN agents a ON a.id=s.agent_id LEFT JOIN crm_leads l ON l.id=s.lead_id
 WHERE ($4::text = 'all' OR s.channel = $4::text)
 ORDER BY s.at DESC,s.id DESC LIMIT 30 OFFSET $5
)
SELECT (SELECT row_to_json(t) FROM totals t) totals,
 COALESCE((SELECT json_agg(d) FROM days d),'[]'::json) days,
 COALESCE((SELECT json_agg(t) FROM team t),'[]'::json) team,
 COALESCE((SELECT json_agg(d) FROM detail d),'[]'::json) activities,
 (SELECT count(*)::int FROM scoped WHERE $4::text = 'all' OR channel = $4::text) "totalActivities",
 (SELECT count(*)::int FROM recipients) contacted,
 (SELECT count(*)::int FROM recipients WHERE answered) replied
`;

export async function getAgentReport(input: { scope: string | null; admin: boolean; range: ReportRange; channel: string; page: number }): Promise<AgentReport> {
  const url = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!url) throw new Error("No hay conexión a la base de datos.");
  const sql = postgres(url, { ssl: "require", max: 1, prepare: false, connect_timeout: 15 });
  try {
    const [row] = await sql.unsafe(AGENT_REPORT_SQL, [input.scope, input.range.start, input.range.end, input.channel, (input.page - 1) * 30, input.admin]);
    const agents = await sql<{ id: string; name: string; active: boolean }[]>`
      SELECT id,name,active FROM agents WHERE role IN ('admin','agent','marketing')
      AND (${input.admin} OR id=${input.scope}) ORDER BY name`;
    const team: AgentReport["team"] = input.admin ? agents
      .filter(agent => (!input.scope || agent.id === input.scope) && (agent.active || row.team.some((item: { id: string | null }) => item.id === agent.id)))
      .map(agent => row.team.find((item: { id: string | null }) => item.id === agent.id) || { id: agent.id, name: agent.name, ...EMPTY_COUNTS, contacted: 0, replied: 0 })
      .concat(row.team.filter((item: { id: string | null }) => item.id === null)) : row.team;
    return {
      range: input.range, scope: input.scope, admin: input.admin, agents,
      generatedAt: new Date().toISOString(), totals: { ...EMPTY_COUNTS, ...row.totals },
      contacted: row.contacted, replied: row.replied, responseRate: responseRate(row.replied, row.contacted),
      days: row.days, team, activities: row.activities,
      totalActivities: row.totalActivities, page: input.page, pageSize: 30,
    };
  } finally { await sql.end(); }
}
