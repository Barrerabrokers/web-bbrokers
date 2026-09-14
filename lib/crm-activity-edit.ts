import postgres from "postgres";
import { createHash } from "crypto";
import { ensureTaskSchedules } from "@/lib/crm-task-schedule";

function connection() {
  const url = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!url) throw new Error("No hay conexión a la base de datos.");
  return postgres(url, { ssl: "require", max: 1, prepare: false });
}
type Sql = ReturnType<typeof connection>;
async function ensure(sql: Sql) {
  await ensureTaskSchedules(sql);
  await sql`CREATE TABLE IF NOT EXISTS crm_activity_results (
    activity_id UUID PRIMARY KEY REFERENCES crm_activities(id) ON DELETE CASCADE,
    outcome TEXT NOT NULL DEFAULT '', updated_by UUID REFERENCES agents(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`ALTER TABLE crm_activity_results ENABLE ROW LEVEL SECURITY`;
}
function version(row: {title:string;body:string|null;scheduled_at:unknown;reminder_minutes?:number}, outcome:string) {
  return createHash("sha256").update(JSON.stringify([row.title,row.body || "",row.scheduled_at ? new Date(String(row.scheduled_at)).toISOString() : "",outcome,row.reminder_minutes || 60])).digest("hex");
}
async function details(sql: Sql, ids: string[]) {
  const rows = await sql`SELECT a.id,a.title,a.body,a.scheduled_at,r.outcome,r.updated_at,agent.name AS updated_by_name,s.reminder_minutes
    FROM crm_activities a LEFT JOIN crm_activity_results r ON r.activity_id=a.id
    LEFT JOIN crm_task_schedules s ON s.activity_id=a.id
    LEFT JOIN agents agent ON agent.id=r.updated_by WHERE a.id=ANY(${ids})`;
  const exists = await sql`SELECT to_regclass('public.crm_meeting_bookings') AS present`;
  const ends = exists[0]?.present ? await sql`SELECT a.id,MAX(b.ends_at) AS ends_at FROM crm_activities a
    JOIN crm_leads l ON l.id=a.lead_id JOIN crm_meeting_bookings b ON b.starts_at=a.scheduled_at
      AND lower(b.guest_email)=lower(l.email)
    WHERE a.id=ANY(${ids}) AND a.type='reunion' GROUP BY a.id` : [];
  return rows.map(r=>({id:r.id as string, reminderMinutes: (r.reminder_minutes || 60) as number, editVersion:version(r as any,r.outcome || ""),meetingOutcome:(r.outcome || "") as string,
    meetingEndsAt:ends.find(e=>e.id===r.id)?.ends_at ? new Date(ends.find(e=>e.id===r.id)!.ends_at).toISOString() : undefined,
    editedAt:r.updated_at ? new Date(r.updated_at).toISOString():undefined,editedByName:r.updated_by_name as string|undefined}));
}
export async function getCrmActivityEditDetails(ids:string[]) {
  if (!ids.length) return [];
  const sql=connection();try {await ensure(sql);return await details(sql,ids);} finally {await sql.end();}
}
export async function editCrmActivity(input:{id:string;version:string;title?:string;body?:string;scheduledAt?:string;outcome?:string;reminderMinutes?:number},actor:{id:string;includeAll:boolean}) {
  const sql=connection();try {
    await ensure(sql);
    return await sql.begin(async tx=>{
      const rows=await tx`SELECT a.* FROM crm_activities a JOIN crm_leads l ON l.id=a.lead_id
        WHERE a.id=${input.id} AND (${actor.includeAll} OR l.assigned_agent_id=${actor.id}) FOR UPDATE OF a,l`;
      const row=rows[0];if(!row)return {status:403,error:"No podés editar esta actividad."};
      const [meta]=await details(tx as unknown as Sql,[input.id]);
      if(meta.editVersion!==input.version)return {status:409,error:"La actividad cambió. Actualizá la página antes de editarla."};
      if(input.reminderMinutes!==undefined && (row.type!=='tarea' || ![60,720,1440].includes(input.reminderMinutes)))return {status:400,error:"Revisá el aviso de la tarea."};
      if(row.type==='reunion'){
        if(input.outcome===undefined || input.title!==undefined || input.body!==undefined || input.scheduledAt!==undefined)return {status:400,error:"Solo se puede registrar el resultado de la reunión."};
        if(!meta.meetingEndsAt || new Date(meta.meetingEndsAt).getTime()>Date.now())return {status:400,error:"El resultado se habilita al finalizar el horario de la reunión en la agenda."};
      }else if(row.type==='nota'||row.type==='tarea'){
        if(row.type==='tarea' && !input.scheduledAt)return {status:400,error:"Elegí fecha y hora para agendar la tarea."};
        if(!input.title || input.body===undefined || input.outcome!==undefined || (row.type==='nota'&&input.scheduledAt!==undefined))return {status:400,error:"Completá el título y el detalle."};
        await tx`UPDATE crm_activities SET title=${input.title},body=${input.body},
          scheduled_at=${row.type==='tarea' ? input.scheduledAt || null : row.scheduled_at} WHERE id=${input.id}`;
        if(row.type==='tarea')await tx`INSERT INTO crm_task_schedules(id,activity_id,reminder_minutes,calendar_agent_id,calendar_event_id)
          VALUES(${input.id},${input.id},${input.reminderMinutes ?? meta.reminderMinutes},
            ${row.external_source==='google_calendar' ? row.created_by : null},${row.external_source==='google_calendar' ? row.external_id : null})
          ON CONFLICT(id) DO UPDATE SET reminder_minutes=EXCLUDED.reminder_minutes,checked_at=NULL`;
      }else return {status:400,error:"Esta actividad no se puede editar."};
      await tx`INSERT INTO crm_activity_results(activity_id,outcome,updated_by) VALUES(${input.id},${input.outcome || ''},${actor.id})
        ON CONFLICT(activity_id) DO UPDATE SET outcome=EXCLUDED.outcome,updated_by=EXCLUDED.updated_by,updated_at=NOW()`;
      await tx`UPDATE crm_leads SET updated_at=NOW() WHERE id=${row.lead_id}`;
      return {status:200,error:null};
    });
  }finally{await sql.end();}
}
