import {getSharedDatabase,releaseSharedDatabase} from '@/lib/database-pool';
import {firstContactWhatsAppPhoneId} from '@/lib/whatsapp-inbox-scope';
import {getWhatsAppConversation,listWhatsAppMessages,sendWhatsAppText,saveWhatsAppMessage} from '@/lib/whatsapp-inbox';
import {getWhatsAppChannelCredentials} from '@/lib/whatsapp-credentials';
import {reactivationEligibility} from '@/lib/whatsapp-reactivation-policy';
/** Welcome-only mode disables the former automatic sales reactivation campaign. */
export async function processWhatsAppReactivation() {
 return {sent:0,blocked:0,review:0};
}

async function discoverReactivationTemplates(sql: ReturnType<typeof getSharedDatabase>) {
 const [pending]=await sql`SELECT count(*)::int AS count FROM crm_whatsapp_reactivation WHERE state='needs_template'`;
 if(!pending?.count)return;
 const [previous]=await sql`SELECT id FROM crm_whatsapp_reactivation_meta WHERE id='meta-account-audit-v3'`;
 if(previous)return;
 const saved=await getWhatsAppChannelCredentials();const token=process.env.META_ACCESS_TOKEN||process.env.WHATSAPP_ACCESS_TOKEN||saved?.accessToken;
 const version=process.env.WHATSAPP_GRAPH_VERSION||'v23.0';
 let data:Record<string,unknown>={};
 try{
  const r=await fetch(`https://graph.facebook.com/${version}/${firstContactWhatsAppPhoneId()}?fields=id,display_phone_number,is_on_biz_app`,{headers:{Authorization:`Bearer ${process.env.WHATSAPP_ACCESS_TOKEN||saved?.accessToken||token}`},signal:AbortSignal.timeout(10000)});
  const phone=await r.json();data.phone=r.ok?phone:{errorCode:phone.error?.code};
  const response=await fetch(`https://graph.facebook.com/${version}/me/businesses?fields=id,owned_whatsapp_business_accounts{id,phone_numbers{id},message_templates{name,status,language,category,components}}&limit=100`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000)});
  const result=await response.json();
  const accounts=(result.data||[]).flatMap((b:any)=>b.owned_whatsapp_business_accounts?.data||[]);
  const account=accounts.find((a:any)=>a.phone_numbers?.data?.some((p:any)=>p.id===firstContactWhatsAppPhoneId()));
  let accountId=account?.id||saved?.wabaId;
  if(!accountId){
   const debugResponse=await fetch(`https://graph.facebook.com/${version}/debug_token?input_token=${encodeURIComponent(process.env.WHATSAPP_ACCESS_TOKEN||saved?.accessToken||token||'')}`,{headers:{Authorization:`Bearer ${process.env.WHATSAPP_ACCESS_TOKEN||saved?.accessToken||token}`},signal:AbortSignal.timeout(10000)});
   const debug=await debugResponse.json();data.debugErrorCode=debug.error?.code||null;
   const candidates=[...new Set<string>((debug.data?.granular_scopes||[]).filter((s:any)=>s.scope==='whatsapp_business_management').flatMap((s:any)=>s.target_ids||[]))].slice(0,5);
   for(const id of candidates){const check=await fetch(`https://graph.facebook.com/${version}/${id}/phone_numbers?fields=id,display_phone_number`,{headers:{Authorization:`Bearer ${process.env.WHATSAPP_ACCESS_TOKEN||saved?.accessToken||token}`},signal:AbortSignal.timeout(10000)});const phones=await check.json();if(phones.data?.some((p:any)=>p.id===firstContactWhatsAppPhoneId())){accountId=id;break;}}
  }
  data.accountId=accountId||null;data.templates=account?.message_templates?.data||[];data.errorCode=result.error?.code||null;
  if(accountId){const templates=await fetch(`https://graph.facebook.com/${version}/${accountId}/message_templates?fields=name,status,language,category,components&limit=100`,{headers:{Authorization:`Bearer ${process.env.WHATSAPP_ACCESS_TOKEN||saved?.accessToken||token}`},signal:AbortSignal.timeout(10000)});const listed=await templates.json();data.templates=listed.data||[];data.templatesErrorCode=listed.error?.code||null;
   if(templates.ok&&!listed.data?.some((t:any)=>t.name==='bb_retomar_consulta_20261005')){
    const submission=await fetch(`https://graph.facebook.com/${version}/${accountId}/message_templates`,{method:'POST',headers:{Authorization:`Bearer ${process.env.WHATSAPP_ACCESS_TOKEN||saved?.accessToken||token}`,'Content-Type':'application/json'},body:JSON.stringify({name:'bb_retomar_consulta_20261005',language:'es_AR',category:'MARKETING',components:[{type:'BODY',text:'Hola {{1}}, somos Barrera Brokers. Retomamos tu consulta sobre {{2}}. ¿Te gustaría que continuemos asesorándote por acá? Si preferís no recibir mensajes, avisános.',example:{body_text:[['Mariana','un departamento de 2 ambientes y su financiación']]}}]}),signal:AbortSignal.timeout(15000)});data.templateSubmission={accepted:submission.ok,result:await submission.json()};
   }
  }
  const [oldAudit]=await sql`SELECT data FROM crm_whatsapp_reactivation_meta WHERE id='meta-account-audit-v2'`;
  if(oldAudit?.data?.historySync){data.historySync=oldAudit.data.historySync;}else{const sync=await fetch(`https://graph.facebook.com/${version}/${firstContactWhatsAppPhoneId()}/smb_app_data`,{method:'POST',headers:{Authorization:`Bearer ${process.env.WHATSAPP_ACCESS_TOKEN||saved?.accessToken||token}`,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',sync_type:'history'}),signal:AbortSignal.timeout(15000)});
  const syncResult=await sync.json();data.historySync={accepted:sync.ok,result:syncResult};}
 }catch{data.errorCode='metadata_unavailable';}
 await sql`INSERT INTO crm_whatsapp_reactivation_meta(id,data) VALUES('meta-account-audit-v3',${sql.json(JSON.parse(JSON.stringify(data)))}) ON CONFLICT(id) DO NOTHING`;
}

async function processReactivationTemplates(sql: ReturnType<typeof getSharedDatabase>) {
 const [meta]=await sql`SELECT data FROM crm_whatsapp_reactivation_meta WHERE id='meta-account-audit-v3'`;
 if(!meta?.data?.accountId)return 0;
 const saved=await getWhatsAppChannelCredentials();const token=process.env.WHATSAPP_ACCESS_TOKEN||saved?.accessToken||process.env.META_ACCESS_TOKEN;const version=process.env.WHATSAPP_GRAPH_VERSION||'v23.0';
 const r=await fetch(`https://graph.facebook.com/${version}/${meta.data.accountId}/message_templates?name=bb_retomar_consulta_20261005&fields=name,status,language&limit=10`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(10000)});const data=await r.json();
 const template=data.data?.find((t:any)=>t.name==='bb_retomar_consulta_20261005');
 await sql`INSERT INTO crm_whatsapp_reactivation_meta(id,data) VALUES('template-status',${sql.json({status:template?.status||'not_found',errorCode:data.error?.code||null})}) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,updated_at=NOW()`;
 if(template?.status!=='APPROVED')return 0;
 let sent=0;const jobs=await sql`SELECT * FROM crm_whatsapp_reactivation WHERE state='needs_template' AND template_topic IS NOT NULL LIMIT 20`;
 for(const job of jobs){let sending=false;try{
  const c=await getWhatsAppConversation(job.conversation_id);if(!c||c.businessPhoneNumberId!==firstContactWhatsAppPhoneId())continue;
  const history=(await listWhatsAppMessages(c.id,200)).filter(m=>m.status!=='historical');const incoming=history.filter(m=>m.direction==='inbound');const [lead]=await sql`SELECT status FROM crm_leads WHERE id=${c.leadId||null}`;
  const eligibility=reactivationEligibility({businessPhoneNumberId:c.businessPhoneNumberId,primaryPhoneId:firstContactWhatsAppPhoneId(),status:c.status,leadStatus:lead?.status,lastInbound:incoming.at(-1)?.createdAt,customerTexts:incoming.map(m=>m.content),lockedUntil:c.lockedUntil});
  if(!['text','template'].includes(eligibility)||history.at(-1)?.id!==job.last_message_id){await sql`UPDATE crm_whatsapp_reactivation SET state='skipped',error_code='conversation_changed' WHERE conversation_id=${c.id}`;continue;}
  const [claim]=await sql`UPDATE crm_whatsapp_reactivation SET state='review' WHERE conversation_id=${c.id} AND state='needs_template' RETURNING conversation_id`;if(!claim)continue;
  sending=true;const name=c.contactName.split(/\s+/)[0].slice(0,80)||'¿cómo estás?';
  const response=await fetch(`https://graph.facebook.com/${version}/${firstContactWhatsAppPhoneId()}/messages`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to:c.phone,type:'template',template:{name:template.name,language:{code:template.language},components:[{type:'body',parameters:[{type:'text',text:name},{type:'text',text:job.template_topic}]}]}}),signal:AbortSignal.timeout(20000)});
  const result=await response.json();const id=result.messages?.[0]?.id;if(!response.ok||!id)throw new Error('Template delivery not confirmed');
  const text=`Hola ${name}, somos Barrera Brokers. Retomamos tu consulta sobre ${job.template_topic}. ¿Te gustaría que continuemos asesorándote por acá? Si preferís no recibir mensajes, avisános.`;
  await saveWhatsAppMessage({conversationId:c.id,whatsappMessageId:id,direction:'outbound',senderType:'ai',content:text});
  await sql.begin(async tx=>{await tx`UPDATE crm_whatsapp_reactivation SET state='sent',error_code=NULL,whatsapp_message_id=${id},sent_at=NOW() WHERE conversation_id=${c.id}`;await tx`UPDATE crm_whatsapp_conversations SET ai_enabled=TRUE,ai_assist_assigned=TRUE,updated_at=NOW() WHERE id=${c.id}`;});sent++;
 }catch{if(sending)await sql`UPDATE crm_whatsapp_reactivation SET state='review',error_code='template_delivery_requires_review' WHERE conversation_id=${job.conversation_id}`;}}
 return sent;
}
