import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { enqueueMetaRecovery, getMetaRecovery } from "@/lib/meta-recovery-store";
import { metaRecoverySummary } from "@/lib/meta-recovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Esta función está disponible solamente para administradores." }, { status: 403 });
  }
  try {
    return NextResponse.json({ recovery: metaRecoverySummary(await getMetaRecovery()) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "No se pudo consultar el avance. Esto no cancela la recuperación en Vercel." }, { status: 503 });
  }
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Esta función está disponible solamente para administradores." }, { status: 403 });
  }
  try {
    const job = await enqueueMetaRecovery({ createdBy: session.user.id });
    return NextResponse.json({ recovery: metaRecoverySummary(job) }, { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "No se pudo poner la recuperación en cola. Revisá el avance antes de volver a intentarlo." }, { status: 503 });
  }
}
