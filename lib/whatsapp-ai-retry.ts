import { waitForWhatsAppReplyDelay } from '@/lib/whatsapp-reply-delay';
import { finishMiaPublicHandoff } from '@/lib/mia-reset-runtime';
import { splitMiaReplyMessages } from '@/lib/mia-reply-messages';
import { canMiaContinue } from '@/lib/whatsapp-mia-conversation';
import { claimWhatsAppAiSend, releaseWhatsAppSend } from '@/lib/whatsapp-turn-lock';
import { firstContactWhatsAppPhoneId } from "@/lib/whatsapp-inbox-scope";
import { getSharedDatabase, releaseSharedDatabase } from '@/lib/database-pool';
import { getWhatsAppConversation, listWhatsAppMessages, generateWhatsAppAiReply, sendWhatsAppText, saveWhatsAppMessage } from '@/lib/whatsapp-inbox';
let ready: Promise<void> | undefined;
export async function ensureAiRetrySchema() {
  if (!ready) ready=(async()=>{const sql=getSharedDatabase();try {await sql`CREATE TABLE IF NOT EXISTS crm_whatsapp_ai_retry (message_id TEXT PRIMARY KEY, conversation_id UUID NOT NULL REFERENCES crm_whatsapp_conversations(id) ON DELETE CASCADE, attempts INT NOT NULL DEFAULT 0, state TEXT NOT NULL DEFAULT 'pending', next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), error_code TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;await sql`ALTER TABLE crm_whatsapp_ai_retry ENABLE ROW LEVEL SECURITY`;}finally{await releaseSharedDatabase(sql);}})().catch(e=>{ready=undefined;throw e;});await ready;
}
export async function queueWhatsAppAiRetry(conversationId:string,messageId:string, options?:{notBefore:Date;reason:string}) {
  await ensureAiRetrySchema();const sql=getSharedDatabase();try{await sql`INSERT INTO crm_whatsapp_ai_retry (message_id,conversation_id,error_code,next_attempt_at) VALUES (${messageId},${conversationId},${options?.reason||'provider_unavailable'},${options?.notBefore||new Date()}) ON CONFLICT (message_id) DO NOTHING`;}finally{await releaseSharedDatabase(sql);}
}
export async function finishWhatsAppAiRetry(messageId:string,state:'sent'|'skipped'|'review') {
 const sql=getSharedDatabase();try{await sql`UPDATE crm_whatsapp_ai_retry SET state=${state} WHERE message_id=${messageId} AND state IN('pending','processing')`;}finally{await releaseSharedDatabase(sql);}
}
export async function processWhatsAppAiRetries() {
  await ensureAiRetrySchema();const sql=getSharedDatabase();let sent=0,skipped=0,failed=0;
  try {
    const jobs=await sql`UPDATE crm_whatsapp_ai_retry SET state='processing',next_attempt_at=NOW()+INTERVAL '10 minutes' WHERE message_id IN (SELECT message_id FROM crm_whatsapp_ai_retry WHERE ((state='pending' AND next_attempt_at<=NOW()) OR (state='processing' AND next_attempt_at<=NOW())) AND attempts<5 ORDER BY created_at LIMIT 5 FOR UPDATE SKIP LOCKED) RETURNING *`;
    for (const job of jobs) {
      let sending=false;
      let sendToken:string|null=null;
      try {
        const conversation=await getWhatsAppConversation(job.conversation_id);const history=await listWhatsAppMessages(job.conversation_id,30);const last=history.filter(m=>m.status!=="historical").at(-1);
        if (!conversation?.aiEnabled || conversation.status==='closed' || conversation.channel!=='whatsapp' || conversation.businessPhoneNumberId!==firstContactWhatsAppPhoneId() || !last || last.direction!=='inbound' || last.whatsappMessageId!==job.message_id || Date.parse(last.createdAt)<Date.now()-23*60*60*1000) {await sql`UPDATE crm_whatsapp_ai_retry SET state='skipped' WHERE message_id=${job.message_id}`;skipped++;continue;}
        if(conversation.lockedUntil&&Date.parse(conversation.lockedUntil)>Date.now()){await sql`UPDATE crm_whatsapp_ai_retry SET state='pending',next_attempt_at=NOW()+INTERVAL '1 minute' WHERE message_id=${job.message_id}`;continue;}
        await waitForWhatsAppReplyDelay(last.createdAt);
        const refreshed=(await listWhatsAppMessages(conversation.id,10)).filter(m=>!["historical","cleared"].includes(m.status)).at(-1);
        if(refreshed?.id!==last.id){await finishWhatsAppAiRetry(job.message_id,'skipped');skipped++;continue;}
        const reply=await generateWhatsAppAiReply(history);
        if (!reply) {await sql`UPDATE crm_whatsapp_ai_retry SET state='skipped' WHERE message_id=${job.message_id}`;skipped++;continue;}
        const current=await getWhatsAppConversation(conversation.id);const latest=(await listWhatsAppMessages(conversation.id,10)).filter(m=>m.status!=="historical").at(-1);
        if (!current || latest?.id!==last.id) {await sql`UPDATE crm_whatsapp_ai_retry SET state='skipped' WHERE message_id=${job.message_id}`;skipped++;continue;}
        sendToken=await claimWhatsAppAiSend(conversation.id,job.message_id);
        if(!sendToken){await sql`UPDATE crm_whatsapp_ai_retry SET state='pending',next_attempt_at=NOW()+INTERVAL '1 minute' WHERE message_id=${job.message_id}`;continue;}
        await sql`UPDATE crm_whatsapp_ai_retry SET state='review' WHERE message_id=${job.message_id}`;
        sending=true;
        for (const part of splitMiaReplyMessages(reply)) {
          const outboundId=await sendWhatsAppText(conversation.phone,part,conversation.businessPhoneNumberId);
          await saveWhatsAppMessage({conversationId:conversation.id,whatsappMessageId:outboundId,direction:'outbound',senderType:'ai',content:part});
          if (part.startsWith('Sí, acá te lo mando: https://') || part.startsWith('Opción 1: ')) {
            const {markMiaBrochureSent, markMiaOptionsSent} = await import('@/mia/lib/whatsapp-flow');
            await markMiaBrochureSent(job.message_id, part);
            await markMiaOptionsSent(job.message_id, part);
          }
        }
        await finishMiaPublicHandoff(conversation.id,last.content);
        await sql`UPDATE crm_whatsapp_ai_retry SET state='sent' WHERE message_id=${job.message_id}`;sent++;
      } catch {await sql`UPDATE crm_whatsapp_ai_retry SET state=${sending?'review':'pending'},attempts=attempts+1,error_code=${sending?'delivery_requires_review':'provider_unavailable'},next_attempt_at=date_trunc('minute',NOW())+INTERVAL '4 minutes' WHERE message_id=${job.message_id}`;failed++;}finally{if(sendToken)await releaseWhatsAppSend(job.conversation_id,sendToken).catch(()=>console.error("whatsapp-ai-retry-lock-release-failed"));}
    }
    return {sent,skipped,failed};
  } finally {await releaseSharedDatabase(sql);}
}

export async function getWhatsAppAiRetryStatus(conversationId:string) {
 if (!canMiaContinue(await listWhatsAppMessages(conversationId,null))) return null;
 await ensureAiRetrySchema();const sql=getSharedDatabase();
 try {const [job]=await sql`SELECT r.state,r.error_code,r.attempts FROM crm_whatsapp_ai_retry r JOIN crm_whatsapp_messages m ON m.whatsapp_message_id=r.message_id WHERE r.conversation_id=${conversationId} AND m.id=(SELECT id FROM crm_whatsapp_messages WHERE conversation_id=${conversationId} ORDER BY created_at DESC,id DESC LIMIT 1) LIMIT 1`;return job?{state:job.state,code:job.error_code,attempts:job.attempts}:null;}finally{await releaseSharedDatabase(sql);}
}
