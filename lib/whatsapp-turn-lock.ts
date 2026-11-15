import { randomUUID } from 'crypto';
import { getSharedDatabase, releaseSharedDatabase } from '@/lib/database-pool';
import { ensureWhatsAppInboxSchema } from '@/lib/whatsapp-inbox';
import { firstContactWhatsAppPhoneId } from '@/lib/whatsapp-inbox-scope';
/** Claims only the sending phase. An administrator can intervene while the AI is thinking. */
export async function claimWhatsAppHumanSend(conversationId:string,actor:string) {
  await ensureWhatsAppInboxSchema();const sql=getSharedDatabase(),token=randomUUID();
  try {const rows=await sql`UPDATE crm_whatsapp_conversations SET reply_send_token=${token},locked_by=${actor},locked_until=NOW()+INTERVAL '2 minutes'
    WHERE id=${conversationId} AND (reply_send_token IS NULL OR locked_until<NOW())
      AND (locked_by IS NULL OR locked_by=${actor} OR locked_until IS NULL OR locked_until<NOW()) RETURNING id`;
    if(!rows.length)throw new Error('Se está enviando otro mensaje en este chat. Reintentá en unos segundos.');return token;
  }finally{await releaseSharedDatabase(sql);}
}
export async function claimWhatsAppAiSend(conversationId:string,inboundMessageId:string) {
  await ensureWhatsAppInboxSchema();const sql=getSharedDatabase(),token=randomUUID();
  try {const rows=await sql`UPDATE crm_whatsapp_conversations c SET reply_send_token=${token},locked_until=NOW()+INTERVAL '2 minutes'
    WHERE c.id=${conversationId} AND NOT EXISTS(SELECT 1 FROM crm_whatsapp_agent_settings s WHERE s.key='mia-access-v1' AND
        (COALESCE(s.value::jsonb->>'mode','disabled') NOT IN ('all','pilot') OR s.value::jsonb->>'mode'='pilot' AND NOT(COALESCE(s.value::jsonb->'conversationIds','[]'::jsonb) ? c.id::text)))
 AND (
        EXISTS(SELECT 1 FROM crm_whatsapp_agent_settings runtime WHERE runtime.key='mia-runtime-v2'
          AND runtime.value::jsonb->>'audience'='all'
          AND (SELECT m.created_at FROM crm_whatsapp_messages m WHERE m.conversation_id=c.id AND m.whatsapp_message_id=${inboundMessageId}) >= (runtime.value::jsonb->>'activatedAt')::timestamptz)
        OR c.id::text=(SELECT s.value::jsonb->>'testConversationId' FROM crm_whatsapp_agent_settings s WHERE s.key='mia-runtime-v2')
        OR NOT EXISTS(SELECT 1 FROM crm_whatsapp_messages sent WHERE sent.conversation_id=c.id AND sent.direction='outbound'
          AND sent.created_at>=COALESCE((SELECT (s.value::jsonb->>'resetAt')::timestamptz FROM crm_whatsapp_agent_settings s WHERE s.key='mia-runtime-v2'),'2026-10-19T00:00:00Z'::timestamptz))
      )
 AND c.ai_enabled AND c.status='open' AND c.channel='whatsapp'
      AND c.business_phone_number_id=${firstContactWhatsAppPhoneId()}
      AND (c.locked_until IS NULL OR c.locked_until<NOW()) AND (c.reply_send_token IS NULL OR c.locked_until<NOW())
      AND ${inboundMessageId}=(SELECT whatsapp_message_id FROM crm_whatsapp_messages m WHERE m.conversation_id=c.id AND m.status<>'historical' ORDER BY m.created_at DESC,m.id DESC LIMIT 1)
      AND (SELECT direction FROM crm_whatsapp_messages m WHERE m.conversation_id=c.id AND m.status<>'historical' ORDER BY m.created_at DESC,m.id DESC LIMIT 1)='inbound'
      AND EXISTS(SELECT 1 FROM crm_whatsapp_messages received WHERE received.conversation_id=c.id AND received.whatsapp_message_id=${inboundMessageId} AND received.direction='inbound' AND received.created_at<=clock_timestamp()-INTERVAL '10 seconds')
      RETURNING id`;
    return rows.length?token:null;
  }finally{await releaseSharedDatabase(sql);}
}
export async function releaseWhatsAppSend(conversationId:string,token:string) {
  const sql=getSharedDatabase();try{await sql`UPDATE crm_whatsapp_conversations SET reply_send_token=NULL,locked_by=NULL,locked_until=NULL WHERE id=${conversationId} AND reply_send_token=${token}`;}finally{await releaseSharedDatabase(sql);}
}

/** Instagram uses the same send lock as human agents, while preserving explicit pauses. */
export async function claimInstagramAiSend(conversationId:string,inboundMessageId:string) {
  await ensureWhatsAppInboxSchema();const sql=getSharedDatabase(),token=randomUUID();
  try {const rows=await sql`UPDATE crm_whatsapp_conversations c SET reply_send_token=${token},locked_until=NOW()+INTERVAL '2 minutes'
    WHERE c.id=${conversationId} AND NOT EXISTS(SELECT 1 FROM crm_whatsapp_agent_settings s WHERE s.key='mia-access-v1' AND
        (COALESCE(s.value::jsonb->>'mode','disabled') NOT IN ('all','pilot') OR s.value::jsonb->>'mode'='pilot' AND NOT(COALESCE(s.value::jsonb->'conversationIds','[]'::jsonb) ? c.id::text)))
 AND (
        EXISTS(SELECT 1 FROM crm_whatsapp_agent_settings runtime WHERE runtime.key='mia-runtime-v2'
          AND runtime.value::jsonb->>'audience'='all'
          AND (SELECT m.created_at FROM crm_whatsapp_messages m WHERE m.conversation_id=c.id AND m.whatsapp_message_id=${inboundMessageId}) >= (runtime.value::jsonb->>'activatedAt')::timestamptz)
        OR c.id::text=(SELECT s.value::jsonb->>'testConversationId' FROM crm_whatsapp_agent_settings s WHERE s.key='mia-runtime-v2')
        OR NOT EXISTS(SELECT 1 FROM crm_whatsapp_messages sent WHERE sent.conversation_id=c.id AND sent.direction='outbound'
          AND sent.created_at>=COALESCE((SELECT (s.value::jsonb->>'resetAt')::timestamptz FROM crm_whatsapp_agent_settings s WHERE s.key='mia-runtime-v2'),'2026-10-19T00:00:00Z'::timestamptz))
      )
 AND c.ai_enabled AND c.status='open' AND c.channel='instagram'
      AND (c.assigned_agent_id IS NULL OR c.ai_assist_assigned OR EXISTS(SELECT 1 FROM crm_whatsapp_agent_settings s WHERE s.key='mia-access-v1' AND s.value::jsonb->>'pausePolicy'='manual'))
      AND (c.locked_until IS NULL OR c.locked_until<NOW()) AND (c.reply_send_token IS NULL OR c.locked_until<NOW())
      AND ${inboundMessageId}=(SELECT whatsapp_message_id FROM crm_whatsapp_messages m WHERE m.conversation_id=c.id AND m.status NOT IN ('historical','cleared') ORDER BY m.created_at DESC,m.id DESC LIMIT 1)
      AND EXISTS(SELECT 1 FROM crm_whatsapp_messages m WHERE m.conversation_id=c.id AND m.whatsapp_message_id=${inboundMessageId} AND m.direction='inbound' AND m.created_at>NOW()-INTERVAL '23 hours') RETURNING id`;
    return rows.length?token:null;
  }finally{await releaseSharedDatabase(sql);}
}
