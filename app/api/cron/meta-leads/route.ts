import { NextRequest, NextResponse } from "next/server";
import { enqueueMetaRecovery } from "@/lib/meta-recovery-store";
import { processMetaRecovery } from "@/lib/meta-recovery";

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
    // Starts at most one new 30-day reconciliation every 15 minutes. Active
    // work resumes each minute; no browser or local computer is required.
    await enqueueMetaRecovery({ automatic: true });
    const recovery = await processMetaRecovery();
    return NextResponse.json({ ok: recovery?.status !== "failed", recovery });
  } catch {
    console.error("meta_leads_recovery_tick_failed");
    return NextResponse.json(
      { error: "No se pudo completar este lote. Vercel retomará el avance guardado en la próxima ejecución." },
      { status: 503 },
    );
  }
}
