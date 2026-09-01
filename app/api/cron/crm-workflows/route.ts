import { NextRequest, NextResponse } from "next/server";
import { processDueCrmWorkflowJobs } from "@/lib/crm-workflow-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://barrerabrokers.com").replace(/\/$/, "");
  const result = await processDueCrmWorkflowJobs(baseUrl);
  return NextResponse.json(result);
}
