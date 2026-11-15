import { dispatchMiaAssignment } from '@/lib/mia-sales-dispatch';
import { getMiaAccess } from '@/lib/mia-access';
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { canAccessMarketing, canViewAllCrmContacts } from "@/lib/roles";
import { getWhatsAppChannelCredentials } from "@/lib/whatsapp-credentials";
import { getWhatsAppConversation, listWhatsAppConversations, updateWhatsAppConversation } from "@/lib/whatsapp-inbox";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const patchSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["take", "assign", "release", "toggle_ai", "close", "open", "read"]),
  agentId: z.string().uuid().optional(),
  aiEnabled: z.boolean().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !canAccessMarketing(session.user.role)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const conversations = await listWhatsAppConversations({ agentId: session.user.id, includeAll: canViewAllCrmContacts(session.user.role) });
  const saved = await getWhatsAppChannelCredentials();
  return NextResponse.json({ conversations, configured: Boolean((process.env.WHATSAPP_ACCESS_TOKEN || saved?.accessToken || process.env.META_ACCESS_TOKEN) && (process.env.WHATSAPP_PHONE_NUMBER_ID || saved?.phoneNumberId)) });
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canAccessMarketing(session.user.role)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  const current = await getWhatsAppConversation(parsed.data.id);
  if (!current) return NextResponse.json({ error: "Conversación inexistente" }, { status: 404 });
  const isAdmin = canViewAllCrmContacts(session.user.role);
  if (!isAdmin && current.assignedAgentId !== session.user.id) return NextResponse.json({ error: "No podés acceder a este chat" }, { status: 403 });
  try {
    let conversation;
    switch (parsed.data.action) {
      case "take": conversation = await updateWhatsAppConversation(current.id, { lockAgentId: session.user.id, markRead: true }); break;
      case "assign":
        if (!isAdmin) return NextResponse.json({ error: "Solo administración puede reasignar chats" }, { status: 403 });
        conversation = await updateWhatsAppConversation(current.id, { ownerActorId: session.user.id, assignedAgentId: parsed.data.agentId || null, ...(!(await getMiaAccess()).manualPause?{aiEnabled:!parsed.data.agentId}:{}) }); break;
      case "release": conversation = await updateWhatsAppConversation(current.id, { ownerActorId: session.user.id, assignedAgentId: null, ...(!(await getMiaAccess()).manualPause?{aiEnabled:true}:{}) }); break;
      case "toggle_ai": { const enabled=parsed.data.aiEnabled ?? !current.aiEnabled;conversation=await updateWhatsAppConversation(current.id,{aiEnabled:enabled,aiAssistAssigned:enabled&&!!current.assignedAgentId?true:undefined});break;}
      case "close": conversation = await updateWhatsAppConversation(current.id, { status: "closed", aiEnabled: false }); break;
      case "open": conversation = await updateWhatsAppConversation(current.id, { status: "open" }); break;
      default: conversation = await updateWhatsAppConversation(current.id, { markRead: true });
    }
    const miaOutreach=parsed.data.action==='assign'&&parsed.data.agentId&&parsed.data.agentId!==current.assignedAgentId&&conversation?.leadId?await dispatchMiaAssignment([conversation.leadId]):undefined;
    return NextResponse.json({ conversation, miaOutreach });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo actualizar" }, { status: 409 });
  }
}
