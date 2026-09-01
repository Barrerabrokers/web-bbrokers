import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDevelopmentById } from "@/lib/developments-db";
import { createTextPdf, loadPdfImages, pdfFileName } from "@/lib/simple-pdf";
import { absoluteUrl } from "@/lib/seo";
import { DEVELOPMENT_STATUS_LABELS } from "@/types";
import { formatPrice } from "@/lib/utils";
import { hasValidShareToken, withShareParam } from "@/lib/share-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  const development = await getDevelopmentById(params.id);
  const shareToken = new URL(request.url).searchParams.get("share");
  const hasSharedAccess =
    development?.visibility === "agents" &&
    hasValidShareToken(shareToken, "development", params.id);

  if (!development || (development.visibility === "agents" && !session && !hasSharedAccess)) {
    return NextResponse.json({ error: "Desarrollo no encontrado" }, { status: 404 });
  }

  const priceFrom = development.minPriceAvailable ?? development.priceFrom;
  const pageUrl = absoluteUrl(
    withShareParam(
      `/desarrollos/${development.slug}`,
      development.visibility === "agents" ? shareToken || undefined : undefined
    )
  );
  const primaryImage =
    development.images.find((image) => image.isPrimary)?.url ||
    development.images[0]?.url;
  const orderedImages = [
    ...(primaryImage ? [primaryImage] : []),
    ...development.images.map((image) => image.url).filter((url) => url && url !== primaryImage),
  ];
  const pdfImages = await loadPdfImages(orderedImages, 4);

  const pdf = createTextPdf({
    title: development.name,
    subtitle: `${development.address} - ${development.location}`,
    images: pdfImages,
    lines: [
      { text: "Ficha de desarrollo", size: 13, bold: true, gapAfter: 12 },
      { text: `Desde: ${priceFrom ? formatPrice(priceFrom) : "Consultar"}`, size: 14, bold: true },
      { text: `Estado: ${DEVELOPMENT_STATUS_LABELS[development.status]}`, size: 11 },
      { text: `Entrega: ${development.completionDate || "A confirmar"}`, size: 11 },
      { text: `Avance de obra: ${development.progress}%`, size: 11 },
      { text: `Unidades: ${development.unitsCount || development.totalUnits || 0}`, size: 11 },
      ...(development.availableUnits !== undefined
        ? [{ text: `Disponibles: ${development.availableUnits}`, size: 11 }]
        : []),
      { text: "Descripcion", size: 14, bold: true, gapAfter: 8 },
      { text: development.shortDescription || development.description, size: 11, gapAfter: 10 },
      ...(development.shortDescription
        ? [{ text: development.description, size: 10, muted: true, gapAfter: 14 }]
        : []),
      ...(development.features.length > 0 || development.amenities.length > 0
        ? [
            { text: "Caracteristicas y amenities", size: 14, bold: true, gapAfter: 8 },
            ...[...development.features, ...development.amenities].map((item) => ({
              text: `- ${item}`,
              size: 10,
              gapAfter: 4,
            })),
          ]
        : []),
    ],
    links: [
      { label: "Ver desarrollo online", url: pageUrl },
    ],
  });

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${pdfFileName(development.name)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
