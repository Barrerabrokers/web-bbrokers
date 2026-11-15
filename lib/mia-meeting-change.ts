import { createHash,randomUUID } from 'crypto';
import { getSharedDatabase,releaseSharedDatabase } from '@/lib/database-pool';
import type { MeetingState,MeetingConfig } from '@/lib/mia-meeting-policy';
export function meetingChangeIntent(text:string){return /cancel|no (?:voy a )?p(?:uedo|oder) asistir|no voy a poder|no puedo ir|cambiar|cambiarla|pasar(?:la|lo)? (?:para|al)|reprogram|mover/i.test(text);}
/** Atomically preserve the original event, record the request and notify administrators. Never mutate Calendar. */
export async function recordMiaMeetingChange(conversationId:string,state:MeetingState,version:number,c:MeetingConfig,inboundId?:string){
 const request=state.changeRequest;if(!request)throw Error('Missing meeting request');
 const sql=getSharedDatabase();
 try{await sql.begin(async tx=>{
  await tx`SELECT pg_advisory_xact_lock(hashtext(${'mia-meeting-change:'+conversationId}))`;
  const [row]=await tx`SELECT lead_id FROM crm_whatsapp_conversations WHERE id=${conversationId}`;
  if(!row)throw Error('Conversation missing');
  if(inboundId){const [latest]=await tx`SELECT whatsapp_message_id FROM crm_whatsapp_messages WHERE conversation_id=${conversationId} AND status NOT IN ('historical','cleared') ORDER BY created_at DESC,id DESC LIMIT 1`;if(latest?.whatsapp_message_id!==inboundId)throw Error('Stale meeting request');}
  const key='mia-meeting-change:'+state.id+':'+createHash('sha256').update(JSON.stringify({kind:request.kind,text:request.text,selected:request.selected})).digest('hex').slice(0,24);
  const body=JSON.stringify({original:{eventId:state.eventId,activityId:state.activityId,selected:state.selected,mode:state.mode},requested:request});
  const updated=await tx`UPDATE crm_mia_meeting_sessions SET state=${tx.json(state)},version=version+1,updated_at=NOW() WHERE conversation_id=${conversationId} AND version=${version} RETURNING version`;
  if(!updated.length)throw Error('Meeting changed concurrently');
  if(row.lead_id)await tx`INSERT INTO crm_activities(id,lead_id,type,title,body,created_by,external_source,external_id) VALUES(${randomUUID()},${row.lead_id},'nota',${request.kind==='cancel'?'Solicitud de cancelación de reunión':'Solicitud de cambio de reunión'},${body},${c.organizerId},'mia_meeting_change',${key}) ON CONFLICT(external_source,external_id) WHERE external_source IS NOT NULL AND external_id IS NOT NULL DO NOTHING`;
  const recipients=await tx`SELECT id FROM agents WHERE role='admin' AND active=TRUE`;
  if(!recipients.length)throw Error('No administrator available');
  for(const admin of recipients)await tx`INSERT INTO crm_notifications(id,recipient_agent_id,lead_id,event_key,type,title,body,href) VALUES(${randomUUID()},${admin.id},${row.lead_id||null},${key+':'+admin.id},'mia_meeting_change',${request.kind==='cancel'?'MIA: cancelación pendiente':'MIA: cambio de reunión pendiente'},${body},${row.lead_id?'/admin/crm/'+row.lead_id:'/admin/crm/marketing/whatsapp'}) ON CONFLICT(event_key) DO NOTHING`;
 });}finally{await releaseSharedDatabase(sql);}
}
