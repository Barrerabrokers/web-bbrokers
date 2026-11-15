import { firstContactWhatsAppPhoneId } from './whatsapp-inbox-scope';
import { randomUUID } from 'crypto';
import { miaSalesDecline } from './mia-sales-policy';
import { notifyMiaSales } from './mia-sales-store';
/** Called inside the existing message transaction; historical imports never call it. */
export async function recordMiaSalesWhatsAppInteraction(sql:any,input:{conversationId:string;messageId:string;direction:string;content:string;ai:boolean}){
 const [ready]=await sql`SELECT to_regclass('public.crm_mia_sales_control') IS NOT NULL ready`;if(!ready.ready)return;
 const [pilot]=await sql`SELECT e.lead_id,c.agent_id FROM crm_mia_sales_enrollments e JOIN crm_mia_sales_control c ON c.run_id=e.run_id
 JOIN crm_whatsapp_conversations w ON w.lead_id=e.lead_id JOIN crm_leads l ON l.id=e.lead_id
 WHERE w.id=${input.conversationId} AND w.channel='whatsapp' AND w.business_phone_number_id=${firstContactWhatsAppPhoneId()} AND l.assigned_agent_id=c.agent_id AND e.state='working'`;
 if(!pilot)return;
 await notifyMiaSales(sql,pilot.lead_id,'whatsapp:'+input.messageId,input.direction==='inbound'?'MIA: respuesta por WhatsApp':'MIA: mensaje por WhatsApp',input.content);
 if(input.ai&&input.direction==='outbound'){
  await sql`INSERT INTO crm_activities(id,lead_id,type,title,body,scheduled_at,created_by,external_source,external_id)
   VALUES(${randomUUID()},${pilot.lead_id},'whatsapp','WhatsApp enviado: MIA',${input.content},NOW(),${pilot.agent_id},'mia_sales_pilot',${input.messageId})
   ON CONFLICT(external_source,external_id) WHERE external_source IS NOT NULL AND external_id IS NOT NULL DO NOTHING`;
 }
 if(input.direction==='inbound'&&miaSalesDecline(input.content)){
  await sql`UPDATE crm_mia_sales_enrollments SET state='stopped',reason='El cliente pidió detener el contacto.',stopped_at=NOW() WHERE lead_id=${pilot.lead_id}`;
  await sql`UPDATE crm_mia_sales_jobs SET state='stopped',error='Pedido de no contacto.' WHERE lead_id=${pilot.lead_id} AND state IN('pending','blocked')`;
  await sql`UPDATE crm_whatsapp_conversations SET ai_enabled=FALSE WHERE id=${input.conversationId}`;
  await notifyMiaSales(sql,pilot.lead_id,'opt-out:'+input.messageId,'MIA: contacto detenido','El cliente rechazó continuar. No se enviarán nuevos mensajes automáticos.');
 }
}
