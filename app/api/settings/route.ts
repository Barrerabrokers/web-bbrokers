import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getFullSiteSettings, updateFullSiteSettings } from "@/lib/db";
import { canManageSiteSettings } from "@/lib/roles";

export const dynamic = "force-dynamic";

/** GET — Público. Devuelve TODOS los settings (contacto + about). */
export async function GET() {
  try {
    const settings = await getFullSiteSettings();
    return NextResponse.json(settings, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch {
    return NextResponse.json({ error: "Error al obtener settings" }, { status: 500 });
  }
}

/** PUT — Admin y marketing. Actualiza uno o más campos. */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !canManageSiteSettings(session.user.role)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();

    const allowed = [
      // Contacto / empresa
      "companyName",
      "logoUrl",
      "faviconUrl",
      "heroVideos",
      "email",
      "phone",
      "whatsapp",
      "addressStreet",
      "addressCity",
      "whatsappMessage",
      // Nosotros
      "aboutImage",
      "aboutVideo",
      "aboutEyebrow",
      "aboutTitle",
      "aboutDescription",
      "aboutStatNumber",
      "aboutStatLabel",
      "aboutValue1Title",
      "aboutValue1Description",
      "aboutValue2Title",
      "aboutValue2Description",
      "aboutValue3Title",
      "aboutValue3Description",
      // Estadísticas
      "statsTitle",
      "statsQuote",
      "statsItem1Value",       "statsItem1Suffix",      "statsItem1Label",       "statsItem1Description",
      "statsItem2Value",       "statsItem2Suffix",      "statsItem2Label",       "statsItem2Description",
      "statsItem3Value",       "statsItem3Suffix",      "statsItem3Label",       "statsItem3Description",
      "statsItem4Value",       "statsItem4Suffix",      "statsItem4Label",       "statsItem4Description",
      // Inversión
      "investmentImage",
      "investmentVideo",
      "investmentEyebrow",
      "investmentTitle",
      "investmentDescription",
      "investmentStep1Title",       "investmentStep1Highlight",   "investmentStep1Value",       "investmentStep1Description",
      "investmentStep2Title",       "investmentStep2Highlight",   "investmentStep2Value",       "investmentStep2Description",
      "investmentStep3Title",       "investmentStep3Highlight",   "investmentStep3Value",       "investmentStep3Description",
      "investmentStep4Title",       "investmentStep4Highlight",   "investmentStep4Value",       "investmentStep4Description",
      "investmentBenefit1", "investmentBenefit2", "investmentBenefit3",
      "investmentBenefit4", "investmentBenefit5", "investmentBenefit6",
      "investmentBenefitsTitle",
      "investmentCtaEyebrow",
      "investmentCtaTitle",
      "investmentCtaDescription",
      // Prensa
      "pressLinks",
    ] as const;

    const data: any = {};
    for (const k of allowed) {
      if (k === "heroVideos") {
        if (body.heroVideos !== undefined) {
          data.heroVideos = Array.isArray(body.heroVideos)
            ? body.heroVideos
                .map((url: unknown) => String(url).trim())
                .filter(Boolean)
                .slice(0, 3)
            : [];
        }
        continue;
      }
      if (body[k] !== undefined) data[k] = String(body[k]);
    }

    // Trim de strings cortos (mantener saltos de línea en descripciones)
    const trimFields = [
      "companyName", "email", "phone", "whatsapp",
      "logoUrl", "faviconUrl",
      "addressStreet", "addressCity",
      "aboutImage", "aboutVideo", "aboutEyebrow", "aboutTitle",
      "aboutStatNumber", "aboutStatLabel",
      "aboutValue1Title", "aboutValue2Title", "aboutValue3Title",
      "statsTitle",
      "statsItem1Value", "statsItem1Suffix", "statsItem1Label",
      "statsItem2Value", "statsItem2Suffix", "statsItem2Label",
      "statsItem3Value", "statsItem3Suffix", "statsItem3Label",
      "statsItem4Value", "statsItem4Suffix", "statsItem4Label",
      "investmentImage", "investmentVideo",
    ];
    for (const k of trimFields) {
      if (data[k]) data[k] = data[k].trim();
    }

    if (data.whatsapp) data.whatsapp = data.whatsapp.replace(/[^\d]/g, "");

    const { settings, error } = await updateFullSiteSettings(data);

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
