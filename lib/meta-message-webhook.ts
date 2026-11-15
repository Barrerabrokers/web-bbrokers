import { splitMiaReplyMessages } from '@/lib/mia-reply-messages';
import { claimInstagramAiSend, releaseWhatsAppSend } from '@/lib/whatsapp-turn-lock';
import { canMiaContinue, miaRequestsAdvisor } from '@/lib/whatsapp-mia-conversation';
import { createCrmActivity } from "@/lib/db";
import {
  ensureSocialContact,
  getWhatsAppConversation,
  generateWhatsAppAiReply,
  listWhatsAppMessages,
  saveWhatsAppMessage,
  sendMetaSocialText,
  shouldEscalateConversation,
  updateWhatsAppConversation,
} from "@/lib/whatsapp-inbox";

export function socialMessageContent(message: any): string {
  const parts = typeof message.text === "string" ? [message.text] : [];
  for (const attachment of message.attachments || []) {
    const labels: Record<string, string> = { image: "Imagen", video: "Video", audio: "Audio", file: "Archivo", share: "Publicación compartida", story_mention: "Mención en historia" };
    const label = labels[attachment.type] || "Archivo adjunto";
    let url = "";
    try { const parsed = new URL(attachment.payload?.url); if (parsed.protocol === "https:") url = parsed.href; } catch {}
    parts.push(url ? `${label}: ${url}` : label);
  }
  return parts.join("\n").trim();
}

export async function processMetaMessages(payload: any) {
  const channel = payload.object === "instagram" ? "instagram" : payload.object === "page" ? "facebook" : null;
  if (!channel) return;

  for (const entry of payload.entry || []) {
    const events = [
      ...(Array.isArray(entry.messaging) ? entry.messaging : []),
      ...(Array.isArray(entry.changes) ? entry.changes.filter((change: any) => change.field === "messages").map((change: any) => change.value) : []),
    ];
    for (const event of events) {
      if (!event) continue;
      if (!event.sender?.id || !event.message?.mid) continue;
      const content = socialMessageContent(event.message);
      if (!content) continue;
      const echo = event.message.is_echo === true;
      const contactId = echo ? event.recipient?.id : event.sender.id;
      if (!contactId) continue;
      const conversation = await ensureSocialContact(channel, String(contactId), '', { enableAi: channel === 'instagram' });
      if (!conversation) continue;
      const inserted = await saveWhatsAppMessage({
        conversationId: conversation.id,
        whatsappMessageId: event.message.mid,
        direction: echo ? "outbound" : "inbound",
        senderType: echo ? "agent" : "customer",
        createdAt: new Date(event.timestamp ? Number(event.timestamp) * (Number(event.timestamp) < 1e12 ? 1000 : 1) : Date.now()).toISOString(),
        content: content,
      });
      if (inserted && conversation.leadId) {
        await createCrmActivity({
          leadId: conversation.leadId,
          type: "whatsapp",
          title: `${echo ? "Enviado" : "Recibido"} por ${channel === "instagram" ? "Instagram" : "Facebook"}`,
          body: content,
          scheduledAt: new Date(event.timestamp ? Number(event.timestamp) * (Number(event.timestamp) < 1e12 ? 1000 : 1) : Date.now()).toISOString(),
          externalSource: `${channel}_${echo ? "outbound" : "inbound"}`,
          externalId: event.message.mid,
        }).catch(() => console.error("social-message-activity-failed"));
      }
      if (echo || !inserted || !conversation.aiEnabled || conversation.status === "closed" || (conversation.assignedAgentId && !conversation.aiAssistAssigned)) continue;
      let sendToken:string|null=null;
      try {
        const history = await listWhatsAppMessages(conversation.id, 30);
        if(!canMiaContinue(history))continue;
        const escalate = miaRequestsAdvisor(content);
        const reply = await generateWhatsAppAiReply(history);
        if (!reply) continue;
        const current = await getWhatsAppConversation(conversation.id);
        if(!current?.aiEnabled || current.status==='closed' || (current.assignedAgentId&&!current.aiAssistAssigned))continue;
        if(channel==='instagram') {
          sendToken=await claimInstagramAiSend(conversation.id,event.message.mid);
          if(!sendToken)continue;
        }
        for (const part of splitMiaReplyMessages(reply)) {
          const outboundId = await sendMetaSocialText(channel, String(event.sender.id), part);
          await saveWhatsAppMessage({ conversationId: conversation.id, whatsappMessageId: outboundId, direction: "outbound", senderType: "ai", content: part });
        }
        if (escalate) await updateWhatsAppConversation(conversation.id, { aiEnabled: false });
      } catch { console.error(`${channel}-mia-reply-failed`); }
      finally {if(sendToken)await releaseWhatsAppSend(conversation.id,sendToken).catch(()=>console.error('instagram-mia-lock-release-failed'));}
    }
  }
}
