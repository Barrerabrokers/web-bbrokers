import { getSharedDatabase, releaseSharedDatabase } from '@/lib/database-pool';
import { listAiTraining } from '@/lib/crm-ai-training';
let schema: Promise<void> | undefined;
export async function ensureCorrectionSchema() {
  if (!schema) schema=(async()=>{const sql=getSharedDatabase();try{await sql`CREATE TABLE IF NOT EXISTS crm_whatsapp_ai_corrections (id UUID PRIMARY KEY, conversation_id UUID NOT NULL, source_message_id UUID NOT NULL, actor_id UUID NOT NULL, answer TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'sending', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;}finally{await releaseSharedDatabase(sql);}})().catch(e=>{schema=undefined;throw e;});
  await schema;
}
export async function prepareAiCorrection(id:string,conversationId:string,sourceId:string,actor:string,answer:string) {
  await listAiTraining(); await ensureCorrectionSchema(); const sql=getSharedDatabase();
  try{return await sql.begin(async tx=>{
    await tx`SELECT pg_advisory_xact_lock(74102604)`;
    const [previous]=await tx`SELECT * FROM crm_whatsapp_ai_corrections WHERE id=${id}`;
    if(previous){if(previous.conversation_id!==conversationId||previous.source_message_id!==sourceId||previous.actor_id!==actor||previous.answer!==answer)throw new Error('La corrección no coincide con el envío original.');if(previous.state==='sent')return 'sent';throw new Error('Este envío ya fue iniciado. Verificá el historial antes de volver a enviar.');}
    const [original]=await tx`SELECT q.content AS question FROM crm_whatsapp_messages ai JOIN LATERAL (SELECT content FROM crm_whatsapp_messages q WHERE q.conversation_id=ai.conversation_id AND q.direction='inbound' AND q.sender_type='customer' AND q.status<>'historical' AND (q.created_at,q.id)<(ai.created_at,ai.id) ORDER BY q.created_at DESC,q.id DESC LIMIT 1) q ON TRUE WHERE ai.id=${sourceId} AND ai.conversation_id=${conversationId} AND ai.direction='outbound' AND ai.sender_type='ai' AND ai.status<>'historical'`;
    if(!original?.question)throw new Error('No se encontró la consulta original de esta respuesta.');
    await tx`INSERT INTO crm_ai_training (id,question,answer,context,enabled,created_by) VALUES (${sourceId},${original.question.slice(0,1500)},${answer},'Corrección aprobada por administrador para esta consulta. Aplicar solo al mismo proyecto y contexto; verificar precios y condiciones actuales.',TRUE,${actor}) ON CONFLICT (id) DO UPDATE SET question=EXCLUDED.question,answer=EXCLUDED.answer,context=EXCLUDED.context,enabled=TRUE,expires_at=NULL,updated_at=NOW()`;
    await tx`INSERT INTO crm_whatsapp_ai_corrections (id,conversation_id,source_message_id,actor_id,answer) VALUES (${id},${conversationId},${sourceId},${actor},${answer})`;
    return 'sending';
  });}finally{await releaseSharedDatabase(sql);}
}
export async function finishAiCorrection(id:string,state:'sent'|'uncertain') {const sql=getSharedDatabase();try{await sql`UPDATE crm_whatsapp_ai_corrections SET state=${state} WHERE id=${id}`;}finally{await releaseSharedDatabase(sql);}}
