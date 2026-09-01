import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { canManageListings, canViewAllCrmContacts } from "@/lib/roles";
import { getWhatsAppConversation, listWhatsAppConversations, updateWhatsAppConversation } from "@/lib/whatsapp-inbox";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["take", "assign", "release", "toggle_ai", "close", "open", "read"]),
  agentId: z.string().uuid().optional(),
  aiEnabled: z.boolean().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !canManageListings(session.user.role)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const conversations = await listWhatsAppConversations({ agentId: session.user.id, includeAll: canViewAllCrmContacts(session.user.role) });
  return NextResponse.json({ conversations, configured: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.OPENAI_API_KEY) });
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageListings(session.user.role)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  const current = await getWhatsAppConversation(parsed.data.id);
  if (!current) return NextResponse.json({ error: "Conversación inexistente" }, { status: 404 });
  const isAdmin = canViewAllCrmContacts(session.user.role);
  if (!isAdmin && current.assignedAgentId && current.assignedAgentId !== session.user.id) return NextResponse.json({ error: "No podés acceder a este chat" }, { status: 403 });
  try {
    let conversation;
    switch (parsed.data.action) {
      case "take": conversation = await updateWhatsAppConversation(current.id, { lockAgentId: session.user.id, markRead: true }); break;
      case "assign":
        if (!isAdmin) return NextResponse.json({ error: "Solo administración puede reasignar chats" }, { status: 403 });
        conversation = await updateWhatsAppConversation(current.id, { assignedAgentId: parsed.data.agentId || null, aiEnabled: !parsed.data.agentId }); break;
      case "release": conversation = await updateWhatsAppConversation(current.id, { assignedAgentId: null, aiEnabled: true }); break;
      case "toggle_ai": conversation = await updateWhatsAppConversation(current.id, { aiEnabled: parsed.data.aiEnabled ?? !current.aiEnabled }); break;
      case "close": conversation = await updateWhatsAppConversation(current.id, { status: "closed", aiEnabled: false }); break;
      case "open": conversation = await updateWhatsAppConversation(current.id, { status: "open" }); break;
      default: conversation = await updateWhatsAppConversation(current.id, { markRead: true });
    }
    return NextResponse.json({ conversation });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo actualizar" }, { status: 409 });
  }
}
