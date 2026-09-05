import { NextRequest, NextResponse } from "next/server";
import { createCrmActivity } from "@/lib/db";
import {
  ensureSocialContact,
  generateWhatsAppAiReply,
  listWhatsAppMessages,
  saveWhatsAppMessage,
  sendMetaSocialText,
  shouldEscalateConversation,
  updateWhatsAppConversation,
  verifyWhatsAppSignature,
} from "@/lib/whatsapp-inbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const verifyToken = process.env.META_MESSAGES_VERIFY_TOKEN || process.env.META_VERIFY_TOKEN;
  if (params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === verifyToken) {
    return new NextResponse(params.get("hub.challenge") || "", { status: 200 });
  }
  return NextResponse.json({ error: "Verificación rechazada" }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!verifyWhatsAppSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }
  let payload: any;
  try { payload = JSON.parse(rawBody); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }
  const channel = payload.object === "instagram" ? "instagram" : payload.object === "page" ? "facebook" : null;
  if (!channel) return NextResponse.json({ received: true });

  for (const entry of payload.entry || []) {
    for (const event of entry.messaging || []) {
      if (!event.sender?.id || event.message?.is_echo || !event.message?.text) continue;
      const conversation = await ensureSocialContact(channel, String(event.sender.id));
      if (!conversation) continue;
      const inserted = await saveWhatsAppMessage({
        conversationId: conversation.id,
        whatsappMessageId: event.message.mid,
        direction: "inbound",
        senderType: "customer",
        content: event.message.text,
      });
      if (inserted && conversation.leadId) {
        await createCrmActivity({
          leadId: conversation.leadId,
          type: "whatsapp",
          title: `Respuesta por ${channel === "instagram" ? "Instagram" : "Facebook"}`,
          body: event.message.text,
          scheduledAt: new Date(Number(event.timestamp) || Date.now()).toISOString(),
          externalSource: `${channel}_inbound`,
          externalId: event.message.mid,
        });
      }
      if (!inserted || !conversation.aiEnabled || conversation.status === "closed" || conversation.assignedAgentId) continue;
      try {
        const escalate = shouldEscalateConversation(event.message.text);
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
  return NextResponse.json({ received: true });
}
