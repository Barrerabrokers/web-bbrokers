import { createCrmActivity } from '@/lib/db';
import type { WhatsAppAttachment } from '@/lib/whatsapp-attachment-policy';
import { storeWhatsAppAttachment, validateWhatsAppAttachment, withWhatsAppAttachmentUrls, removeWhatsAppAttachment } from '@/lib/whatsapp-attachments';
import { claimWhatsAppHumanSend, releaseWhatsAppSend } from '@/lib/whatsapp-turn-lock';
import { firstContactWhatsAppPhoneId } from "@/lib/whatsapp-inbox-scope";
import { getWhatsAppAiRetryStatus } from "@/lib/whatsapp-ai-retry";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { canAccessMarketing, canViewAllCrmContacts } from "@/lib/roles";
import { getWhatsAppConversation, listWhatsAppMessages, saveWhatsAppMessage, sendMetaSocialText, sendWhatsAppText, sendWhatsAppAttachment, updateWhatsAppConversation } from "@/lib/whatsapp-inbox";

export const dynamic = "force-dynamic";
export const runtime="nodejs";
export const maxDuration=60;

async function allowed(conversationId: string, userId: string, role?: string) {
  const conversation = await getWhatsAppConversation(conversationId);
  if (!conversation || (conversation.channel==="whatsapp" && conversation.businessPhoneNumberId!==firstContactWhatsAppPhoneId())) return null;
  return canViewAllCrmContacts(role) || conversation.assignedAgentId === userId ? conversation : null;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canAccessMarketing(session.user.role)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const conversationId = request.nextUrl.searchParams.get("conversationId") || "";
  const conversation = await allowed(conversationId, session.user.id, session.user.role);
  if (!conversation) return NextResponse.json({ error: "No podés ver este chat" }, { status: 403 });
  await updateWhatsAppConversation(conversationId, { markRead: true });
  const beforeId=request.nextUrl.searchParams.get("before") || undefined;
  if(beforeId && !z.string().uuid().safeParse(beforeId).success)return NextResponse.json({error:"Historial inválido"},{status:400});
  const messages=await listWhatsAppMessages(conversationId,200,beforeId,true);
  return NextResponse.json({messages:await withWhatsAppAttachmentUrls(messages),nextCursor:messages.length===200?messages[0]?.id:null,aiStatus:await getWhatsAppAiRetryStatus(conversationId)});
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canAccessMarketing(session.user.role)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  let body:unknown,file:File|undefined;
  try {
    if(request.headers.get('content-type')?.includes('multipart/form-data')) {
      const form=await request.formData();body={conversationId:form.get('conversationId'),content:form.get('content')||''};
      const entry=form.get('file');if(entry instanceof File)file=entry;else return NextResponse.json({error:'Adjunto inválido'},{status:400});
    }else body=await request.json();
  }catch{return NextResponse.json({error:'Mensaje inválido'},{status:400});}
  const parsed=z.object({conversationId:z.string().uuid(),content:z.string().trim().max(file?1024:4000)}).safeParse(body);
  if(!parsed.success||(!file&&!parsed.data.content))return NextResponse.json({error:'Mensaje inválido'},{status:400});
  if(file)try{await validateWhatsAppAttachment(file);}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Adjunto inválido'},{status:400});}
  let conversation=await allowed(parsed.data.conversationId,session.user.id,session.user.role);
  if(!conversation)return NextResponse.json({error:'No podés responder este chat'},{status:403});
  if(file && conversation.channel!== 'whatsapp') return NextResponse.json({error:'Los adjuntos desde el CRM están disponibles para WhatsApp. En Instagram podés responder con texto.'},{status:400});
  if(conversation.channel === 'instagram') {
    const history = await listWhatsAppMessages(conversation.id, null);
    const inbound = history.filter(m => m.direction === 'inbound' && m.status !== 'cleared').at(-1);
    if(inbound && Date.parse(inbound.createdAt) < Date.now() - 24 * 60 * 60 * 1000)
      return NextResponse.json({error:'La ventana para responder desde el CRM en Instagram está cerrada: pasaron más de 24 horas desde el último mensaje del cliente. Pedile que vuelva a escribir a la cuenta de Instagram para continuar desde acá.',diagnostic:'instagram:response-window-closed'}, {status:422});
  }
  let sendToken:string|undefined;
  let attachment:WhatsAppAttachment|undefined;
  let stage = "lock";
  try {
    // Administrators collaborate without taking ownership or switching off the AI.
    if(session.user.role==='admin'){sendToken=await claimWhatsAppHumanSend(conversation.id,session.user.id);if(conversation.aiEnabled&&conversation.assignedAgentId&&!conversation.aiAssistAssigned)conversation=await updateWhatsAppConversation(conversation.id,{aiAssistAssigned:true});}
    else conversation=await updateWhatsAppConversation(conversation.id,{lockAgentId:session.user.id,markRead:true});
    attachment=file?await storeWhatsAppAttachment(conversation!.id,file):undefined;
    stage='send';
    let messageId:string|undefined;
    if(file&&attachment){const sent=await sendWhatsAppAttachment(conversation!.phone,file,attachment,parsed.data.content,conversation!.businessPhoneNumberId);messageId=sent.messageId;attachment={...attachment,mediaId:sent.mediaId};}
    else if(conversation!.channel !== 'whatsapp') messageId=await sendMetaSocialText(conversation!.channel,conversation!.externalContactId!,parsed.data.content);
    else messageId=await sendWhatsAppText(conversation!.phone,parsed.data.content,conversation!.businessPhoneNumberId);
    stage='save';
    const content=parsed.data.content || (attachment?`[${attachment.type==='image'?'Imagen':'PDF'} adjunto: ${attachment.filename}]`:'');
    await saveWhatsAppMessage({conversationId:conversation!.id,whatsappMessageId:messageId,direction:'outbound',senderType:'agent',senderAgentId:session.user.id,content,attachment});
    // Mirror successful CRM sends in the lead's activity timeline as well as the inbox.
    if(conversation!.leadId) {
      const activity=await createCrmActivity({leadId:conversation!.leadId,type:'whatsapp',title:`${conversation!.channel==='whatsapp'?'WhatsApp':conversation!.channel==='instagram'?'Instagram':'Facebook'} enviado desde el CRM`,body:content,createdBy:session.user.id,externalSource:`${conversation!.channel}_crm_outbound`,externalId:messageId}).catch(()=>null);
      if(!activity?.activity)console.error('crm-send-activity-not-recorded');
    }
    stage='list';
    try {
      await updateWhatsAppConversation(conversation!.id,{markRead:true});
      const messages=await listWhatsAppMessages(conversation!.id,200,undefined,true);
      return NextResponse.json({sent:true,messages:await withWhatsAppAttachmentUrls(messages),conversation});
    }catch{return NextResponse.json({sent:true,messages:[],conversation,refreshWarning:'El mensaje fue enviado. Actualizando el historial…'});}
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo enviar";
    if(attachment&&stage==='send'&&/No se envió el mensaje|No se registró como enviado|La ventana para responder|^Falta|^El identificador|^El número|^La versión/.test(message))await removeWhatsAppAttachment(attachment).catch(()=>console.error('crm-attachment-cleanup-failed'));
    const safeWhatsAppError = stage === "send" && conversation?.channel === "whatsapp" && /^(Meta |WhatsApp |El identificador |El número |Falta configurar el token|Faltan las credenciales|La versión |La ventana |No se pudo confirmar)/.test(message);
    console.error("crm-send-v2", { stage, channel: conversation?.channel, errorType: error instanceof Error ? error.name : "unknown", ...((safeWhatsAppError || (stage === "send" && conversation?.channel !== "whatsapp" && /^(Meta |No se pudo confirmar|El identificador |La ventana |Falta vincular|La versión )/.test(message))) ? { reason: message } : {}) });
    return NextResponse.json({ error:stage==="save"?"El mensaje fue enviado, pero no se pudo guardar en el CRM. No lo reenvíes; verificá WhatsApp.":message, diagnostic: `crm-send-v2:${stage}` }, { status: stage === "send" ? 422 : 500 });
    } finally {
    if(sendToken)await releaseWhatsAppSend(parsed.data.conversationId,sendToken).catch(()=>console.error('crm-send-lock-release-failed'));
  }
}
