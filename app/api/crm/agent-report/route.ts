import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { canManageListings } from "@/lib/roles";
import { getAgentReport } from "@/lib/crm-agent-report-db";
import { REPORT_CHANNELS, resolveAgentScope, resolveReportRange } from "@/lib/crm-agent-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const querySchema = z.object({
  agent: z.union([z.string().uuid(), z.literal("all")]).optional(),
  period: z.string().optional(), date: z.string().optional(), from: z.string().optional(), to: z.string().optional(), year: z.string().optional(),
  channel: z.enum(["all", ...REPORT_CHANNELS]).default("all"),
  page: z.coerce.number().int().min(1).max(100000).default(1),
});
const headers = { "Cache-Control": "private, no-store, max-age=0" };
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageListings(session.user.role)) return NextResponse.json({ error: "No autorizado" }, { status: 403, headers });
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Revisá los filtros seleccionados." }, { status: 400, headers });
  let scope: string | null;
  try { scope = resolveAgentScope(session.user, parsed.data.agent); }
  catch { return NextResponse.json({ error: "Solo podés consultar tu propia actividad." }, { status: 403, headers }); }
  let range;
  try { range = resolveReportRange(parsed.data); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Fechas no válidas." }, { status: 400, headers }); }
  try { return NextResponse.json(await getAgentReport({ scope, admin: session.user.role === "admin", range, channel: parsed.data.channel, page: parsed.data.page }), { headers }); }
  catch (error) { console.error("No se pudo cargar el panel de agentes", error instanceof Error ? error.message : "Database error"); return NextResponse.json({ error: "No se pudo cargar la actividad. Reintentá en unos instantes." }, { status: 500, headers }); }
}
