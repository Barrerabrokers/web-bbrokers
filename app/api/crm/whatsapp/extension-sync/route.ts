import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { canManageListings, canViewAllCrmContacts } from "@/lib/roles";
import { syncExtensionWhatsAppMessages } from "@/lib/db";
export const runtime = "nodejs";
const schema = z.object({ leadId: z.string().uuid(), expectedActorId: z.string().uuid().optional(), messages: z.array(z.object({
  id: z.string().min(1).max(400), direction: z.enum(["inbound", "outbound"]),
  text: z.string().min(1).max(20000), timestamp: z.string().max(200),
})).min(1).max(100) });
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageListings(session.user.role)) return NextResponse.json({ error: "Iniciá sesión en el CRM." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Mensajes inválidos." }, { status: 400 });
  if (parsed.data.expectedActorId && parsed.data.expectedActorId !== session.user.id) return NextResponse.json({error:"Cambió el usuario del CRM. Volvé a conectar la extensión con tu usuario."},{status:409});
  try {
    const saved = await syncExtensionWhatsAppMessages({ ...parsed.data, actorId: session.user.id, includeAll: canViewAllCrmContacts(session.user.role) });
    return NextResponse.json({ saved }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("WhatsApp extension sync", error);
    return NextResponse.json({ error: "No se guardó la conversación. Verificá que el contacto siga asignado a tu usuario y reintentá." }, { status: 409 });
  }
}
