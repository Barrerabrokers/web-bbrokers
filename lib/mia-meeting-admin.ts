import { createHash,randomUUID } from 'crypto';
import { getSharedDatabase,releaseSharedDatabase } from '@/lib/database-pool';
import type { MeetingState,MeetingConfig } from '@/lib/mia-meeting-policy';
/** One durable request and notification per request; never creates a Calendar event. */
export async function requestMiaMeetingAdmin(conversationId:string,state:MeetingState,version:number,c:MeetingConfig,inboundId?:string){
 const sql=getSharedDatabase();try{await sql.begin(async tx=>{
 const [conversation]=await tx`SELECT lead_id FROM crm_whatsapp_conversations WHERE id=${conversationId}`;if(!conversation)throw Error('Conversation missing');
 if(inboundId){const [latest]=await tx`SELECT whatsapp_message_id FROM crm_whatsapp_messages WHERE conversation_id=${conversationId} AND status NOT IN('historical','cleared') ORDER BY created_at DESC,id DESC LIMIT 1`;if(latest?.whatsapp_message_id!==inboundId)throw Error('Stale request');}
 state={...state,conversationState:'esperando_confirmacion'};
 const updated=version<0?await tx`INSERT INTO crm_mia_meeting_sessions(conversation_id,state) VALUES(${conversationId},${tx.json(state)}) ON CONFLICT DO NOTHING RETURNING version`:await tx`UPDATE crm_mia_meeting_sessions SET state=${tx.json(state)},version=version+1,updated_at=NOW() WHERE conversation_id=${conversationId} AND version=${version} RETURNING version`;
 if(!updated.length)throw Error('Concurrent request');
 const key='mia-meeting-exception:'+state.id+':'+createHash('sha256').update(state.adminRequest||'').digest('hex').slice(0,24);
 const body='Horario solicitado fuera de lunes a sábado 10:00–20:00: '+state.adminRequest+'. No se confirmó ni creó una reunión.';
 if(conversation.lead_id)await tx`INSERT INTO crm_activities(id,lead_id,type,title,body,created_by,external_source,external_id) VALUES(${randomUUID()},${conversation.lead_id},'nota','MIA: horario pendiente de administración',${body},${c.organizerId},'mia_meeting_exception',${key}) ON CONFLICT(external_source,external_id) WHERE external_source IS NOT NULL AND external_id IS NOT NULL DO NOTHING`;
 const admins=await tx`SELECT id FROM agents WHERE role='admin' AND active=TRUE`;if(!admins.length)throw Error('No administrator');
 for(const admin of admins)await tx`INSERT INTO crm_notifications(id,recipient_agent_id,lead_id,event_key,type,title,body,href) VALUES(${randomUUID()},${admin.id},${conversation.lead_id||null},${key+':'+admin.id},'mia_meeting_exception','MIA: horario pendiente de aprobación',${body},'/admin/crm/mia?section=reuniones') ON CONFLICT(event_key) DO NOTHING`;
 });}finally{await releaseSharedDatabase(sql);}
}
