import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canManageSiteSettings } from "@/lib/roles";
import { fetchPressPreview } from "@/lib/press-preview";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageSiteSettings(session.user.role)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    const body = await request.json();
    if (typeof body.url !== "string" || body.url.length > 2048) return NextResponse.json({ error: "Ingresá un enlace válido." }, { status: 400 });
    const data = await fetchPressPreview(body.url);
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo importar la nota. Podés completarla manualmente." }, { status: 400 });
  }
}
