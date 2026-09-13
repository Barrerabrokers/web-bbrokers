import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { inspectMetaSocialConnection } from "@/lib/meta-social";
export const dynamic = "force-dynamic";
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  return NextResponse.json(await inspectMetaSocialConnection(), { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const { configureMetaSocialWebhook } = await import("@/lib/meta-social");
    return NextResponse.json(await configureMetaSocialWebhook(), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo configurar la recepción." }, { status: 502 }); }
}
