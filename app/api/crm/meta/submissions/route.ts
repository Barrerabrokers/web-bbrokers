import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { getCrmActivities, getCrmLeadById } from "@/lib/db";
import { importMetaLeadgenId } from "@/lib/meta-leads";
import { canManageListings, canViewAllCrmContacts } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ leadId: z.string().uuid() });

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageListings(session.user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Contacto inválido" }, { status: 400 });
  }

  const lead = await getCrmLeadById(parsed.data.leadId, {
    agentId: session.user.id,
    includeAll: canViewAllCrmContacts(session.user.role),
  });
  if (!lead) return NextResponse.json({ error: "Contacto no encontrado" }, { status: 404 });

  const activities = await getCrmActivities([lead.id]);
  const leadgenIds = Array.from(new Set(
    activities
      .filter((activity) => activity.externalSource === "meta_lead_ads" && activity.externalId)
      .map((activity) => activity.externalId as string)
  ));

  const results = [];
  for (const leadgenId of leadgenIds) {
    try {
      results.push(await importMetaLeadgenId(leadgenId, { createdBy: session.user.id }));
    } catch (error) {
      return NextResponse.json({
        error: error instanceof Error ? error.message : "No se pudieron recuperar los formularios de Meta",
      }, { status: 502 });
    }
  }

  return NextResponse.json({ refreshed: results.length });
}
