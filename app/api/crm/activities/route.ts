import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { createCrmActivity, deleteCrmActivity, getCrmActivities, getCrmLeadById, getCrmLeads } from "@/lib/db";
import { canManageListings, canViewAllCrmContacts } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const activitySchema = z.object({
  leadId: z.string().uuid(),
  type: z.enum(["nota", "correo", "whatsapp", "llamada", "reunion", "tarea"]),
  title: z.string().trim().min(1),
  body: z.string().trim().optional().default(""),
  scheduledAt: z.string().optional().or(z.literal("")),
});

async function requireApprovedAgent() {
  const session = await getServerSession(authOptions);
  if (!session || !canManageListings(session.user.role)) return null;
  return session;
}

export async function GET(request: NextRequest) {
  const session = await requireApprovedAgent();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const leadId = request.nextUrl.searchParams.get("leadId") || "";
  if (!leadId) return NextResponse.json({ error: "Contacto requerido" }, { status: 400 });
  const lead = await getCrmLeadById(leadId, {
    agentId: session.user.id,
    includeAll: canViewAllCrmContacts(session.user.role),
  });
  if (!lead) return NextResponse.json({ error: "No podés ver este contacto" }, { status: 403 });
  return NextResponse.json({ activities: await getCrmActivities([leadId]) });
}

export async function POST(request: NextRequest) {
  const session = await requireApprovedAgent();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = activitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Completá el tipo y el detalle de la actividad" },
      { status: 400 }
    );
  }

  if (!canViewAllCrmContacts(session.user.role)) {
    const visibleLeads = await getCrmLeads({
      agentId: session.user.id,
      includeAll: false,
    });
    const canUseLead = visibleLeads.some((lead) => lead.id === parsed.data.leadId);
    if (!canUseLead) {
      return NextResponse.json({ error: "No podés modificar este contacto" }, { status: 403 });
    }
  }

  const { activity, error } = await createCrmActivity({
    ...parsed.data,
    scheduledAt: parsed.data.scheduledAt || undefined,
    createdBy: session.user.id,
  });

  if (!activity) {
    return NextResponse.json(
      { error: error || "No se pudo guardar la actividad" },
      { status: 500 }
    );
  }

  return NextResponse.json({ activity });
}

export async function DELETE(request: NextRequest) {
  const session = await requireApprovedAgent();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Falta la actividad a eliminar" }, { status: 400 });
  }

  const visibleLeads = await getCrmLeads({
    agentId: session.user.id,
    includeAll: canViewAllCrmContacts(session.user.role),
  });
  const { success, error } = await deleteCrmActivity(
    id,
    visibleLeads.map((lead) => lead.id)
  );

  if (!success) {
    return NextResponse.json(
      { error: error || "No se pudo eliminar la actividad" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
