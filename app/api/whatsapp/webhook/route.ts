import { NextRequest, NextResponse } from "next/server";
import { ensureWhatsAppContact, generateWhatsAppAiReply, listWhatsAppMessages, saveWhatsAppMessage, sendWhatsAppText, verifyWhatsAppSignature } from "@/lib/whatsapp-inbox";
import { createCrmActivity } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN) return new NextResponse(challenge || "", { status: 200 });
  return NextResponse.json({ error: "Verificación rechazada" }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!verifyWhatsAppSignature(rawBody, request.headers.get("x-hub-signature-256"))) return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  let payload: any;
  try { payload = JSON.parse(rawBody); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }
  if (payload.object !== "whatsapp_business_account") return NextResponse.json({ received: true });

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      const names = new Map<string, string>((value.contacts || []).map((contact: any): [string, string] => [String(contact.wa_id || ""), String(contact.profile?.name || "")]));
      for (const message of value.messages || []) {
        if (message.type !== "text" || !message.text?.body) continue;
        const conversation = await ensureWhatsAppContact(message.from, names.get(message.from) || "");
        if (!conversation) continue;
        const inserted = await saveWhatsAppMessage({ conversationId: conversation.id, whatsappMessageId: message.id, direction: "inbound", senderType: "customer", content: message.text.body });
        if (inserted && conversation.leadId) await createCrmActivity({ leadId: conversation.leadId, type: "whatsapp", title: `Respuesta por WhatsApp de ${conversation.contactName || conversation.phone}`, body: message.text.body, scheduledAt: new Date(Number(message.timestamp || 0) * 1000 || Date.now()).toISOString(), externalSource: "whatsapp_inbound", externalId: message.id });
        if (!inserted || !conversation.aiEnabled || conversation.status === "closed" || conversation.assignedAgentId) continue;
        try {
          const history = await listWhatsAppMessages(conversation.id, 30);
          const reply = await generateWhatsAppAiReply(history);
          const outboundId = await sendWhatsAppText(conversation.phone, reply);
          await saveWhatsAppMessage({ conversationId: conversation.id, whatsappMessageId: outboundId, direction: "outbound", senderType: "ai", content: reply });
        } catch (error) {
          console.error("WhatsApp AI reply error", error);
        }
      }
    }
  }
  return NextResponse.json({ received: true });
}
