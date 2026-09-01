import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { getCrmLeadById } from "@/lib/db";
import { syncLeadEmailReplies } from "@/lib/crm-email-replies";
import { canManageListings, canViewAllCrmContacts } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageListings(session.user.role)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = z.object({ leadId: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Contacto inválido" }, { status: 400 });
  const lead = await getCrmLeadById(parsed.data.leadId, { agentId: session.user.id, includeAll: canViewAllCrmContacts(session.user.role) });
  if (!lead) return NextResponse.json({ error: "No podés consultar este contacto" }, { status: 403 });
  try {
    const origin = process.env.NEXTAUTH_URL || new URL(request.url).origin;
    const result = await syncLeadEmailReplies({ lead, agentId: session.user.id, origin });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron sincronizar las respuestas." }, { status: 500 });
  }
}
