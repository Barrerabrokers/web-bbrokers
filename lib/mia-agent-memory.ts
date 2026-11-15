import { randomUUID } from 'crypto';
import { persistMiaCommercialProfile } from '@/lib/mia-commercial-profile';
import { getSharedDatabase, releaseSharedDatabase } from '@/lib/database-pool';
import { agentMemorySchema, emptyAgentMemory, type AgentMemory } from '@/lib/mia-agent-search';
export async function readAgentMemory(conversationId:string,scope:string):Promise<AgentMemory>{
 const sql=getSharedDatabase();try{
  const [row]=await sql`SELECT value FROM crm_whatsapp_agent_settings WHERE key=${'mia-agent-memory-v1:'+conversationId}`;
  const value=row?JSON.parse(row.value):null;
  return value?.scope===scope?agentMemorySchema.parse(value.memory):emptyAgentMemory();
 }catch{return emptyAgentMemory();}finally{await releaseSharedDatabase(sql);}
}
/** Only the current inbound turn may persist preferences. No prices or source copy are stored. */
export async function writeAgentMemory(conversationId:string,scope:string,inboundId:string,memory:AgentMemory,persistProfile=true){
 const sql=getSharedDatabase();try{return await sql.begin(async tx=>{
  await tx`SELECT pg_advisory_xact_lock(hashtext(${'mia-agent-memory:'+conversationId}))`;
  const [latest]=await tx`SELECT m.id FROM crm_whatsapp_messages m JOIN crm_whatsapp_conversations c ON c.id=m.conversation_id
    WHERE m.conversation_id=${conversationId} AND m.status NOT IN ('historical','cleared') AND c.ai_enabled=TRUE
    ORDER BY m.created_at DESC,m.id DESC LIMIT 1`;
  if(latest?.id!==inboundId)return false;
  const validated=agentMemorySchema.parse(memory);
  if(persistProfile)await persistMiaCommercialProfile(tx,conversationId,inboundId,validated.preferences,validated.pendingQuestions,validated.deliveryPreference);
  if(persistProfile&&validated.deferredContact){
    const [conversation]=await tx`SELECT lead_id FROM crm_whatsapp_conversations WHERE id=${conversationId}`;
    if(conversation?.lead_id){
     const hold=JSON.stringify(validated.deferredContact),holdKey='mia-contact-hold:'+conversation.lead_id;
     await tx`INSERT INTO crm_whatsapp_agent_settings(key,value) VALUES(${holdKey},${hold}) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()`;
     if(validated.deferredContact.active&&validated.deferredContact.confirmed){
      const key='mia-deferred-contact:'+conversationId+':'+validated.deferredContact.requestedAt;
      const body='Pedido del cliente: '+validated.deferredContact.requestedText+'. Retomar por este WhatsApp con un agente comercial. Confirmar fecha antes de reactivar seguimiento automático. Preferencias: '+JSON.stringify(validated.preferences);
      await tx`INSERT INTO crm_activities(id,lead_id,type,title,body,external_source,external_id) VALUES(${randomUUID()},${conversation.lead_id},'nota','MIA: retomar más adelante',${body},'mia_deferred_contact',${key}) ON CONFLICT(external_source,external_id) WHERE external_source IS NOT NULL AND external_id IS NOT NULL DO NOTHING`;
      const admins=await tx`SELECT id FROM agents WHERE role='admin' AND active=TRUE`;
      for(const admin of admins)await tx`INSERT INTO crm_notifications(id,recipient_agent_id,lead_id,event_key,type,title,body,href) VALUES(${randomUUID()},${admin.id},${conversation.lead_id},${key+':'+admin.id},'mia_deferred_contact','MIA: seguimiento solicitado para más adelante',${body},${'/admin/crm/'+conversation.lead_id}) ON CONFLICT(event_key) DO NOTHING`;
     }
    }
   }
   const value=JSON.stringify({scope,memory:validated});
  await tx`INSERT INTO crm_whatsapp_agent_settings(key,value) VALUES(${'mia-agent-memory-v1:'+conversationId},${value}) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()`;
  return true;
 });}finally{await releaseSharedDatabase(sql);}
}
