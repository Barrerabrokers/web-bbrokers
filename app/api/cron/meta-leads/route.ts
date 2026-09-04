import { NextRequest, NextResponse } from "next/server";
import { backfillRecentMetaLeads } from "@/lib/meta-leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    const result = await backfillRecentMetaLeads(3);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Error recovering Meta leads from cron:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron recuperar los leads de Meta." },
      { status: 502 },
    );
  }
}
