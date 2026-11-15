import { waitForWhatsAppReplyDelay, WHATSAPP_REPLY_DELAY_MS } from '@/lib/whatsapp-reply-delay';
import { finishMiaPublicHandoff } from '@/lib/mia-reset-runtime';
import { splitMiaReplyMessages } from '@/lib/mia-reply-messages';
import { processWhatsAppAppEchoes } from "@/lib/whatsapp-app-echo";
import { claimWhatsAppAiSend, releaseWhatsAppSend } from '@/lib/whatsapp-turn-lock';
import { storePrimaryHistoryWebhook } from "@/lib/whatsapp-history-import";
import { firstContactWhatsAppPhoneId } from "@/lib/whatsapp-inbox-scope";
import { salesNextStep } from "@/lib/whatsapp-sales-policy";
import { queueWhatsAppAiRetry, finishWhatsAppAiRetry } from "@/lib/whatsapp-ai-retry";
import { whatsAppInboundContent } from "@/lib/whatsapp-form-context";
import { after, NextRequest, NextResponse } from "next/server";
import { ensureWhatsAppContact, generateWhatsAppAiReply, listWhatsAppMessages, saveWhatsAppMessage, sendWhatsAppText, verifyWhatsAppSignature } from "@/lib/whatsapp-inbox";
import { createCrmActivity } from "@/lib/db";
import { recordWhatsAppDeliveryStatus } from '@/lib/whatsapp-delivery';
import { scheduleSalesAnalysis } from "@/lib/ai-sales/schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || process.env.META_VERIFY_TOKEN;
  if (mode === "subscribe" && token && token === verifyToken) return new NextResponse(challenge || "", { status: 200 });
  return NextResponse.json({ error: "Verificación rechazada" }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!verifyWhatsAppSignature(rawBody, request.headers.get("x-hub-signature-256"))) return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  let payload: any;
  try { payload = JSON.parse(rawBody); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }
  if (payload.object !== "whatsapp_business_account") return NextResponse.json({ received: true });

  const pendingReplies = new Map<string, {conversation: NonNullable<Awaited<ReturnType<typeof ensureWhatsAppContact>>>; messageId:string;content:string;receivedAt:number}>();
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      if(change.field==='smb_message_echoes') {await processWhatsAppAppEchoes(value);continue;}
      if(change.field==='history') {await storePrimaryHistoryWebhook(value);continue;}
      for(const status of value.statuses||[]) {
        if(await recordWhatsAppDeliveryStatus(status,String(value.metadata?.phone_number_id||'')))scheduleSalesAnalysis();
      }
      const names = new Map<string, string>((value.contacts || []).map((contact: any): [string, string] => [String(contact.wa_id || ""), String(contact.profile?.name || "")]));
      for (const message of value.messages || []) {
        if (!message.id || !message.from || ['reaction','system'].includes(message.type)) continue;
        const content = whatsAppInboundContent(message) || message.button?.text || message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || message.image?.caption || message.video?.caption || message.document?.caption || ({audio:'[El cliente envió un audio sin transcripción]',image:'[El cliente envió una imagen]',video:'[El cliente envió un video]',document:'[El cliente envió un documento]',sticker:'[El cliente envió un sticker]',location:'[El cliente compartió una ubicación]',contacts:'[El cliente compartió un contacto]'} as Record<string,string>)[message.type];
        if (!content) continue;
        const conversation = await ensureWhatsAppContact(message.from, names.get(message.from) || "", value.metadata?.phone_number_id);
        if (!conversation) continue;
        const inserted = await saveWhatsAppMessage({ conversationId: conversation.id, whatsappMessageId: message.id, direction: "inbound", senderType: "customer", content });
        if (inserted && conversation.leadId) await createCrmActivity({ leadId: conversation.leadId, type: "whatsapp", title: `Respuesta por WhatsApp de ${conversation.contactName || conversation.phone}`, body: content, scheduledAt: new Date(Number(message.timestamp || 0) * 1000 || Date.now()).toISOString(), externalSource: "whatsapp_inbound", externalId: message.id });
        if (!inserted || conversation.businessPhoneNumberId !== firstContactWhatsAppPhoneId() || !conversation.aiEnabled || conversation.status === "closed") continue;
        const receivedAt=Date.now();
        await queueWhatsAppAiRetry(conversation.id,message.id,{notBefore:new Date(receivedAt+WHATSAPP_REPLY_DELAY_MS),reason:'reply_delay'});
        if(conversation.lockedUntil&&Date.parse(conversation.lockedUntil)>Date.now())continue;
        const nextStep = salesNextStep(content);
        if (nextStep && conversation.leadId) {
          const label = { reservation: "reserva", meeting: "reunión o visita", proposal: "propuesta comercial" }[nextStep];
          try { await createCrmActivity({ leadId: conversation.leadId, type: "nota", title: `WhatsApp: solicitud de ${label}`, body: `El cliente solicita avanzar con ${label}. Pendiente de confirmación del equipo; no hay reserva ni cita confirmada.\n\nConsulta: ${content}`, externalSource: "whatsapp_sales_intent", externalId: `${message.id}:sales-intent` }); }
          catch { console.error("WhatsApp sales intent could not be saved"); }
        }
        pendingReplies.set(conversation.id,{conversation,messageId:message.id,content,receivedAt});
      }
    }
  }

  if(pendingReplies.size)after(async()=>{
    const jobs=[...pendingReplies.values()];
    for(let offset=0;offset<jobs.length;offset+=5){
      await Promise.all(jobs.slice(offset,offset+5).map(async({conversation,messageId,content,receivedAt})=>{
        let replyStage = "generate";
        let sendToken:string|null=null;
        try {
          await waitForWhatsAppReplyDelay(receivedAt);
          const history = await listWhatsAppMessages(conversation.id, 30);
          const latest=history.filter(m=>!['historical','cleared'].includes(m.status)).at(-1);
          if(latest?.whatsappMessageId!==messageId){await finishWhatsAppAiRetry(messageId,'skipped');return;}
          const reply = await generateWhatsAppAiReply(history);
          if (!reply){await finishWhatsAppAiRetry(messageId,'skipped');return;}
          sendToken=await claimWhatsAppAiSend(conversation.id,messageId);
          if(!sendToken)return;
          replyStage = "send";
          for (const part of splitMiaReplyMessages(reply)) {
            const outboundId = await sendWhatsAppText(conversation.phone, part, conversation.businessPhoneNumberId);
            await saveWhatsAppMessage({ conversationId: conversation.id, whatsappMessageId: outboundId, direction: "outbound", senderType: "ai", content: part });
            if (part.startsWith('Sí, acá te lo mando: https://')) {
            const {markMiaBrochureSent} = await import('@/mia/lib/whatsapp-flow');
            await markMiaBrochureSent(messageId, part);
          }
          }
          await finishMiaPublicHandoff(conversation.id,content);
          await finishWhatsAppAiRetry(messageId,'sent');
        } catch (error) {
          console.error("WhatsApp AI reply error", { stage: replyStage, code: error instanceof Error ? error.message.slice(0,160) : "unknown" });
          if (replyStage === 'send') await finishWhatsAppAiRetry(messageId,'review');
        } finally {if(sendToken)await releaseWhatsAppSend(conversation.id,sendToken).catch(()=>console.error("whatsapp-ai-lock-release-failed"));}
      }));
    }
  });
  return NextResponse.json({ received: true });
}
