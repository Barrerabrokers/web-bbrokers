import { randomUUID } from 'crypto';
import { getSharedDatabase, releaseSharedDatabase } from '@/lib/database-pool';
import { ensureWhatsAppInboxSchema } from '@/lib/whatsapp-inbox';
import { ensureAiRetrySchema } from '@/lib/whatsapp-ai-retry';
import { ensureCorrectionSchema } from '@/lib/whatsapp-ai-correction';
import { listAiTraining } from '@/lib/crm-ai-training';
import { firstContactWhatsAppPhoneId } from '@/lib/whatsapp-inbox-scope';
import type { WhatsAppAttachment } from '@/lib/whatsapp-attachment-policy';
/** Removes CRM history atomically while preserving the contact, assignment and AI settings. */
export async function clearWhatsAppChat(conversationId:string,sendToken:string) {
  await Promise.all([ensureWhatsAppInboxSchema(),ensureAiRetrySchema(),ensureCorrectionSchema(),listAiTraining()]);
  const sql=getSharedDatabase();
  try{return await sql.begin(async tx=>{
    const [conversation]=await tx`SELECT id FROM crm_whatsapp_conversations WHERE id=${conversationId} AND channel='whatsapp' AND business_phone_number_id=${firstContactWhatsAppPhoneId()} AND reply_send_token=${sendToken}::uuid FOR UPDATE`;
    if(!conversation)throw new Error('No se pudo bloquear este chat para borrar los mensajes.');
    const attachments=await tx`SELECT attachment FROM crm_whatsapp_messages WHERE conversation_id=${conversationId} AND attachment IS NOT NULL`;
    await tx`DELETE FROM crm_ai_training WHERE id IN (SELECT id FROM crm_whatsapp_messages WHERE conversation_id=${conversationId} AND sender_type='ai')`;
    await tx`DELETE FROM crm_whatsapp_ai_corrections WHERE conversation_id=${conversationId}`;
    await tx`DELETE FROM crm_whatsapp_ai_retry WHERE conversation_id=${conversationId}`;
    await tx`DELETE FROM crm_whatsapp_messages WHERE conversation_id=${conversationId}`;
    await tx`UPDATE crm_leads SET meta_properties=COALESCE(meta_properties,'{}'::jsonb)-'crm_mia_sequence_v1',updated_at=NOW() WHERE id=(SELECT lead_id FROM crm_whatsapp_conversations WHERE id=${conversationId})`;
    const [marker]=await tx`INSERT INTO crm_whatsapp_messages (id,conversation_id,direction,sender_type,content,status) VALUES (${randomUUID()},${conversationId},'unknown','history','Mensajes anteriores borrados','cleared') RETURNING id,created_at`;
    await tx`UPDATE crm_whatsapp_conversations SET unread_count=0,last_message='Mensajes anteriores borrados',last_message_at=${marker.created_at},updated_at=NOW() WHERE id=${conversationId}`;
    return {message:{id:String(marker.id),conversationId,direction:'unknown' as const,senderType:'history' as const,content:'Mensajes anteriores borrados',status:'cleared',createdAt:new Date(marker.created_at).toISOString()},attachments:attachments.map(row=>row.attachment as WhatsAppAttachment).filter(attachment=>typeof attachment?.storagePath==='string'&&attachment.storagePath.startsWith(conversationId+'/'))};
  });}finally{await releaseSharedDatabase(sql);}
}
