import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { createCrmActivity, deleteCrmActivity, getCrmActivities, getCrmLeadById } from "@/lib/db";
import { canManageListings, canViewAllCrmContacts } from "@/lib/roles";
import { editCrmActivity } from "@/lib/crm-activity-edit";

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

  const lead = await getCrmLeadById(parsed.data.leadId, {
    agentId: session.user.id,
    includeAll: canViewAllCrmContacts(session.user.role),
  });
  if (!lead) {
    return NextResponse.json({ error: "No podés modificar este contacto" }, { status: 403 });
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

  const { success, error } = await deleteCrmActivity(id, {
    agentId: session.user.id,
    includeAll: canViewAllCrmContacts(session.user.role),
  });

  if (!success) {
    return NextResponse.json(
      { error: error || "No se pudo eliminar la actividad" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}

const editSchema = z.object({
  id: z.string().uuid(), version: z.string().min(1),
  title: z.string().trim().min(1).max(500).optional(),
  body: z.string().trim().max(50000).optional(),
  scheduledAt: z.union([z.string().datetime(),z.literal("")]).optional(),
  outcome: z.string().trim().min(1).max(10000).optional(),
}).strict();

export async function PATCH(request: NextRequest) {
  const session = await requireApprovedAgent();
  if (!session) return NextResponse.json({error:"No autorizado"},{status:403});
  const parsed = editSchema.safeParse(await request.json().catch(()=>null));
  if (!parsed.success) return NextResponse.json({error:"Revisá los datos de la actividad."},{status:400});
  try {
    const result = await editCrmActivity(parsed.data,{id:session.user.id,includeAll:canViewAllCrmContacts(session.user.role)});
    return NextResponse.json(result.error ? {error:result.error} : {success:true},{status:result.status});
  } catch (error) {
    console.error("Error editing CRM activity",error);
    return NextResponse.json({error:"No se pudo guardar. Intentá nuevamente."},{status:500});
  }
}
