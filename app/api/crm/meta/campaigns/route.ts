import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { getMetaMarketingDashboard, updateMetaCampaignStatus } from "@/lib/meta-ads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "Esta función está disponible solamente para administradores." }, { status: 403 });
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") return unauthorized();
  const days = Number(request.nextUrl.searchParams.get("days") || 30);
  try {
    const dashboard = await getMetaMarketingDashboard(days);
    return NextResponse.json(dashboard, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Error loading Meta campaigns:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron consultar las campañas de Meta." }, { status: 502 });
  }
}

const updateSchema = z.object({
  campaignId: z.string().regex(/^\d+$/),
  status: z.enum(["ACTIVE", "PAUSED"]),
});

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") return unauthorized();
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Cambio de campaña inválido." }, { status: 400 });
  try {
    await updateMetaCampaignStatus(parsed.data.campaignId, parsed.data.status);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating Meta campaign:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo actualizar la campaña." }, { status: 502 });
  }
}
