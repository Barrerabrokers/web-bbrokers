import { createCrmActivity } from "@/lib/db";
import {
  ensureSocialContact,
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
      if (!event.sender?.id || event.message?.is_echo || !event.message?.mid) continue;
      const content = socialMessageContent(event.message);
      if (!content) continue;
      const conversation = await ensureSocialContact(channel, String(event.sender.id));
      if (!conversation) continue;
      const inserted = await saveWhatsAppMessage({
        conversationId: conversation.id,
        whatsappMessageId: event.message.mid,
        direction: "inbound",
        senderType: "customer",
        content: content,
      });
      if (inserted && conversation.leadId) {
        await createCrmActivity({
          leadId: conversation.leadId,
          type: "whatsapp",
          title: `Respuesta por ${channel === "instagram" ? "Instagram" : "Facebook"}`,
          body: content,
          scheduledAt: new Date(event.timestamp ? Number(event.timestamp) * (Number(event.timestamp) < 1e12 ? 1000 : 1) : Date.now()).toISOString(),
          externalSource: `${channel}_inbound`,
          externalId: event.message.mid,
        });
      }
      if (!inserted || !conversation.aiEnabled || conversation.status === "closed" || conversation.assignedAgentId) continue;
      try {
        const escalate = shouldEscalateConversation(content);
        const history = await listWhatsAppMessages(conversation.id, 30);
        const reply = escalate
          ? "Perfecto. Te derivo con un asesor de Barrera Brokers para que continúe con toda la información de esta conversación."
          : await generateWhatsAppAiReply(history);
        const outboundId = await sendMetaSocialText(channel, String(event.sender.id), reply);
        await saveWhatsAppMessage({ conversationId: conversation.id, whatsappMessageId: outboundId, direction: "outbound", senderType: "ai", content: reply });
        if (escalate) await updateWhatsAppConversation(conversation.id, { aiEnabled: false });
      } catch (error) { console.error(`${channel} AI reply error`, error); }
    }
  }
}
