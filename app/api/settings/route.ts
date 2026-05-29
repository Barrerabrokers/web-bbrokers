import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSiteSettings, updateSiteSettings } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET — Público. Devuelve los settings actuales (con fallback a defaults). */
export async function GET() {
  try {
    const settings = await getSiteSettings();
    return NextResponse.json(settings, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch {
    return NextResponse.json({ error: "Error al obtener settings" }, { status: 500 });
  }
}

/** PUT — Solo admin. Actualiza uno o más campos. */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();

    // Whitelist de campos editables
    const allowed = [
      "companyName",
      "email",
      "phone",
      "whatsapp",
      "addressStreet",
      "addressCity",
      "whatsappMessage",
    ] as const;

    const data: any = {};
    for (const k of allowed) {
      if (body[k] !== undefined) data[k] = String(body[k]).trim();
    }

    // Sanity: WhatsApp solo dígitos
    if (data.whatsapp) data.whatsapp = data.whatsapp.replace(/[^\d]/g, "");

    const { settings, error } = await updateSiteSettings(data);

    if (error || !settings) {
      return NextResponse.json(
        { error: error || "Error al guardar" },
        { status: 500 }
      );
    }

    return NextResponse.json(settings);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Error desconocido" },
      { status: 500 }
    );
  }
}
