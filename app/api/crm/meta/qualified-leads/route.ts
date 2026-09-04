import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCrmLeadsPage } from "@/lib/db";
import { sendMetaQualifiedLead } from "@/lib/meta-conversions";
import { canManageAdminPanel } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PAGE_SIZE = 100;
const CONCURRENCY = 5;

async function mapConcurrent<T, R>(items: T[], worker: (item: T) => Promise<R>) {
  const results: R[] = [];
  for (let index = 0; index < items.length; index += CONCURRENCY) {
    results.push(...await Promise.all(items.slice(index, index + CONCURRENCY).map(worker)));
  }
  return results;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageAdminPanel(session.user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({})) as { page?: number };
  const page = Math.max(1, Math.floor(Number(body.page) || 1));
  const result = await getCrmLeadsPage({
    agentId: session.user.id,
    includeAll: true,
    ownerId: "all",
    status: "Interesado",
    page,
    pageSize: PAGE_SIZE,
    sortColumn: "createdAt",
    sortDirection: "desc",
  });

  const eligible = result.leads.filter((lead) =>
    Boolean(lead.metaLeadId || lead.metaProperties?.meta_lead_id)
  );
  const delivery = await mapConcurrent(eligible, async (lead) => {
    try {
      const sent = await sendMetaQualifiedLead(lead);
      return { leadId: lead.id, sent: sent.sent, skipped: Boolean(sent.skipped) };
    } catch (error) {
      return {
        leadId: lead.id,
        sent: false,
        skipped: false,
        error: error instanceof Error ? error.message : "No se pudo avisar a Meta.",
      };
    }
  });
  const pageCount = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  return NextResponse.json({
    page,
    pageCount,
    totalInterested: result.total,
    processed: result.leads.length,
    eligible: eligible.length,
    sent: delivery.filter((item) => item.sent).length,
    skippedWithoutMetaId: result.leads.length - eligible.length,
    failed: delivery.filter((item) => "error" in item).length,
    errors: delivery.flatMap((item) => "error" in item ? [item.error] : []).slice(0, 5),
    hasMore: page < pageCount,
  });
}
