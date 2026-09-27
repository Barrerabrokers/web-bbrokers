import postgres from "postgres";
import webpush from "web-push";
import { createHash } from "crypto";
import { ensureMeetingLifecycle } from "@/lib/crm-meeting-lifecycle";

export function pushDb() {
  const url=process.env.POSTGRES_PRISMA_URL||process.env.POSTGRES_URL||process.env.POSTGRES_URL_NON_POOLING||process.env.DATABASE_URL||process.env.SUPABASE_DB_URL;
  if(!url)throw new Error("Falta conexión a la base de datos.");
  return postgres(url,{ssl:"require",max:1,prepare:false});
}
type Sql=ReturnType<typeof pushDb>;
export function validPushEndpoint(value:string) {
  try {
    const u=new URL(value);
    return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&(
      u.hostname==='fcm.googleapis.com'||u.hostname==='updates.push.services.mozilla.com'||
      u.hostname.endsWith('.push.apple.com')||u.hostname.endsWith('.notify.windows.com'));
  }catch{return false;}
}
export async function ensurePush(sql:Sql) {
  await sql.unsafe(`CREATE TABLE IF NOT EXISTS crm_push_config (
    id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK(id), public_key TEXT NOT NULL, private_key TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS crm_push_subscriptions (
    id UUID PRIMARY KEY, agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    endpoint TEXT UNIQUE NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL,
    email_opens BOOLEAN NOT NULL DEFAULT TRUE, tasks BOOLEAN NOT NULL DEFAULT TRUE, meetings BOOLEAN NOT NULL DEFAULT TRUE,
    meeting_minutes INTEGER NOT NULL DEFAULT 60 CHECK(meeting_minutes IN(60,720,1440)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_test_at TIMESTAMPTZ);
    CREATE TABLE IF NOT EXISTS crm_push_deliveries (
    subscription_id UUID NOT NULL REFERENCES crm_push_subscriptions(id) ON DELETE CASCADE,
    event_key TEXT NOT NULL, sent_at TIMESTAMPTZ, retry_at TIMESTAMPTZ, attempts INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY(subscription_id,event_key));
    ALTER TABLE crm_push_config ENABLE ROW LEVEL SECURITY;
    ALTER TABLE crm_push_subscriptions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE crm_push_deliveries ENABLE ROW LEVEL SECURITY;`);
  const [existing]=await sql`SELECT public_key,private_key FROM crm_push_config WHERE id=TRUE`;
  if(existing)return existing;
  const keys=webpush.generateVAPIDKeys();
  await sql`INSERT INTO crm_push_config(id,public_key,private_key) VALUES(TRUE,${keys.publicKey},${keys.privateKey}) ON CONFLICT DO NOTHING`;
  const [config]=await sql`SELECT public_key,private_key FROM crm_push_config WHERE id=TRUE`;
  return config;
}
export async function deliverPush(sub: {endpoint:string;p256dh:string;auth:string},config:{public_key:string;private_key:string},payload:object,ttl=300) {
  if(!validPushEndpoint(sub.endpoint))throw new Error('Proveedor push inválido.');
  return webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},JSON.stringify(payload),{
    vapidDetails:{subject:'mailto:pablo@barrerabrokers.com',publicKey:config.public_key,privateKey:config.private_key},
    TTL:Math.max(1,Math.min(ttl,86400)),timeout:10000,urgency:'normal',
  });
}
export async function processCrmPush() {
 const sql=pushDb();let sent=0,failed=0,expired=0;
 try {
  const config=await ensurePush(sql);
  await ensureMeetingLifecycle(sql);
  const [lock]=await sql`SELECT pg_try_advisory_lock(735208443) AS acquired`;
  if(!lock.acquired)return {sent,failed,expired,busy:true};
  try {
   const subscriptions=await sql`SELECT s.* FROM crm_push_subscriptions s JOIN agents a ON a.id=s.agent_id
     WHERE a.active=TRUE AND a.role IN('admin','agent','marketing')`;
   if(!subscriptions.length)return {sent,failed,expired};
   const tables=await sql`SELECT to_regclass('public.crm_task_schedules') AS tasks,to_regclass('public.crm_meeting_bookings') AS bookings`;
   const deadline=Date.now()+45000;
   for(const sub of subscriptions){
    if(Date.now()>deadline)break;
    const candidates: {event_key:string;kind:string;href:string;event_at:Date;expires_at:Date}[]=[];
    if(sub.email_opens)candidates.push(...await sql`SELECT 'open:'||t.id AS event_key,'open' AS kind,
      '/admin/crm/'||l.id||'?activity=correo' AS href,t.first_opened_at AS event_at,t.first_opened_at+INTERVAL '24 hours' AS expires_at
      FROM crm_email_trackings t JOIN crm_leads l ON l.id=t.lead_id
      WHERE COALESCE(l.assigned_agent_id,t.agent_id)=${sub.agent_id} AND t.first_opened_at>=${sub.created_at}
        AND t.first_opened_at>NOW()-INTERVAL '24 hours'` as typeof candidates);
    if(sub.tasks&&tables[0].tasks)candidates.push(...await sql`SELECT 'task:'||a.id||':'||a.scheduled_at||':'||COALESCE(s.reminder_minutes,60) AS event_key,'task' AS kind,
      '/admin/crm/'||a.lead_id||'?activity=tarea' AS href,a.scheduled_at AS event_at,a.scheduled_at AS expires_at
      FROM crm_activities a JOIN crm_leads l ON l.id=a.lead_id LEFT JOIN crm_task_schedules s ON s.activity_id=a.id
      WHERE a.type='tarea' AND COALESCE(l.assigned_agent_id,a.created_by)=${sub.agent_id} AND a.scheduled_at>NOW()
        AND a.scheduled_at-make_interval(mins=>COALESCE(s.reminder_minutes,60))<=NOW()` as typeof candidates);
    if(sub.meetings){
      candidates.push(...await sql`SELECT 'meeting-outcome:'||a.id||':'||CURRENT_DATE AS event_key,'meeting_outcome' AS kind,
        '/admin/crm/'||a.lead_id||'?activity=reunion#reuniones-crm' AS href,s.ends_at AS event_at,NOW()+INTERVAL '24 hours' AS expires_at
        FROM crm_activities a JOIN crm_meeting_schedules s ON s.activity_id=a.id JOIN crm_leads l ON l.id=a.lead_id
        LEFT JOIN crm_activity_results r ON r.activity_id=a.id
        WHERE COALESCE(l.assigned_agent_id,a.created_by)=${sub.agent_id} AND (s.ends_at<=NOW() OR s.cancelled_at IS NOT NULL)
          AND COALESCE(TRIM(r.outcome),'')=''` as typeof candidates);
      candidates.push(...await sql`SELECT 'meeting:'||a.id||':'||a.scheduled_at||':'||${sub.meeting_minutes} AS event_key,'meeting' AS kind,
        '/admin/crm/'||a.lead_id||'?activity=reunion' AS href,a.scheduled_at AS event_at,a.scheduled_at AS expires_at
        FROM crm_activities a JOIN crm_leads l ON l.id=a.lead_id WHERE a.type='reunion'
        AND NOT EXISTS(SELECT 1 FROM crm_meeting_schedules s WHERE s.activity_id=a.id AND s.cancelled_at IS NOT NULL)
        AND COALESCE(l.assigned_agent_id,a.created_by)=${sub.agent_id} AND a.scheduled_at>NOW()
        AND a.scheduled_at-make_interval(mins=>${sub.meeting_minutes})<=NOW()` as typeof candidates);
      if(tables[0].bookings)candidates.push(...await sql`SELECT 'booking:'||b.id||':'||b.starts_at||':'||${sub.meeting_minutes} AS event_key,'meeting' AS kind,
        '/admin/crm/calendario' AS href,b.starts_at AS event_at,b.starts_at AS expires_at FROM crm_meeting_bookings b
        WHERE b.agent_id=${sub.agent_id} AND b.starts_at>NOW() AND b.starts_at-make_interval(mins=>${sub.meeting_minutes})<=NOW()
        AND NOT EXISTS(SELECT 1 FROM crm_activities a WHERE a.external_source='google_calendar' AND a.external_id=b.google_event_id)` as typeof candidates);
    }
    const delivered=await sql`SELECT event_key FROM crm_push_deliveries WHERE subscription_id=${sub.id}
      AND (sent_at IS NOT NULL OR retry_at>NOW() OR attempts>=5)`;
    const skip=new Set(delivered.map(r=>r.event_key));
    for(const item of candidates.filter(r=>!skip.has(r.event_key)).sort((a,b)=>+new Date(a.expires_at)-+new Date(b.expires_at)).slice(0,50)){
      if(Date.now()>deadline)break;
      if(!item.event_key)continue;
      await sql`INSERT INTO crm_push_deliveries(subscription_id,event_key,retry_at,attempts) VALUES(${sub.id},${item.event_key},NOW()+INTERVAL '5 minutes',1)
        ON CONFLICT(subscription_id,event_key) DO UPDATE SET attempts=crm_push_deliveries.attempts+1,retry_at=EXCLUDED.retry_at`;
      try {
        const time=new Date(item.event_at).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
        await deliverPush(sub as any,config as any,{title:item.kind==='meeting_outcome'?'Resultado de reunión pendiente':item.kind==='open'?'Un cliente abrió tu correo':item.kind==='task'?'Recordatorio de tarea':'Recordatorio de reunión',
          body:item.kind==='meeting_outcome'?'Registrá el resultado o el motivo de cancelación en el CRM.':item.kind==='open'?'Abrí el CRM para ver el contacto.':`Programada para ${time} (Argentina). Abrí el CRM para ver los detalles.`,
          href:item.href,tag:createHash('sha256').update(item.event_key).digest('hex'),expiresAt:new Date(item.expires_at).toISOString()},
          Math.floor((+new Date(item.expires_at)-Date.now())/1000));
        await sql`UPDATE crm_push_deliveries SET sent_at=NOW(),retry_at=NULL WHERE subscription_id=${sub.id} AND event_key=${item.event_key}`;
        sent++;
      }catch(error){
        const code=(error as {statusCode?:number}).statusCode;
        if(code===404||code===410){await sql`DELETE FROM crm_push_subscriptions WHERE id=${sub.id}`;expired++;break;}
        failed++;
        console.error('No se pudo entregar una notificación push',code||'transport');
      }
    }
   }
   return {sent,failed,expired};
  }finally{await sql`SELECT pg_advisory_unlock(735208443)`;}
 }finally{await sql.end();}
}
