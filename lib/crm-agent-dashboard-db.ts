import postgres from "postgres";
import { normalizeCrmLeadStatus } from "./crm-statuses";
import type { AgentDashboard } from "./crm-agent-dashboard";
import { resolveReportRange } from "./crm-agent-report";

// Read-only snapshot. Ownership scopes the portfolio and tasks, authorship scopes
// meetings. Non-admins cannot receive contact data from another owner's portfolio.
export const AGENT_DASHBOARD_SQL = `
WITH leads AS (
 SELECT l.*, COALESCE(NULLIF(trim(concat_ws(' ',l.first_name,l.last_name)),''),'Contacto') name,
 COALESCE(NULLIF(l.development_name_text,''),d.name,'Sin proyecto') project,
 COALESCE(agent.name,'Sin asignar') owner
 FROM crm_leads l LEFT JOIN developments d ON d.id=l.development_id
 LEFT JOIN agents agent ON agent.id=l.assigned_agent_id
 WHERE ($1::uuid IS NULL OR l.assigned_agent_id=$1::uuid)
), contacts AS (
 SELECT l.id,l.name,l.project,l.status,COALESCE(l.temperature,'') temperature,l.owner,
 COALESCE(last.at,l.created_at) "lastActivity",n.scheduled_at "nextTask",n.title "nextTitle"
 FROM leads l
 LEFT JOIN LATERAL (SELECT max(a.created_at) at FROM crm_activities a WHERE a.lead_id=l.id AND a.type IN ('llamada','correo','whatsapp','nota')) last ON true
 LEFT JOIN LATERAL (SELECT a.scheduled_at,a.title FROM crm_activities a WHERE a.lead_id=l.id AND a.type='tarea' AND a.scheduled_at >= $2::timestamptz ORDER BY a.scheduled_at,a.id LIMIT 1) n ON true
), tasks AS (
 SELECT a.id,l.id "leadId",l.name,a.title,a.scheduled_at at,l.owner
 FROM crm_activities a JOIN leads l ON l.id=a.lead_id
 WHERE a.type='tarea' AND a.scheduled_at IS NOT NULL
), meetings AS (
 SELECT 'activity:'||a.id::text id,
 CASE WHEN $5::boolean OR l.assigned_agent_id=$1::uuid THEN l.id ELSE NULL END "leadId",
 CASE WHEN $5::boolean OR l.assigned_agent_id=$1::uuid THEN COALESCE(NULLIF(trim(concat_ws(' ',l.first_name,l.last_name)),''),'Contacto') ELSE 'Reunión agendada' END name,
 CASE WHEN $5::boolean OR l.assigned_agent_id=$1::uuid THEN a.title ELSE 'Reunión agendada' END title,
 a.scheduled_at at,COALESCE(agent.name,'Sin autor') owner
 FROM crm_activities a JOIN crm_leads l ON l.id=a.lead_id
 LEFT JOIN crm_meeting_schedules s ON s.activity_id=a.id
 LEFT JOIN crm_activity_results r ON r.activity_id=a.id
 LEFT JOIN agents agent ON agent.id=COALESCE(s.calendar_agent_id,a.created_by)
 WHERE a.type='reunion' AND a.scheduled_at >= $8::timestamptz
 AND ($1::uuid IS NULL OR COALESCE(s.calendar_agent_id,a.created_by)=$1::uuid)
 AND s.cancelled_at IS NULL AND r.activity_id IS NULL
 UNION ALL
 SELECT 'booking:'||b.id::text,NULL::uuid,b.guest_name,'Reunión reservada',b.starts_at,COALESCE(agent.name,'Sin autor')
 FROM crm_meeting_bookings b LEFT JOIN agents agent ON agent.id=b.agent_id
 WHERE b.starts_at >= $8::timestamptz AND ($1::uuid IS NULL OR b.agent_id=$1::uuid)
 AND NOT EXISTS(SELECT 1 FROM crm_activities a JOIN crm_leads l ON l.id=a.lead_id
 WHERE a.type='reunion' AND (a.external_id=NULLIF(b.google_event_id,'')
 OR (a.scheduled_at=b.starts_at AND lower(l.email)=lower(b.guest_email))))
)
SELECT
 COALESCE((SELECT json_agg(p) FROM (SELECT status,count(*)::int count FROM leads GROUP BY status) p),'[]') pipeline,
 COALESCE((SELECT json_agg(c) FROM (SELECT * FROM contacts WHERE ($7::text='all' AND status NOT IN ('Vendido','Reservado','No interesado / no califica') OR status=$7::text) ORDER BY ("nextTask" IS NULL) DESC,(temperature='caliente') DESC,"lastActivity",id LIMIT 200) c),'[]') contacts,
 COALESCE((SELECT json_agg(t) FROM (SELECT * FROM ((SELECT * FROM tasks WHERE at < $2::timestamptz ORDER BY at,id LIMIT 4) UNION ALL (SELECT * FROM tasks WHERE at >= $2::timestamptz ORDER BY at,id LIMIT 8)) picked ORDER BY at,id) t),'[]') tasks,
 COALESCE((SELECT json_agg(m) FROM (SELECT * FROM meetings ORDER BY at,id LIMIT 6) m),'[]') meetings,
 json_build_object(
 'total',(SELECT count(*) FROM leads),
 'active',(SELECT count(*) FROM leads WHERE status NOT IN ('Vendido','Reservado','No interesado / no califica')),
 'hot',(SELECT count(*) FROM leads WHERE temperature='caliente' AND status NOT IN ('Vendido','Reservado','No interesado / no califica')),
 'withoutTask',(SELECT count(*) FROM contacts WHERE "nextTask" IS NULL AND status NOT IN ('Vendido','Reservado','No interesado / no califica')),
 'tasksToday',(SELECT count(*) FROM tasks WHERE at >= $2::timestamptz AND at < $3::timestamptz),
 'overdue',(SELECT count(*) FROM tasks WHERE at < $2::timestamptz),
 'meetingsToday',(SELECT count(*) FROM meetings WHERE at < $3::timestamptz),
 'sold',(SELECT count(*) FROM leads WHERE status='Vendido'),
 'completedMeetings',(SELECT count(*) FROM crm_activities a JOIN crm_activity_results r ON r.activity_id=a.id
 LEFT JOIN crm_meeting_schedules s ON s.activity_id=a.id
 WHERE a.type='reunion' AND r.outcome_status='completed' AND trim(r.outcome)<>''
 AND r.updated_at >= $4::timestamptz AND r.updated_at < $6::timestamptz
 AND ($1::uuid IS NULL OR COALESCE(s.calendar_agent_id,a.created_by)=$1::uuid))
 ) counts
`;

export async function getAgentDashboard(scope: string | null, admin: boolean, now = new Date(), status = "all"): Promise<AgentDashboard> {
  const url = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!url) throw new Error("No hay conexión a la base de datos.");
  const sql = postgres(url, { ssl: "require", max: 1, prepare: false, connect_timeout: 15 });
  try {
    const today = resolveReportRange({ period: "today" }, now), month = resolveReportRange({ period: "this_month" }, now);
    const [row] = await sql.unsafe(AGENT_DASHBOARD_SQL, [scope, today.start, today.end, month.start, admin, month.end, status, now.toISOString()]);
    const agents = await sql<{ id: string; name: string; active: boolean }[]>`SELECT id,name,active FROM agents WHERE role IN ('admin','agent','marketing') AND (${admin} OR id=${scope}) ORDER BY name`;
    const grouped = new Map<string,number>();
    for (const item of row.pipeline) { const status=normalizeCrmLeadStatus(item.status); grouped.set(status,(grouped.get(status)||0)+item.count); }
    return { tasks:row.tasks, meetings:row.meetings, counts:row.counts, contacts: row.contacts.map((c: {status:string})=>({...c,status:normalizeCrmLeadStatus(c.status)})), pipeline: Array.from(grouped,([status,count])=>({status,count})), agents, scope, today:today.from, generatedAt:now.toISOString() } as AgentDashboard;
  } finally { await sql.end(); }
}
