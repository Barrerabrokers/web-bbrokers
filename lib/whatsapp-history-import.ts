import {createHash} from 'crypto';
import {getSharedDatabase,releaseSharedDatabase} from '@/lib/database-pool';
import {firstContactWhatsAppPhoneId} from '@/lib/whatsapp-inbox-scope';
import {ensureWhatsAppContact,saveWhatsAppMessage} from '@/lib/whatsapp-inbox';
export const WHATSAPP_HISTORY_SINCE = '2026-07-31T03:00:00.000Z';
const phoneKey = (value: unknown) => String(value || '').replace(/\D/g, '').replace(/^549(?=\d{10}$)/, '54');
/** Meta history carries both customer messages and Business App echoes. Never infer direction. */
export function primaryHistoryMessages(value:any,phoneId:string,since=Date.parse(WHATSAPP_HISTORY_SINCE)) {
 if(String(value.metadata?.phone_number_id||'')!==phoneId)return [];
 const entries: {phone:string;messageId:string;content:string;createdAt:string;direction:'inbound'|'outbound';senderType:'customer'|'agent'}[]=[];
 const business=phoneKey(value.metadata?.display_phone_number);
 for(const chunk of Array.isArray(value.history)?value.history:[])for(const thread of Array.isArray(chunk.threads)?chunk.threads:[]){
  const phone=String(thread.id||'').replace(/\D/g,'');const customer=phoneKey(phone);
  if(!/^\d{8,15}$/.test(phone)||customer===business)continue;
  for(const message of Array.isArray(thread.messages)?thread.messages:[]){
   if(typeof message.id!=='string')continue;
   const from=phoneKey(message.from),to=phoneKey(message.to);
   const inbound=from===customer&&(!to||!!business&&to===business);
   const outbound=!!business&&from===business&&to===customer;
   if(!inbound&&!outbound)continue;
   const milliseconds=Number(message.timestamp)*1000;
   if(!Number.isFinite(milliseconds)||milliseconds<Math.max(since,Date.UTC(2010,0,1))||milliseconds>Date.now()+300000)continue;
   let content=typeof message.text?.body==='string'?message.text.body:'';
   if(!content){const media=message[message.type]||{};const caption=typeof media.caption==='string'?media.caption:'';content=`[Mensaje ${String(message.type||'sin texto').slice(0,30)}${caption?`: ${caption}`:''}]`;}
   entries.push({phone,messageId:message.id,content:content.slice(0,20000),createdAt:new Date(milliseconds).toISOString(),direction:inbound?'inbound':'outbound',senderType:inbound?'customer':'agent'});
  }
 }
 return [...new Map(entries.map(entry=>[entry.messageId,entry])).values()].sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt));
}
/** Compatibility for callers requesting inbound records only. */
export function primaryHistoryIncoming(value:any,phoneId:string) {
 return primaryHistoryMessages(value,phoneId,0).filter(entry=>entry.direction==='inbound');
}
export async function storePrimaryHistoryWebhook(value:any) {
 if(String(value.metadata?.phone_number_id||'')!==firstContactWhatsAppPhoneId())return false;
 const sql=getSharedDatabase();try{
  const encoded=JSON.stringify(value);const id=createHash('sha256').update(encoded).digest('hex');
  await sql`INSERT INTO crm_whatsapp_history_import(id,phone_number_id,payload) VALUES(${id},${firstContactWhatsAppPhoneId()},${sql.json(value)}) ON CONFLICT(id) DO NOTHING`;
  const [record]=await sql`SELECT processed_at FROM crm_whatsapp_history_import WHERE id=${id}`;if(record?.processed_at)return true;
  for(const entry of primaryHistoryMessages(value,firstContactWhatsAppPhoneId())){
   const contact=await ensureWhatsAppContact(entry.phone,'',firstContactWhatsAppPhoneId());if(!contact)continue;
   await sql`UPDATE crm_whatsapp_conversations c SET assigned_agent_id=COALESCE(c.assigned_agent_id,l.assigned_agent_id) FROM crm_leads l WHERE c.id=${contact.id} AND c.lead_id=l.id`;
   // Historical import never activates AI or schedules a follow-up. Existing live chats keep their settings.
   await sql`UPDATE crm_whatsapp_conversations c SET ai_enabled=FALSE WHERE c.id=${contact.id} AND NOT EXISTS (SELECT 1 FROM crm_whatsapp_messages m WHERE m.conversation_id=c.id AND m.status NOT IN ('historical','recovered'))`;
   await saveWhatsAppMessage({conversationId:contact.id,whatsappMessageId:entry.messageId,direction:entry.direction,senderType:entry.senderType,content:entry.content,status:'recovered',createdAt:entry.createdAt,historical:true});
  }
  // Unrecognized payloads remain available for review instead of being marked complete.
  if(Array.isArray(value.history))await sql`UPDATE crm_whatsapp_history_import SET processed_at=NOW() WHERE id=${id}`;
  return true;
 }finally{await releaseSharedDatabase(sql);}
}
