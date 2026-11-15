import { getSharedDatabase, releaseSharedDatabase } from '@/lib/database-pool';
import { firstContactWhatsAppPhoneId } from '@/lib/whatsapp-inbox-scope';
import { agentMemorySchema } from '@/lib/mia-agent-search';

/** Explicit projection: never expose credentials from the general settings table. */
export async function readMiaWorkspace(input:{section:'contacts'|'detail'|'learnings'|'meetings';q:string;page:number;leadId?:string}){
 const sql=getSharedDatabase();
 try{
  if(input.section==='learnings'){
   const rows=await sql`SELECT id,lead_id,fecha,perfil,boton_caliente,resumen_conversacion,que_funciono,que_fallo,correccion_recibida,regla_nueva,aplicar_en_futuro,approved_by IS NOT NULL AS approved FROM mia_learnings WHERE (${!input.q} OR regla_nueva ILIKE ${'%'+input.q+'%'} OR correccion_recibida ILIKE ${'%'+input.q+'%'}) ORDER BY fecha DESC,id DESC LIMIT 41 OFFSET ${input.page*40}`;
   return {items:rows.slice(0,40),hasMore:rows.length>40};
  }
  const rows=await sql`SELECT l.id,l.first_name,l.last_name,l.email,l.phone,l.status,l.temperature,l.source,l.notes,a.name AS agent_name,c.id AS conversation_id,c.contact_name,c.ai_enabled,c.last_message_at,ms.state AS meeting
   FROM crm_leads l LEFT JOIN agents a ON a.id=l.assigned_agent_id
   LEFT JOIN LATERAL(SELECT id,contact_name,ai_enabled,last_message_at FROM crm_whatsapp_conversations WHERE lead_id=l.id AND channel='whatsapp' AND business_phone_number_id=${firstContactWhatsAppPhoneId()} ORDER BY last_message_at DESC NULLS LAST,id DESC LIMIT 1)c ON TRUE
   LEFT JOIN crm_mia_meeting_sessions ms ON ms.conversation_id=c.id
   WHERE (c.id IS NOT NULL OR l.assigned_agent_id=(SELECT agent_id FROM crm_mia_sales_control WHERE id=TRUE))
   AND (${input.leadId||null}::uuid IS NULL OR l.id=${input.leadId||null}::uuid)
   AND (${input.section!=='meetings'} OR ms.state IS NOT NULL)
   AND (${!input.q} OR concat_ws(' ',l.first_name,l.last_name,l.email,l.phone) ILIKE ${'%'+input.q+'%'})
   ORDER BY c.last_message_at DESC NULLS LAST,l.id LIMIT 41 OFFSET ${input.page*40}`;
  if(input.section!=='detail')return {items:rows.slice(0,40).map(({notes,...row})=>row),hasMore:rows.length>40};
  const contact=rows[0];if(!contact)return null;
  const [memoryRow]=contact.conversation_id?await sql`SELECT value,updated_at FROM crm_whatsapp_agent_settings WHERE key=${'mia-agent-memory-v1:'+contact.conversation_id}`:[];
  let memory=null;try{const parsed=agentMemorySchema.safeParse(JSON.parse(memoryRow?.value||'null')?.memory);if(parsed.success)memory=parsed.data;}catch{}
  const messages=contact.conversation_id?await sql`SELECT id,content,direction,sender_type,status,created_at FROM crm_whatsapp_messages WHERE conversation_id=${contact.conversation_id} AND status NOT IN('historical','cleared') ORDER BY created_at DESC,id DESC LIMIT 100`:[];
  const activities=await sql`SELECT id,type,title,body,scheduled_at,created_at FROM crm_activities WHERE lead_id=${contact.id} ORDER BY created_at DESC,id DESC LIMIT 40`;
  return {contact,memory,memoryUpdatedAt:memoryRow?.updated_at||null,messages:messages.reverse(),activities};
 }finally{await releaseSharedDatabase(sql);}
}
