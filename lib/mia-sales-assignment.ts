import { randomUUID } from 'crypto';
import { firstContactWhatsAppPhoneId } from './whatsapp-inbox-scope';
import { notifyMiaSales } from './mia-sales-store';
import { getSalesEvidence } from './crm-sales-context';
import { analyzeMiaSalesHistory, type MiaSalesHistory } from './mia-sales-analysis';

// Reconciliation covers individual/bulk assignment, imports and integrations alike.
// Existing enrollments are never restarted by a cron (including opt-outs and manual stops).
export async function enrollAssignedMiaContacts(sql:any,leadIds?:string[]){
 if(leadIds&&!leadIds.length)return 0;
 return sql.begin(async(tx:any)=>{
  const [c]=await tx`SELECT c.* FROM crm_mia_sales_control c JOIN agents a ON a.id=c.agent_id WHERE c.id=TRUE AND c.enabled AND c.automatic_assignments AND a.active FOR UPDATE OF c`;
  if(!c?.run_id)return 0;
  const candidates=await tx`SELECT l.id FROM crm_leads l WHERE l.assigned_agent_id=${c.agent_id} AND (${leadIds===undefined} OR l.id=ANY(${leadIds||[]}::uuid[])) AND NOT EXISTS(SELECT 1 FROM crm_mia_sales_enrollments e WHERE e.lead_id=l.id) ORDER BY l.created_at,l.id LIMIT ${leadIds?.length||10}`;
  let count=0;
  for(const candidate of candidates){
   await tx`SELECT id FROM crm_whatsapp_conversations WHERE lead_id=${candidate.id} AND channel='whatsapp' ORDER BY id FOR UPDATE`;
   const [lead]=await tx`SELECT id,status FROM crm_leads WHERE id=${candidate.id} AND assigned_agent_id=${c.agent_id} FOR NO KEY UPDATE`;
   if(!lead)continue;
   const inserted=await tx`INSERT INTO crm_mia_sales_enrollments(lead_id,run_id,original_status) VALUES(${lead.id},${c.run_id},${lead.status}) ON CONFLICT(lead_id) DO NOTHING RETURNING lead_id`;
   if(!inserted.length)continue;
   await tx`UPDATE crm_mia_sales_control SET approved_lead_ids=array_append(approved_lead_ids,${lead.id}::uuid) WHERE id=TRUE AND NOT(${lead.id}::uuid=ANY(approved_lead_ids))`;
   // AI stays in its current state until the history analysis authorizes outreach.
   for(const channel of ['email','whatsapp'])await tx`INSERT INTO crm_mia_sales_jobs(id,run_id,lead_id,channel,kind,source_key,subject,content,due_at) VALUES(${randomUUID()},${c.run_id},${lead.id},${channel},'opening',${'opening:'+c.run_id+':'+lead.id+':'+channel},'Seguimos con tu consulta · Barrera Brokers','',NOW()) ON CONFLICT(source_key) DO NOTHING`;
   await notifyMiaSales(tx,lead.id,'assigned:'+c.run_id+':'+lead.id,'MIA: contacto asignado para analizar','Se revisarán notas, llamadas registradas, correos y WhatsApp antes de contactar. El estado del lead se conserva.');count++;
  }
  return count;
 });
}
export async function loadMiaSalesHistory(sql:any,id:string,agentId:string):Promise<MiaSalesHistory>{
 const [lead]=await sql`SELECT l.id,concat_ws(' ',l.first_name,l.last_name) name,l.notes,l.status,COALESCE(NULLIF(l.development_name_text,''),d.name,'') project FROM crm_leads l LEFT JOIN developments d ON d.id=l.development_id WHERE l.id=${id} AND l.assigned_agent_id=${agentId}`;
 if(!lead)throw Error('El contacto ya no pertenece a MIA.');
 const [evidence]=await getSalesEvidence([id],agentId,false,true,240);
 if(!evidence)throw Error('No se pudo consultar el historial del contacto.');
 // Include older call records/notes even when a long chat fills the recent timeline.
 const records=await sql`SELECT a.id::text,a.type tipo,a.title titulo,a.body detalle,a.created_at fecha,'registro' direccion FROM crm_activities a WHERE a.lead_id=${id} AND a.type IN('nota','llamada') AND a.external_source IS DISTINCT FROM 'mia_sales_analysis' ORDER BY a.created_at DESC LIMIT 160`;
 const events=new Map<string,any>();
 for(const e of [...evidence.events,...records])if(!/Análisis de MIA antes del seguimiento/.test(e.titulo))events.set(e.id,{...e,fecha:new Date(e.fecha).toISOString(),detalle:String(e.detalle||'').slice(0,6000)});
 return {lead:{...lead,notes:String(lead.notes||'').slice(0,24000)},events:[...events.values()].sort((a,b)=>Date.parse(b.fecha)-Date.parse(a.fecha)),total:evidence.total};
}
export async function prepareMiaSalesContact(sql:any,e:any,c:any,options:{followup?:boolean}={}){
 const history=await loadMiaSalesHistory(sql,e.lead_id,c.agent_id);
 const analysis=await analyzeMiaSalesHistory(history,new Date(),options);
 await sql.begin(async(tx:any)=>{
  const [control]=await tx`SELECT enabled,run_id FROM crm_mia_sales_control WHERE id=TRUE FOR SHARE`;
  if(!control?.enabled||control.run_id!==e.run_id)return;
  // Same conversation -> lead order as assignment paths.
  await tx`SELECT id FROM crm_whatsapp_conversations WHERE lead_id=${e.lead_id} AND channel='whatsapp' ORDER BY id FOR UPDATE`;
  const [lead]=await tx`SELECT assigned_agent_id FROM crm_leads WHERE id=${e.lead_id} FOR KEY SHARE`;
  if(lead?.assigned_agent_id!==c.agent_id)return;
  await tx`UPDATE crm_mia_sales_enrollments SET analysis=${tx.json(analysis)} WHERE lead_id=${e.lead_id} AND state='working'`;
  const body=[analysis.summary,'Decisión: '+analysis.action,'Motivo y próximo paso: '+analysis.reason,analysis.nextContactAt?'Retomar desde: '+analysis.nextContactAt:'',`Registros revisados: ${analysis.eventsRead}; total registrado: ${analysis.eventsTotal}. Llamadas: se analizan solo sus notas/resultados o transcripciones disponibles.`,analysis.evidenceIds.length?'Fuentes: '+analysis.evidenceIds.join(', '):'Sin referencias de actividad; consultar datos disponibles en la ficha.'].filter(Boolean).join('\n\n');
  await tx`INSERT INTO crm_activities(id,lead_id,type,title,body,created_by,external_source,external_id) VALUES(${randomUUID()},${e.lead_id},'nota','Análisis de MIA antes del seguimiento',${body},${c.agent_id},'mia_sales_analysis',${e.run_id+':'+e.lead_id+':'+analysis.analyzedAt}) ON CONFLICT(external_source,external_id) WHERE external_source IS NOT NULL AND external_id IS NOT NULL DO NOTHING`;
  if(analysis.action==='contact'){
   await tx`UPDATE crm_mia_sales_jobs SET content=${analysis.message},error='' WHERE lead_id=${e.lead_id} AND kind='opening' AND state IN('pending','blocked')`;
   if(options.followup)await tx`UPDATE crm_mia_sales_jobs SET content=${analysis.message},followup_anchor_at=${analysis.analyzedAt}::timestamptz,error='' WHERE lead_id=${e.lead_id} AND kind='followup' AND state IN('pending','blocked') AND due_at<=NOW()`;
   await tx`UPDATE crm_whatsapp_conversations SET ai_enabled=TRUE,ai_assist_assigned=TRUE,status='open',assigned_agent_id=${c.agent_id} WHERE lead_id=${e.lead_id} AND channel='whatsapp' AND business_phone_number_id=${firstContactWhatsAppPhoneId()} AND (ai_enabled OR updated_at<=${e.started_at}::timestamptz) AND (locked_until IS NULL OR locked_until<NOW())`;
  }else if(analysis.action==='wait'){
   await tx`UPDATE crm_mia_sales_jobs SET due_at=GREATEST(due_at,${analysis.nextContactAt}::timestamptz),error='Esperando la fecha fundada en el historial.' WHERE lead_id=${e.lead_id} AND state IN('pending','blocked')`;
  }else{
   await tx`UPDATE crm_mia_sales_enrollments SET state='stopped',reason=${analysis.reason},stopped_at=NOW() WHERE lead_id=${e.lead_id}`;
   await tx`UPDATE crm_mia_sales_jobs SET state='stopped',error=${analysis.reason} WHERE lead_id=${e.lead_id} AND state IN('pending','blocked')`;
  }
  if(analysis.action==='review'||analysis.action==='stop')await tx`UPDATE crm_whatsapp_conversations SET ai_enabled=FALSE WHERE lead_id=${e.lead_id} AND assigned_agent_id=${c.agent_id} AND channel='whatsapp'`;
  await notifyMiaSales(tx,e.lead_id,'analysis:'+e.run_id+':'+e.lead_id+':'+analysis.analyzedAt,'MIA: historial analizado',analysis.summary+'\n'+analysis.reason);
 });
 return analysis;
}

export async function assignedMiaSalesConversationContext(conversationId:string){
 const {miaSalesDb}=await import('./mia-sales-store');const sql=miaSalesDb();
 try{
  const [ready]=await sql`SELECT to_regclass('public.crm_mia_sales_control') IS NOT NULL ready`;if(!ready?.ready)return undefined;
  const [row]=await sql`SELECT e.lead_id,e.analysis,c.agent_id FROM crm_whatsapp_conversations w JOIN crm_mia_sales_enrollments e ON e.lead_id=w.lead_id JOIN crm_mia_sales_control c ON c.run_id=e.run_id JOIN crm_leads l ON l.id=e.lead_id WHERE w.id=${conversationId} AND c.enabled AND c.automatic_assignments AND e.state='working' AND l.assigned_agent_id=c.agent_id AND w.assigned_agent_id=c.agent_id`;
  if(!row)return undefined;
  const history=await loadMiaSalesHistory(sql,row.lead_id,row.agent_id);
  const events=history.events.slice(0,60).map(e=>({...e,detalle:e.detalle.slice(0,1600)}));
  const context={analysis:row.analysis?{summary:row.analysis.summary,reason:row.analysis.reason,action:row.analysis.action}:null,ficha:{...history.lead,notes:history.lead.notes.slice(0,6000)},history:events};
  while(JSON.stringify(context).length>24000&&context.history.length)context.history.pop();
  return JSON.stringify(context);
 }finally{await sql.end();}
}
