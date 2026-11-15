import { acquireWorkerLease, releaseWorkerLease } from "@/lib/database-worker-lease";
import postgres from "postgres";
import webpush from "web-push";
import { createHash } from "crypto";
import { ensureMeetingLifecycle } from "@/lib/crm-meeting-lifecycle";
import { persistCrmReminderNotifications } from "@/lib/crm-reminder-notifications";
import { shouldRunRuntimeSchemaMigrations } from "@/lib/runtime-schema";

export const PUSH_NOTIFICATION_SQL = `SELECT n.event_key,
      CASE n.type WHEN 'email_open' THEN 'open' WHEN 'email_reply' THEN 'reply'
        WHEN 'task_reminder' THEN 'task' WHEN 'campaign_recontact' THEN 'recontact' WHEN 'mia_sales' THEN 'mia_sales' ELSE 'meeting' END AS kind,
      n.title,n.body,
      COALESCE(NULLIF(BTRIM(CONCAT_WS(' ',l.first_name,l.last_name)),''),NULLIF(l.email,''),'Un cliente') AS contact_name,
      CASE WHEN n.type='email_open' AND t.id IS NOT NULL THEN '/admin/crm/'||n.lead_id||'?activity=correo&email='||t.id ELSE n.href END AS href,
      COALESCE(n.expires_at,n.created_at) AS event_at,
      COALESCE(n.expires_at,n.created_at+INTERVAL '24 hours') AS expires_at
      FROM crm_notifications n LEFT JOIN crm_leads l ON l.id=n.lead_id
      LEFT JOIN crm_email_trackings t ON n.event_key='email-open:'||t.id AND t.lead_id=n.lead_id
      WHERE (n.recipient_agent_id=$1::uuid OR (n.type='mia_sales' AND n.recipient_agent_id IS NULL AND EXISTS(SELECT 1 FROM agents a WHERE a.id=$1::uuid AND a.role='admin' AND a.active)))
      AND COALESCE(n.expires_at,n.created_at+INTERVAL '24 hours')>NOW()
      AND ((n.type='email_open' AND $3::boolean AND n.created_at>=$2::timestamptz)
        OR (n.type='email_reply' AND $4::boolean AND n.created_at>=$2::timestamptz
          AND n.created_at>=(SELECT enabled_at FROM crm_device_notification_state WHERE id=TRUE))
        OR (n.type='task_reminder' AND $5::boolean)
        OR (n.type='meeting_reminder' AND $6::boolean)
        OR (n.type IN('campaign_recontact','mia_sales') AND n.created_at>=$2::timestamptz))`;

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
  if (shouldRunRuntimeSchemaMigrations()) await sql.unsafe(`CREATE TABLE IF NOT EXISTS crm_push_config (
    id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK(id), public_key TEXT NOT NULL, private_key TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS crm_push_subscriptions (
    id UUID PRIMARY KEY, agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    endpoint TEXT UNIQUE NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL,
    email_opens BOOLEAN NOT NULL DEFAULT TRUE, email_replies BOOLEAN NOT NULL DEFAULT TRUE, last_processed_at TIMESTAMPTZ, tasks BOOLEAN NOT NULL DEFAULT TRUE, meetings BOOLEAN NOT NULL DEFAULT TRUE,
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
  const lease = await acquireWorkerLease(sql,"push");
  if(!lease)return {sent,failed,expired,busy:true};
  try {
   await persistCrmReminderNotifications(sql);
   const subscriptions=await sql`SELECT s.* FROM crm_push_subscriptions s JOIN agents a ON a.id=s.agent_id
     WHERE a.active=TRUE AND a.role IN('admin','agent','marketing') ORDER BY s.last_processed_at ASC NULLS FIRST,s.created_at`;
   if(!subscriptions.length)return {sent,failed,expired};
   const deadline=Date.now()+45000;
   for(const sub of subscriptions){
    if(Date.now()>deadline)break;
    await sql`UPDATE crm_push_subscriptions SET last_processed_at=NOW() WHERE id=${sub.id}`;
    const candidates: {event_key:string;kind:string;href:string;event_at:Date;expires_at:Date;title?:string;body?:string;contact_name?:string}[]=[];
    candidates.push(...await sql.unsafe(PUSH_NOTIFICATION_SQL,[sub.agent_id,sub.created_at,Boolean(sub.email_opens),sub.email_replies !== false,Boolean(sub.tasks),Boolean(sub.meetings)]) as typeof candidates);
    if(sub.meetings)candidates.push(...await sql`SELECT 'meeting-outcome:'||a.id||':'||CURRENT_DATE AS event_key,'meeting_outcome' AS kind,
      '/admin/crm/'||a.lead_id||'?activity=reunion#reuniones-crm' AS href,s.ends_at AS event_at,NOW()+INTERVAL '24 hours' AS expires_at
      FROM crm_activities a JOIN crm_meeting_schedules s ON s.activity_id=a.id JOIN crm_leads l ON l.id=a.lead_id
      LEFT JOIN crm_activity_results r ON r.activity_id=a.id
      WHERE COALESCE(l.assigned_agent_id,a.created_by)=${sub.agent_id} AND (s.ends_at<=NOW() OR s.cancelled_at IS NOT NULL)
        AND COALESCE(TRIM(r.outcome),'')=''` as typeof candidates);
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
        await deliverPush(sub as any,config as any,{title:item.kind==='mia_sales'?(item.title||'MIA · nueva interacción'):item.kind==='recontact'?'Un cliente volvió a consultar desde Meta':item.kind==='meeting_outcome'?'Resultado de reunión pendiente':item.kind==='open'?`${item.contact_name || 'Un cliente'} abrió tu correo`:item.kind==='reply'?`${item.contact_name || 'Un cliente'} respondió tu correo`:item.kind==='task'?'Recordatorio de tarea':'Recordatorio de reunión',
          body:item.kind==='mia_sales'?(item.body||item.title||'Nueva interacción de MIA'):item.kind==='recontact'?'El contacto pasó a Nuevo. Abrí el CRM para comunicarte con el cliente.':item.kind==='meeting_outcome'?'Registrá el resultado o el motivo de cancelación en el CRM.':(item.kind==='open'||item.kind==='reply')?`${(item.body || 'Correo sin asunto').replace(/[\r\n]+/g,' ').slice(0,180)} · Tocá para ver el correo y contactar al cliente.`:`Programada para ${time} (Argentina). Abrí el CRM para ver los detalles.`,
          href:item.href,tag:createHash('sha256').update(item.event_key).digest('hex'),expiresAt:new Date(item.expires_at).toISOString()},
          Math.floor((+new Date(item.expires_at)-Date.now())/1000));
        await sql`UPDATE crm_push_deliveries SET sent_at=NOW(),retry_at=NULL WHERE subscription_id=${sub.id} AND event_key=${item.event_key}`;
        sent++;
      }catch(error){
        const deliveryError=error as {statusCode?:number;body?:string;message?:string};
        const code=deliveryError.statusCode;
        // A missing or expired endpoint must be replaced by the device.
        // Remove it so the device can register a fresh subscription on its next visit.
        if([404,410].includes(code || 0)){await sql`DELETE FROM crm_push_subscriptions WHERE id=${sub.id}`;expired++;break;}
        failed++;
        console.error('No se pudo entregar una notificación push',code||'transport',deliveryError.message||deliveryError.body||'');
      }
    }
   }
   return {sent,failed,expired};
  }finally{await releaseWorkerLease(sql,"push",lease);}
 }finally{await sql.end();}
}
