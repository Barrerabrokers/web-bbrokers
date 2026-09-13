import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { updateCrmLeadSelection } from "@/lib/db";
import { canManageListings, canViewAllCrmContacts } from "@/lib/roles";
import { isCrmLeadStatus, type CrmLeadStatus } from "@/lib/crm-statuses";
import { runLeadStatusWorkflows } from "@/lib/crm-workflow-runner";
import { isInterestedLeadStatus, sendMetaQualifiedLead } from "@/lib/meta-conversions";

export const runtime = "nodejs";
const schema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
  status: z.string().refine(isCrmLeadStatus).transform(value => value as CrmLeadStatus).optional(),
  assignedAgentId: z.string().uuid().or(z.literal("")).optional(),
}).strict().refine(value => (value.status !== undefined) !== (value.assignedAgentId !== undefined));

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageListings(session.user.role)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Seleccioná hasta 500 contactos y un estado o propietario válido." }, { status: 400 });
  let changes;
  try {
    changes = await updateCrmLeadSelection({ ...parsed.data, actorId: session.user.id, includeAll: canViewAllCrmContacts(session.user.role) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron actualizar los contactos." }, { status: 409 });
  }
  let automationWarning = false;
  for (const { lead, previousStatus } of changes) {
    if (parsed.data.status === undefined || lead.status === previousStatus) continue;
    try {
      await runLeadStatusWorkflows({ lead, previousStatus, nextStatus: lead.status, changedBy: session.user.id, baseUrl: process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || request.nextUrl.origin });
      if (isInterestedLeadStatus(lead.status) && !isInterestedLeadStatus(previousStatus)) await sendMetaQualifiedLead(lead);
    } catch (error) { automationWarning = true; console.error("CRM bulk status automation:", error); }
  }
  return NextResponse.json({ updated: changes.length, automationWarning }, { headers: { "Cache-Control": "private, no-store" } });
}
