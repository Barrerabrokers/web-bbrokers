import { randomUUID } from 'crypto';
import { getSharedDatabase,releaseSharedDatabase } from '@/lib/database-pool';
/** A recorded request is not a unit reservation and never reserves stock or takes a payment. */
export async function recordMiaReservationRequest(conversationId:string,inboundId:string,project:string,text:string){
 const sql=getSharedDatabase();try{await sql.begin(async tx=>{
  await tx`SELECT pg_advisory_xact_lock(hashtext(${'mia-reservation-request:'+conversationId}))`;
  const [current]=await tx`SELECT c.lead_id,m.id FROM crm_whatsapp_conversations c JOIN crm_whatsapp_messages m ON m.conversation_id=c.id WHERE c.id=${conversationId} AND c.ai_enabled=TRUE AND m.status NOT IN ('historical','cleared') ORDER BY m.created_at DESC,m.id DESC LIMIT 1`;
  if(!current?.lead_id||current.id!==inboundId)throw Error('Reservation request is not current');
  const key='mia-reservation-request:'+conversationId+':'+inboundId,body=JSON.stringify({project,customerRequest:text.slice(0,1000),status:'solicitud_pendiente',unitReserved:false});
  const admins=await tx`SELECT id FROM agents WHERE role='admin' AND active=TRUE`;if(!admins.length)throw Error('No administrators');
  await tx`INSERT INTO crm_activities(id,lead_id,type,title,body,external_source,external_id) VALUES(${randomUUID()},${current.lead_id},'nota','MIA: solicitud de pre-reserva',${body},'mia_reservation_request',${key}) ON CONFLICT(external_source,external_id) WHERE external_source IS NOT NULL AND external_id IS NOT NULL DO NOTHING`;
  for(const a of admins)await tx`INSERT INTO crm_notifications(id,recipient_agent_id,lead_id,event_key,type,title,body,href) VALUES(${randomUUID()},${a.id},${current.lead_id},${key+':'+a.id},'mia_reservation_request','MIA: solicitud de pre-reserva',${body},${'/admin/crm/'+current.lead_id}) ON CONFLICT(event_key) DO NOTHING`;
 });}finally{await releaseSharedDatabase(sql);}
}
