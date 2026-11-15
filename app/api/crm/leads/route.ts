import { isValidBirthDate } from "@/lib/crm-contact-birth-date";
import { dispatchMiaAssignment } from '@/lib/mia-sales-dispatch';
import { listWhatsAppConversations } from "@/lib/whatsapp-inbox";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { deleteCrmLead, getCrmActivities, getCrmLeadById, getCrmLeadsPage, upsertCrmLead } from "@/lib/db";
import { isCrmLeadStatus, type CrmLeadStatus } from "@/lib/crm-statuses";
import { runLeadStatusWorkflows } from "@/lib/crm-workflow-runner";
import { canManageAdminPanel, canManageListings, canViewAllCrmContacts } from "@/lib/roles";
import { normalizeDialCode } from "@/lib/phone-countries";
import { isInterestedLeadStatus, sendMetaQualifiedLead, type MetaQualifiedLeadResult } from "@/lib/meta-conversions";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const leadTemperatureSchema = z.enum(["", "frio", "tibio", "caliente"]);
const linkedInProfileSchema = z
  .string()
  .trim()
  .max(500)
  .refine(
    (value) => !value || /^https:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/.+/i.test(value),
    "Ingresá un enlace válido de LinkedIn"
  );

const websiteSchema = z.string().trim().max(2048).refine(value => {
  if (!value) return true;
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}, "Ingresá una página web válida que empiece con https:// o http://");

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
    .default("Nuevo"),
  temperature: leadTemperatureSchema.optional().default(""),
  source: z.string().trim().optional().default(""),
  socialProfile: z.string().trim().max(500).optional().default(""),
  linkedinProfile: linkedInProfileSchema.optional().default(""),
  occupation: z.string().trim().max(200).optional().default(""),
  website: websiteSchema.optional().default(""),
  developmentId: z.string().uuid().or(z.literal("")).optional(),
  campaignName: z.string().trim().max(500).optional(),
  developmentNameText: z.string().trim().optional().default(""),
  assignedAgentId: z.string().uuid().or(z.literal("")).optional(),
  leaveUnassigned: z.boolean().optional().default(false),
  notes: z.string().trim().optional().default(""),
});

const leadPatchSchema = z.object({
  companyName: z.string().trim().max(200).optional(),
  country: z.string().trim().max(200).optional(),
  dni: z.string().trim().max(30).optional(),
  birthDate: z.string().trim().refine(isValidBirthDate, "Ingresá una fecha de nacimiento válida, que no sea futura").optional(),
  address: z.string().trim().max(500).optional(),
  locality: z.string().trim().max(200).optional(),
  province: z.string().trim().max(200).optional(),
  id: z.string().uuid(),
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().optional(),
  email: z.string().trim().toLowerCase().email().or(z.literal("")).optional(),
  countryCode: z.string().trim().min(1).optional(),
  phone: z.string().trim().optional(),
  status: z
    .string()
    .refine(isCrmLeadStatus)
    .transform((value) => value as CrmLeadStatus)
    .optional(),
  temperature: leadTemperatureSchema.optional(),
  socialProfile: z.string().trim().max(500).optional(),
  linkedinProfile: linkedInProfileSchema.optional(),
  occupation: z.string().trim().max(200).optional(),
  website: websiteSchema.optional(),
  developmentId: z.string().uuid().or(z.literal("")).optional(),
  campaignName: z.string().trim().max(500).optional(),
  developmentNameText: z.string().trim().optional(),
  assignedAgentId: z.string().uuid().or(z.literal("")).optional(),
  notes: z.string().trim().optional(),
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

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
};

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: privateHeaders });
}

export async function GET(request: NextRequest) {
  const session = await requireApprovedAgent();
  if (!session) {
    return privateJson({ error: "No autorizado" }, 403);
  }
  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Math.min(500, Math.max(1, Number(params.get("pageSize")) || 50));
  const includeAll = canViewAllCrmContacts(session.user.role);
  const sortColumn = params.get("sort") || "createdAt";
  const allowedSortColumns = new Set(["name", "email", "phone", "whatsapp", "status", "temperature", "development", "campaign", "createdAt", "owner"]);
  const result = await getCrmLeadsPage({
    agentId: session.user.id,
    includeAll,
    ownerId: includeAll ? params.get("owner") || session.user.id : session.user.id,
    status: params.get("status") || "all",
    metaOnly: params.get("source") === "meta",
    occupation: (params.get("occupation") || "").slice(0, 200),
    development: (params.get("development") || "").slice(0, 300),
    query: params.get("query") || "",
    province: (params.get("province") || "").slice(0, 200),
    locality: (params.get("locality") || "").slice(0, 200),
    page,
    pageSize,
    sortColumn: (allowedSortColumns.has(sortColumn) ? sortColumn : "createdAt") as Parameters<typeof getCrmLeadsPage>[0]["sortColumn"],
    sortDirection: params.get("direction") === "asc" ? "asc" : "desc",
  });
  const conversations = params.get("source") === "meta"
    ? Object.fromEntries((await listWhatsAppConversations({ agentId: session.user.id, includeAll })).filter(c => c.leadId && result.leads.some(l => l.id === c.leadId)).map(c => [c.leadId!, c.channel]))
    : undefined;
  const activities = await getCrmActivities(result.leads.map((lead) => lead.id));
  return privateJson({ ...result, activities, conversations, page, pageSize, pageCount: Math.max(1, Math.ceil(result.total / pageSize)) });
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
  const currentLead = parsed.data.id
    ? await getCrmLeadById(parsed.data.id, { agentId: session.user.id, includeAll: canAssignTeam })
    : null;
  if (parsed.data.id && !canAssignTeam) {
    if (!currentLead) {
      return NextResponse.json({ error: "No podés editar este lead" }, { status: 403 });
    }
  }

  const assignedAgentId = parsed.data.leaveUnassigned
    ? undefined
    : canAssignTeam
      ? parsed.data.assignedAgentId || session.user.id
      : session.user.id;

  const { lead, error } = await upsertCrmLead({
    ownerActorId: session.user.id,
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

  let metaQualification: MetaQualifiedLeadResult | undefined;
  if (isInterestedLeadStatus(lead.status) && !isInterestedLeadStatus(currentLead?.status)) {
    try {
      metaQualification = await sendMetaQualifiedLead(lead);
    } catch (metaError) {
      console.error("Meta qualified lead event error:", metaError);
      metaQualification = { sent: false, reason: metaError instanceof Error ? metaError.message : "No se pudo avisar a Meta." };
    }
  }

  const miaOutreach=lead.assignedAgentId&&lead.assignedAgentId!==currentLead?.assignedAgentId?await dispatchMiaAssignment([lead.id]):undefined;
  return NextResponse.json({ lead, metaQualification, miaOutreach });
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
    ownerActorId: session.user.id,
    preserveOwner: parsed.data.assignedAgentId === undefined,
    id: currentLead.id,
    dni: parsed.data.dni,
    birthDate: parsed.data.birthDate,
    companyName: parsed.data.companyName,
    location: parsed.data.address !== undefined || parsed.data.locality !== undefined || parsed.data.province !== undefined || parsed.data.country !== undefined
      ? { address: parsed.data.address, locality: parsed.data.locality, province: parsed.data.province, country: parsed.data.country }
      : undefined,
    firstName: parsed.data.firstName || currentLead.firstName,
    lastName: parsed.data.lastName !== undefined ? parsed.data.lastName : currentLead.lastName,
    email: parsed.data.email !== undefined ? parsed.data.email : currentLead.email,
    countryCode: normalizeDialCode(parsed.data.countryCode || currentLead.countryCode || "+54"),
    phone: parsed.data.phone !== undefined ? parsed.data.phone : currentLead.phone,
    status: parsed.data.status || currentLead.status,
    temperature:
      parsed.data.temperature !== undefined ? parsed.data.temperature : currentLead.temperature,
    source: currentLead.source || "",
    occupation: parsed.data.occupation !== undefined ? parsed.data.occupation : currentLead.occupation || "",
    website: parsed.data.website !== undefined ? parsed.data.website : currentLead.website || "",
    socialProfile:
      parsed.data.socialProfile !== undefined ? parsed.data.socialProfile : currentLead.socialProfile || "",
    linkedinProfile:
      parsed.data.linkedinProfile !== undefined ? parsed.data.linkedinProfile : currentLead.linkedinProfile || "",
    developmentId:
      parsed.data.developmentId !== undefined
        ? parsed.data.developmentId || undefined
        : currentLead.developmentId,
    campaignName: parsed.data.campaignName,
    developmentNameText:
      parsed.data.developmentNameText !== undefined
        ? parsed.data.developmentNameText
        : currentLead.developmentNameText || (!currentLead.developmentId ? currentLead.developmentName || "" : ""),
    assignedAgentId:
      parsed.data.assignedAgentId !== undefined
        ? parsed.data.assignedAgentId || undefined
        : currentLead.assignedAgentId,
    notes:
      parsed.data.notes !== undefined ? parsed.data.notes : (currentLead.notes || ""),
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

  let metaQualification: MetaQualifiedLeadResult | undefined;
  if (parsed.data.status !== undefined && isInterestedLeadStatus(lead.status) && !isInterestedLeadStatus(currentLead.status)) {
    try {
      metaQualification = await sendMetaQualifiedLead(lead);
    } catch (metaError) {
      console.error("Meta qualified lead event error:", metaError);
      metaQualification = { sent: false, reason: metaError instanceof Error ? metaError.message : "No se pudo avisar a Meta." };
    }
  }

  const miaOutreach=parsed.data.assignedAgentId&&lead.assignedAgentId!==currentLead.assignedAgentId?await dispatchMiaAssignment([lead.id]):undefined;
  return NextResponse.json({ lead, workflowResults, metaQualification, miaOutreach });
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
