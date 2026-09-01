import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPropertyById } from "@/lib/db";
import { createTextPdf, loadPdfImages, pdfFileName } from "@/lib/simple-pdf";
import { absoluteUrl } from "@/lib/seo";
import { formatPrice, formatPriceARS } from "@/lib/utils";
import { hasValidShareToken, withShareParam } from "@/lib/share-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  const property = await getPropertyById(params.id);
  const shareToken = new URL(request.url).searchParams.get("share");
  const hasSharedAccess =
    property?.visibility === "agents" &&
    hasValidShareToken(shareToken, "property", params.id);

  if (!property || (property.visibility === "agents" && !session && !hasSharedAccess)) {
    return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });
  }

  const pageUrl = absoluteUrl(
    withShareParam(
      `/propiedades/${property.id}`,
      property.visibility === "agents" ? shareToken || undefined : undefined
    )
  );
  const pdfImages = await loadPdfImages(property.images, 4);
  const pdf = createTextPdf({
    title: property.title,
    subtitle: `${property.address} - ${property.location}`,
    images: pdfImages,
    lines: [
      { text: "Ficha de propiedad", size: 13, bold: true, gapAfter: 12 },
      { text: `Precio: ${formatPrice(property.price)}`, size: 14, bold: true },
      ...(property.expenses
        ? [{ text: `Expensas: ${formatPriceARS(property.expenses)}/mes`, size: 11 }]
        : []),
      { text: `Estado: ${property.status}`, size: 11 },
      { text: `Categoria: ${property.category}`, size: 11 },
      { text: `Superficie: ${property.area} m2`, size: 11 },
      ...(property.bedrooms ? [{ text: `Dormitorios: ${property.bedrooms}`, size: 11 }] : []),
      ...(property.bathrooms ? [{ text: `Banos: ${property.bathrooms}`, size: 11 }] : []),
      { text: "Descripcion", size: 14, bold: true, gapAfter: 8 },
      { text: property.description, size: 11, gapAfter: 14 },
      ...(property.features.length > 0
        ? [
            { text: "Caracteristicas", size: 14, bold: true, gapAfter: 8 },
            ...property.features.map((feature) => ({ text: `- ${feature}`, size: 10, gapAfter: 4 })),
          ]
        : []),
    ],
    links: [
      { label: "Ver propiedad online", url: pageUrl },
    ],
  });

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${pdfFileName(property.title)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
