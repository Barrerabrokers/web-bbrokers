import postgres from 'postgres';
import { firstContactWhatsAppPhoneId } from './whatsapp-inbox-scope';
import { randomUUID } from 'crypto';
import { MIA_PILOT_LIMIT, miaSalesOpening } from './mia-sales-policy';
export function miaSalesDb(){
 const url=process.env.POSTGRES_PRISMA_URL||process.env.POSTGRES_URL||process.env.POSTGRES_URL_NON_POOLING||process.env.DATABASE_URL||process.env.SUPABASE_DB_URL;
 if(!url)throw Error('Falta conexión al CRM.');
 return postgres(url,{ssl:'require',max:1,prepare:false,connect_timeout:15});
}
export async function notifyMiaSales(sql:any,leadId:string,key:string,title:string,body:string){
 await sql`INSERT INTO crm_notifications(id,recipient_agent_id,lead_id,event_key,type,title,body,href)
 VALUES(${randomUUID()},NULL,${leadId},${'mia-sales:'+key},'mia_sales',${title},${body.slice(0,1000)},${'/admin/crm/'+leadId}) ON CONFLICT(event_key) DO NOTHING`;
}
export async function readMiaSalesPilot(){
 const sql=miaSalesDb();try{
  const [ready]=await sql`SELECT to_regclass('public.crm_mia_sales_control') IS NOT NULL ready`;
  if(!ready.ready)return {ready:false};
  const [config]=await sql`SELECT c.*,a.name,a.email,a.active,
   EXISTS(SELECT 1 FROM crm_email_accounts e WHERE e.agent_id=c.agent_id) email_connected,
   EXISTS(SELECT 1 FROM crm_email_accounts e WHERE e.agent_id=c.agent_id AND e.provider='google-oauth' AND e.google_scopes LIKE '%gmail.readonly%' AND e.google_scopes LIKE '%gmail.send%') email_replies
   FROM crm_mia_sales_control c JOIN agents a ON a.id=c.agent_id WHERE c.id=TRUE`;
  if(!config)return {ready:false};
  const assigned=await sql`SELECT l.id,concat_ws(' ',l.first_name,l.last_name) name,l.status,
   COALESCE(NULLIF(l.development_name_text,''),d.name,'') project,
   NULLIF(trim(l.email),'') IS NOT NULL has_email,NULLIF(trim(l.phone),'') IS NOT NULL has_phone
   FROM crm_leads l LEFT JOIN developments d ON d.id=l.development_id WHERE l.assigned_agent_id=${config.agent_id} ORDER BY l.updated_at DESC,l.id LIMIT 101`;
  const enrollments=await sql`SELECT e.lead_id,e.state,e.reason,e.started_at,e.stopped_at,concat_ws(' ',l.first_name,l.last_name) name
   FROM crm_mia_sales_enrollments e JOIN crm_leads l ON l.id=e.lead_id WHERE e.run_id=${config.run_id} ORDER BY e.started_at`;
  const jobs=await sql`SELECT j.id,j.lead_id,j.channel,j.kind,j.state,j.subject,j.content,j.error,j.due_at,j.sent_at,(SELECT m.status FROM crm_whatsapp_messages m WHERE m.whatsapp_message_id=j.provider_id AND m.direction='outbound' LIMIT 1) delivery_status
   FROM crm_mia_sales_jobs j WHERE j.run_id=${config.run_id} ORDER BY j.created_at DESC LIMIT 40`;
  let whatsappReady=false,whatsappError='';
  try{await (await import('./mia-sales-worker')).approvedMiaSalesTemplate();whatsappReady=true;}catch(error){whatsappError=error instanceof Error?error.message:'No se pudo verificar la plantilla de WhatsApp.';}
  return {ready:true,config:{agentId:config.agent_id,name:config.name,email:config.email,active:config.active,enabled:config.enabled,emailConnected:config.email_connected,emailReplies:config.email_replies,runId:config.run_id,approvedIds:config.approved_lead_ids,automaticAssignments:config.automatic_assignments===true,whatsappReady,whatsappError},assigned,enrollments,jobs,limit:MIA_PILOT_LIMIT};
 }finally{await sql.end();}
}
export async function startMiaSalesPilot(actor:string,ids:string[]){
 if(ids.length<1||ids.length>MIA_PILOT_LIMIT||new Set(ids).size!==ids.length)throw Error('Elegí entre uno y cinco contactos distintos.');
 const sql=miaSalesDb();try{return await sql.begin(async tx=>{
  const [c]=await tx`SELECT c.*,a.active FROM crm_mia_sales_control c JOIN agents a ON a.id=c.agent_id WHERE c.id=TRUE FOR UPDATE OF c`;
  if(!c?.active)throw Error('El perfil de MIA no está activo.');
  if(ids.some(id=>!c.approved_lead_ids.includes(id)))throw Error("El piloto está limitado a los cinco contactos autorizados.");
  if(c.enabled||c.run_id)throw Error('Este piloto ya tiene una cartera seleccionada. Pausalo o reanudalo desde el panel; no se repiten las aperturas.');
  const account=await tx`SELECT agent_id FROM crm_email_accounts WHERE agent_id=${c.agent_id} AND provider='google-oauth' AND google_scopes LIKE '%gmail.readonly%' AND google_scopes LIKE '%gmail.send%' AND lower(email)=lower('info@barrerabrokers.com')`;
  if(!account.length)throw Error('Conectá el correo de MIA con permisos de envío y lectura de respuestas antes de iniciar el piloto.');
  await tx`SELECT id FROM crm_whatsapp_conversations WHERE lead_id=ANY(${ids}::uuid[]) AND channel='whatsapp' ORDER BY id FOR UPDATE`;
  const leads=await tx`SELECT l.*,COALESCE(NULLIF(l.development_name_text,''),d.name,'') project FROM crm_leads l LEFT JOIN developments d ON d.id=l.development_id
   WHERE l.id=ANY(${ids}::uuid[]) AND l.assigned_agent_id=${c.agent_id} FOR NO KEY UPDATE OF l`;
  if(leads.length!==ids.length)throw Error('Todos los contactos deben seguir asignados a MIA.');
  const run=randomUUID();
  await tx`UPDATE crm_mia_sales_control SET enabled=TRUE,run_id=${run},started_at=NOW(),updated_by=${actor} WHERE id=TRUE`;
  for(const lead of leads){
   await tx`UPDATE crm_whatsapp_conversations SET ai_enabled=TRUE,ai_assist_assigned=TRUE,status='open',assigned_agent_id=${c.agent_id} WHERE lead_id=${lead.id} AND channel='whatsapp' AND business_phone_number_id=${firstContactWhatsAppPhoneId()} AND (locked_until IS NULL OR locked_until<NOW())`;
   const content=miaSalesOpening(lead.first_name,lead.project);
   await tx`INSERT INTO crm_mia_sales_enrollments(lead_id,run_id,original_status) VALUES(${lead.id},${run},${lead.status})`;
   for(const channel of ['email','whatsapp'])await tx`INSERT INTO crm_mia_sales_jobs(id,run_id,lead_id,channel,kind,source_key,subject,content,due_at)
    VALUES(${randomUUID()},${run},${lead.id},${channel},'opening',${'opening:'+run+':'+lead.id+':'+channel},'¿Retomamos tu búsqueda? · Barrera Brokers',${content},${new Date(Date.now()+(channel==='whatsapp'?24*3600000:0)).toISOString()})`;
   await notifyMiaSales(tx,lead.id,'started:'+run+':'+lead.id,'MIA: contacto incorporado al piloto','Se conserva el estado previo. Email primero; WhatsApp al día siguiente si no hay respuesta y el canal lo permite.');
  }
  return {started:true,runId:run,contacts:ids.length};
 });}finally{await sql.end();}
}
export async function pauseMiaSalesPilot(actor:string,enabled:boolean){
 const sql=miaSalesDb();try{await sql.begin(async tx=>{
  const [c]=await tx`SELECT * FROM crm_mia_sales_control WHERE id=TRUE FOR UPDATE`;
  if(!c?.run_id)throw Error('Todavía no hay un piloto iniciado.');
  if(c.enabled===enabled)return;
  if(!enabled){
   const paused=await tx`UPDATE crm_whatsapp_conversations c SET ai_enabled=FALSE,updated_at=NOW() WHERE c.lead_id IN(SELECT lead_id FROM crm_mia_sales_enrollments WHERE run_id=${c.run_id}) AND c.assigned_agent_id=${c.agent_id} AND c.ai_enabled RETURNING c.id`;
   await tx`UPDATE crm_mia_sales_control SET enabled=FALSE,updated_by=${actor},paused_at=NOW(),paused_ai_ids=${paused.map(row=>row.id)}::uuid[] WHERE id=TRUE`;
  }else{
   await tx`UPDATE crm_whatsapp_conversations SET ai_enabled=TRUE,updated_at=NOW() WHERE id=ANY(${c.paused_ai_ids}::uuid[]) AND assigned_agent_id=${c.agent_id} AND updated_at=${c.paused_at} AND lead_id IN(SELECT lead_id FROM crm_mia_sales_enrollments WHERE run_id=${c.run_id} AND state='working')`;
   await tx`UPDATE crm_mia_sales_control SET enabled=TRUE,updated_by=${actor},paused_at=NULL,paused_ai_ids='{}' WHERE id=TRUE`;
  }
 });return {enabled};}finally{await sql.end();}
}
