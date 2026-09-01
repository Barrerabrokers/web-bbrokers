import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDevelopmentById, getUnitById } from "@/lib/developments-db";
import { createTextPdf, loadPdfImages, pdfFileName } from "@/lib/simple-pdf";
import { absoluteUrl } from "@/lib/seo";
import { formatPrice, formatPriceARS } from "@/lib/utils";
import { hasValidShareToken, withShareParam } from "@/lib/share-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  disponible: "Disponible",
  reservada: "Reservada",
  vendida: "Vendida",
};

function bedroomsLabel(value: number) {
  if (value === 0) return "Monoambiente";
  return `${value} ambiente${value > 1 ? "s" : ""}`;
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  const unit = await getUnitById(params.id);

  if (!unit) {
    return NextResponse.json({ error: "Unidad no encontrada" }, { status: 404 });
  }

  const development = await getDevelopmentById(unit.developmentId);
  const shareToken = new URL(request.url).searchParams.get("share");
  const hasSharedAccess =
    development?.visibility === "agents" &&
    (hasValidShareToken(shareToken, "development", development.id) ||
      hasValidShareToken(shareToken, "unit", unit.id));

  if (!development || (development.visibility === "agents" && !session && !hasSharedAccess)) {
    return NextResponse.json({ error: "Unidad no encontrada" }, { status: 404 });
  }

  const comments = new URL(request.url).searchParams
    .get("comments")
    ?.trim()
    .slice(0, 900);
  const pageUrl = absoluteUrl(
    withShareParam(
      `/desarrollos/${development.slug}?unidad=${encodeURIComponent(unit.id)}`,
      development.visibility === "agents" ? shareToken || undefined : undefined
    )
  );
  const primaryImage =
    unit.images.find((image) => image.isPrimary)?.url ||
    unit.images.find((image) => image.type === "plano")?.url ||
    unit.images[0]?.url;
  const orderedImages = [
    ...(primaryImage ? [primaryImage] : []),
    ...unit.images.map((image) => image.url).filter((url) => url && url !== primaryImage),
  ];
  const pdfImages = await loadPdfImages(orderedImages, 4);

  const pdf = createTextPdf({
    title: `Unidad ${unit.unitNumber}`,
    subtitle: `${development.name} - ${development.address}, ${development.location}`,
    images: pdfImages,
    lines: [
      { text: "Ficha de unidad", size: 13, bold: true, gapAfter: 12 },
      { text: `Precio final: ${formatPrice(unit.price)}`, size: 14, bold: true },
      ...(unit.downPayment
        ? [{ text: `Anticipo: ${formatPrice(unit.downPayment)}`, size: 11 }]
        : []),
      ...(unit.installmentCount && unit.installmentValue
        ? [
            {
              text: `${unit.installmentCount} cuotas de ${formatPrice(unit.installmentValue)}`,
              size: 11,
            },
          ]
        : []),
      { text: `Estado: ${STATUS_LABELS[unit.status] || unit.status}`, size: 11 },
      { text: `Tipologia: ${bedroomsLabel(unit.bedrooms)}`, size: 11 },
      { text: `Banos: ${unit.bathrooms}`, size: 11 },
      { text: `Superficie cubierta: ${unit.area} m2`, size: 11 },
      ...(unit.balconyArea ? [{ text: `Balcon: ${unit.balconyArea} m2`, size: 11 }] : []),
      ...(unit.totalArea ? [{ text: `Superficie total: ${unit.totalArea} m2`, size: 11 }] : []),
      ...(unit.floor ? [{ text: `Piso: ${unit.floor}`, size: 11 }] : []),
      ...(unit.orientation ? [{ text: `Orientacion: ${unit.orientation}`, size: 11 }] : []),
      ...(unit.expenses
        ? [{ text: `Expensas: ${formatPriceARS(unit.expenses)}/mes`, size: 11 }]
        : []),
      ...(unit.description
        ? [
            { text: "Descripcion", size: 14, bold: true, gapAfter: 8 },
            { text: unit.description, size: 11, gapAfter: 14 },
          ]
        : []),
      ...(comments
        ? [
            { text: "Comentarios", size: 14, bold: true, gapAfter: 8 },
            { text: comments, size: 11, gapAfter: 14 },
          ]
        : []),
      ...(unit.features.length > 0
        ? [
            { text: "Caracteristicas", size: 14, bold: true, gapAfter: 8 },
            ...unit.features.map((feature) => ({ text: `- ${feature}`, size: 10, gapAfter: 4 })),
          ]
        : []),
    ],
    links: [{ label: "Ver unidad online", url: pageUrl }],
  });

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${pdfFileName(
        `${development.name}-unidad-${unit.unitNumber}`
      )}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
