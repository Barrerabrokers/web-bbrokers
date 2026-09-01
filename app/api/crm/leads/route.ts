import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { deleteCrmLead, getCrmLeadById, getCrmLeads, upsertCrmLead } from "@/lib/db";
import { isCrmLeadStatus, type CrmLeadStatus } from "@/lib/crm-statuses";
import { runLeadStatusWorkflows } from "@/lib/crm-workflow-runner";
import { canManageAdminPanel, canManageListings, canViewAllCrmContacts } from "@/lib/roles";
import { normalizeDialCode } from "@/lib/phone-countries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const leadTemperatureSchema = z.enum(["", "frio", "tibio", "caliente"]);

const leadSchema = z.object({
  id: z.string().uuid().or(z.literal("")).optional(),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  email: z.string().trim().toLowerCase().email(),
  countryCode: z.string().trim().min(1).default("+54"),
  phone: z.string().trim().min(1),
  status: z
    .string()
    .refine(isCrmLeadStatus)
    .transform((value) => value as CrmLeadStatus)
    .default("NEW"),
  temperature: leadTemperatureSchema.optional().default(""),
  source: z.string().trim().optional().default(""),
  developmentId: z.string().uuid().or(z.literal("")).optional(),
  developmentNameText: z.string().trim().optional().default(""),
  assignedAgentId: z.string().uuid().or(z.literal("")).optional(),
  leaveUnassigned: z.boolean().optional().default(false),
  notes: z.string().trim().optional().default(""),
});

const leadPatchSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  countryCode: z.string().trim().min(1).optional(),
  phone: z.string().trim().min(1).optional(),
  status: z
    .string()
    .refine(isCrmLeadStatus)
    .transform((value) => value as CrmLeadStatus)
    .optional(),
  temperature: leadTemperatureSchema.optional(),
  developmentId: z.string().uuid().or(z.literal("")).optional(),
  developmentNameText: z.string().trim().optional(),
  assignedAgentId: z.string().uuid().or(z.literal("")).optional(),
});

async function requireApprovedAgent() {
  const session = await getServerSession(authOptions);
  if (!session || !canManageListings(session.user.role)) return null;
  return session;
}

function getPublicBaseUrl(request: NextRequest) {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  if (configuredUrl) return configuredUrl.replace(/\/$/, "");

  const proto = request.headers.get("x-forwarded-proto") || "http";
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  return host ? `${proto}://${host}` : "";
}

export async function GET() {
  const session = await requireApprovedAgent();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const leads = await getCrmLeads({
    agentId: session.user.id,
    includeAll: canViewAllCrmContacts(session.user.role),
  });

  return NextResponse.json({ leads });
}

export async function POST(request: NextRequest) {
  const session = await requireApprovedAgent();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Revisá nombre, mail, teléfono y estado del lead" },
      { status: 400 }
    );
  }

  const canAssignTeam = canViewAllCrmContacts(session.user.role);
  if (parsed.data.id && !canAssignTeam) {
    const visibleLeads = await getCrmLeads({
      agentId: session.user.id,
      includeAll: false,
    });
    const canEditLead = visibleLeads.some((lead) => lead.id === parsed.data.id);
    if (!canEditLead) {
      return NextResponse.json({ error: "No podés editar este lead" }, { status: 403 });
    }
  }

  const assignedAgentId = parsed.data.leaveUnassigned
    ? undefined
    : canAssignTeam
      ? parsed.data.assignedAgentId || session.user.id
      : session.user.id;

  const { lead, error } = await upsertCrmLead({
    ...parsed.data,
    id: parsed.data.id || undefined,
    email: parsed.data.email,
    countryCode: normalizeDialCode(parsed.data.countryCode),
    developmentId: parsed.data.developmentId || undefined,
    assignedAgentId,
    createdBy: session.user.id,
  });

  if (!lead) {
    return NextResponse.json(
      { error: error || "No se pudo guardar el lead" },
      { status: 500 }
    );
  }

  return NextResponse.json({ lead });
}

export async function PATCH(request: NextRequest) {
  const session = await requireApprovedAgent();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = leadPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Revisá los datos del contacto" },
      { status: 400 }
    );
  }

  const canAssignTeam = canViewAllCrmContacts(session.user.role);
  const currentLead = await getCrmLeadById(parsed.data.id, {
    agentId: session.user.id,
    includeAll: canAssignTeam,
  });

  if (!currentLead) {
    return NextResponse.json({ error: "No podés editar este lead" }, { status: 403 });
  }

  if (parsed.data.assignedAgentId !== undefined && !canAssignTeam) {
    return NextResponse.json(
      { error: "Solo administración puede cambiar el propietario del contacto" },
      { status: 403 }
    );
  }

  const { lead, error } = await upsertCrmLead({
    id: currentLead.id,
    firstName: parsed.data.firstName || currentLead.firstName,
    lastName: parsed.data.lastName || currentLead.lastName,
    email: parsed.data.email || currentLead.email,
    countryCode: normalizeDialCode(parsed.data.countryCode || currentLead.countryCode || "+54"),
    phone: parsed.data.phone || currentLead.phone,
    status: parsed.data.status || currentLead.status,
    temperature:
      parsed.data.temperature !== undefined ? parsed.data.temperature : currentLead.temperature,
    source: currentLead.source || "",
    developmentId:
      parsed.data.developmentId !== undefined
        ? parsed.data.developmentId || undefined
        : currentLead.developmentId,
    developmentNameText:
      parsed.data.developmentNameText !== undefined
        ? parsed.data.developmentNameText
        : currentLead.developmentNameText || (!currentLead.developmentId ? currentLead.developmentName || "" : ""),
    assignedAgentId:
      parsed.data.assignedAgentId !== undefined
        ? parsed.data.assignedAgentId || undefined
        : currentLead.assignedAgentId,
    notes: currentLead.notes || "",
    createdBy: currentLead.createdBy || session.user.id,
  });

  if (!lead) {
    return NextResponse.json(
      { error: error || "No se pudo actualizar el lead" },
      { status: 500 }
    );
  }

  let workflowResults: Awaited<ReturnType<typeof runLeadStatusWorkflows>> = [];
  if (parsed.data.status !== undefined && parsed.data.status !== currentLead.status) {
    try {
      workflowResults = await runLeadStatusWorkflows({
        lead,
        previousStatus: currentLead.status,
        nextStatus: lead.status,
        changedBy: session.user.id,
        baseUrl: getPublicBaseUrl(request),
      });
    } catch (workflowError) {
      console.error("CRM workflow execution error:", workflowError);
    }
  }

  return NextResponse.json({ lead, workflowResults });
}

export async function DELETE(request: NextRequest) {
  const session = await requireApprovedAgent();
  if (!session || !canManageAdminPanel(session.user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  const { success, error } = await deleteCrmLead(id);
  if (!success) {
    return NextResponse.json(
      { error: error || "No se pudo eliminar el contacto" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
