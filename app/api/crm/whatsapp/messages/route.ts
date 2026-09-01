import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { canManageListings, canViewAllCrmContacts } from "@/lib/roles";
import { getWhatsAppConversation, listWhatsAppMessages, saveWhatsAppMessage, sendWhatsAppText, updateWhatsAppConversation } from "@/lib/whatsapp-inbox";

export const dynamic = "force-dynamic";

async function allowed(conversationId: string, userId: string, role?: string) {
  const conversation = await getWhatsAppConversation(conversationId);
  if (!conversation) return null;
  return canViewAllCrmContacts(role) || conversation.assignedAgentId === userId ? conversation : null;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageListings(session.user.role)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const conversationId = request.nextUrl.searchParams.get("conversationId") || "";
  const conversation = await allowed(conversationId, session.user.id, session.user.role);
  if (!conversation) return NextResponse.json({ error: "No podés ver este chat" }, { status: 403 });
  await updateWhatsAppConversation(conversationId, { markRead: true });
  return NextResponse.json({ messages: await listWhatsAppMessages(conversationId) });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageListings(session.user.role)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const parsed = z.object({ conversationId: z.string().uuid(), content: z.string().trim().min(1).max(4000) }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Mensaje inválido" }, { status: 400 });
  let conversation = await getWhatsAppConversation(parsed.data.conversationId);
  if (!conversation) return NextResponse.json({ error: "Conversación inexistente" }, { status: 404 });
  if (!canViewAllCrmContacts(session.user.role) && conversation.assignedAgentId && conversation.assignedAgentId !== session.user.id) return NextResponse.json({ error: "Este chat pertenece a otro agente" }, { status: 403 });
  try {
    conversation = await updateWhatsAppConversation(conversation.id, { lockAgentId: session.user.id, markRead: true });
    const messageId = await sendWhatsAppText(conversation!.phone, parsed.data.content);
    await saveWhatsAppMessage({ conversationId: conversation!.id, whatsappMessageId: messageId, direction: "outbound", senderType: "agent", senderAgentId: session.user.id, content: parsed.data.content });
    return NextResponse.json({ messages: await listWhatsAppMessages(conversation!.id), conversation });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo enviar" }, { status: 502 });
  }
}
