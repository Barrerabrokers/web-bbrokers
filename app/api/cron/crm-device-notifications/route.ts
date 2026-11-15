import { NextRequest, NextResponse } from "next/server";
import { processCrmPush } from "@/lib/crm-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  try { return NextResponse.json(await processCrmPush()); }
  catch { return NextResponse.json({ error: "No se pudieron procesar los avisos del CRM." }, { status: 500 }); }
}
