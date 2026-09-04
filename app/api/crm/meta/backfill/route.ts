import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { backfillRecentMetaLeads } from "@/lib/meta-leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Esta función está disponible solamente para administradores." }, { status: 403 });
  }
  try {
    return NextResponse.json(await backfillRecentMetaLeads(3, session.user.id));
  } catch (error) {
    console.error("Error backfilling Meta leads:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron recuperar los leads." }, { status: 502 });
  }
}
