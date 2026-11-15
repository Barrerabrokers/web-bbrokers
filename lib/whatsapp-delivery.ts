import { createHash,randomUUID } from 'crypto';
import { miaSalesDb,notifyMiaSales } from './mia-sales-store';
export function nextWhatsAppDeliveryStatus(previous:string,incoming:string){
 if(previous==='read'||incoming==='read')return 'read';
 if(previous==='delivered'||incoming==='delivered')return 'delivered';
 if(previous==='failed'||incoming==='failed')return 'failed';
 return incoming==='sent'?'sent':previous;
}
export function parseWhatsAppDeliveryStatus(value:any,phoneId:string){
 if(!value||typeof value.id!=='string'||!value.id||value.id.length>512||!/^\d+$/.test(phoneId)||!['sent','delivered','read','failed'].includes(value.status))return null;
 const timestamp=Number(value.timestamp);if(!Number.isFinite(timestamp)||timestamp<=0||timestamp*1000>Date.now()+86400000)return null;
 const code=Number(value.errors?.[0]?.code),errorCode=Number.isSafeInteger(code)&&code>0?code:null;
 const details=String(value.errors?.[0]?.error_data?.details||value.errors?.[0]?.message||value.errors?.[0]?.title||'').replace(/[\r\n]/g,' ').slice(0,1500);
 return {messageId:value.id,status:value.status,phoneId,at:new Date(timestamp*1000).toISOString(),errorCode,details,key:createHash('sha256').update([value.id,phoneId,value.status,timestamp].join(':')).digest('hex')};
}
export async function applyWhatsAppDeliveryStatus(sql:any,messageId:string){
 const [event]=await sql`SELECT e.* FROM crm_whatsapp_delivery_events e JOIN crm_whatsapp_messages m ON m.whatsapp_message_id=e.message_id JOIN crm_whatsapp_conversations c ON c.id=m.conversation_id AND c.business_phone_number_id=e.business_phone_number_id WHERE e.message_id=${messageId} AND m.direction='outbound' ORDER BY CASE e.status WHEN 'read' THEN 4 WHEN 'delivered' THEN 3 WHEN 'failed' THEN 2 ELSE 1 END DESC,e.event_at DESC LIMIT 1`;
 if(!event)return false;
 const [message]=await sql`SELECT m.id,m.status,c.lead_id FROM crm_whatsapp_messages m JOIN crm_whatsapp_conversations c ON c.id=m.conversation_id WHERE m.whatsapp_message_id=${messageId} AND m.direction='outbound' AND c.business_phone_number_id=${event.business_phone_number_id} FOR UPDATE OF m`;
 if(!message)return false;
 const next=nextWhatsAppDeliveryStatus(message.status,event.status);
 await sql`UPDATE crm_whatsapp_messages SET status=${next} WHERE id=${message.id}`;
 const jobs=await sql`SELECT j.id,j.lead_id,c.agent_id FROM crm_mia_sales_jobs j JOIN crm_mia_sales_control c ON c.run_id=j.run_id WHERE j.provider_id=${messageId} AND j.channel='whatsapp' AND j.lead_id=${message.lead_id}`;
 for(const job of jobs){
  if(next==='failed'){
   const reason='Meta no entregó el WhatsApp'+(event.error_code?' ('+event.error_code+')':'')+': '+(event.error_details||'El proveedor informó un fallo.');
   await sql`UPDATE crm_mia_sales_jobs SET state='review',error=${reason} WHERE id=${job.id}`;
   await notifyMiaSales(sql,job.lead_id,'delivery-failed:'+messageId,'MIA: WhatsApp no entregado',reason+' No se reenvía automáticamente.');
   await sql`INSERT INTO crm_activities(id,lead_id,type,title,body,created_by,external_source,external_id) VALUES(${randomUUID()},${job.lead_id},'nota','MIA: WhatsApp no entregado',${reason},${job.agent_id},'whatsapp_delivery',${messageId+':failed'}) ON CONFLICT(external_source,external_id) WHERE external_source IS NOT NULL AND external_id IS NOT NULL DO NOTHING`;
  }else if(next==='delivered'||next==='read')await sql`UPDATE crm_mia_sales_jobs SET state='sent',error='' WHERE id=${job.id} AND (error='' OR error LIKE 'Meta no entregó el WhatsApp%' OR error LIKE 'Entrega no confirmada:%')`;
 }
 return next==='read'&&message.status!=='read';
}
export async function recordWhatsAppDeliveryStatus(value:any,phoneId:string){
 const event=parseWhatsAppDeliveryStatus(value,phoneId);if(!event)return false;
 const sql=miaSalesDb();try{return await sql.begin(async tx=>{
  await tx`INSERT INTO crm_whatsapp_delivery_events(event_key,message_id,business_phone_number_id,status,event_at,error_code,error_details) VALUES(${event.key},${event.messageId},${event.phoneId},${event.status},${event.at},${event.errorCode},${event.details}) ON CONFLICT(event_key) DO NOTHING`;
  return applyWhatsAppDeliveryStatus(tx,event.messageId);
 });}finally{await sql.end();}
}
export async function reconcileWhatsAppDelivery(messageId:string){
 const sql=miaSalesDb();try{await sql.begin(tx=>applyWhatsAppDeliveryStatus(tx,messageId));}finally{await sql.end();}
}
