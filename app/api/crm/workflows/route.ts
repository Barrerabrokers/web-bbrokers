import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import {
  deleteCrmWorkflow,
  getCrmWorkflows,
  upsertCrmWorkflow,
} from "@/lib/db";
import { isCrmLeadStatus, type CrmLeadStatus } from "@/lib/crm-statuses";
import { canManageAdminPanel } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const workflowSchema = z.object({
  id: z.string().uuid().or(z.literal("")).optional(),
  name: z.string().trim().min(1),
  active: z.boolean().optional().default(true),
  triggerType: z.literal("lead_status_changed").optional().default("lead_status_changed"),
  triggerStatus: z
    .string()
    .trim()
    .min(1)
    .refine(isCrmLeadStatus)
    .transform((value) => value as CrmLeadStatus),
  actionType: z.literal("send_email_template").optional().default("send_email_template"),
  templateId: z.string().uuid(),
  runOncePerLead: z.boolean().optional().default(true),
  deliveryDelayHours: z.union([z.literal(0), z.literal(24), z.literal(72), z.literal(168)]).optional().default(0),
  repeatEnabled: z.boolean().optional().default(false),
});

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || !canManageAdminPanel(session.user.role)) return null;
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const workflows = await getCrmWorkflows();
  return NextResponse.json({ workflows });
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = await request.json();
  const parsed = workflowSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Completá nombre, estado del lead y plantilla de correo." },
      { status: 400 }
    );
  }

  const { workflow, error } = await upsertCrmWorkflow({
    ...parsed.data,
    id: parsed.data.id || undefined,
    createdBy: session.user.id,
  });

  if (!workflow) {
    return NextResponse.json(
      { error: error || "No se pudo guardar el workflow" },
      { status: 500 }
    );
  }

  return NextResponse.json({ workflow });
}

export async function DELETE(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  const { success, error } = await deleteCrmWorkflow(id);
  if (!success) {
    return NextResponse.json(
      { error: error || "No se pudo eliminar el workflow" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
