import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { canManageListings } from "@/lib/roles";
import { createQuotePresentationPdf, loadPdfImages, pdfFileName, type PdfImage } from "@/lib/simple-pdf";
import { formatPrice, formatPriceARS } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QUOTE_IMAGE_LIMIT = 2;

const quoteSchema = z.object({
  developmentName: z.string().min(1),
  developmentSlug: z.string().optional(),
  address: z.string().optional(),
  location: z.string().optional(),
  clientName: z.string().optional(),
  clientPhone: z.string().optional(),
  clientEmail: z.string().optional(),
  unitNumber: z.string().min(1),
  floor: z.string().optional(),
  bedrooms: z.number().int().nonnegative(),
  bathrooms: z.number().int().nonnegative(),
  area: z.number().positive(),
  balconyArea: z.number().nonnegative().optional(),
  totalArea: z.number().nonnegative().optional(),
  downPayment: z.number().nonnegative().optional(),
  installmentCount: z.number().int().nonnegative().optional(),
  installmentValue: z.number().nonnegative().optional(),
  price: z.number().positive(),
  expenses: z.number().nonnegative().optional(),
  currency: z.string().default("USD"),
  orientation: z.string().optional(),
  status: z.enum(["disponible", "reservada", "vendida", "consultar"]).default("disponible"),
  description: z.string().optional(),
  features: z.array(z.string()).default([]),
  comments: z.string().optional(),
  imageUrls: z.array(z.string().url()).max(QUOTE_IMAGE_LIMIT).default([]),
  inlineImages: z
    .array(
      z.object({
        data: z.string().min(1),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      })
    )
    .max(QUOTE_IMAGE_LIMIT)
    .default([]),
});

const STATUS_LABELS: Record<string, string> = {
  disponible: "Disponible",
  reservada: "Reservada",
  vendida: "Vendida",
  consultar: "Consultar",
};

function formatMoney(value: number, currency: string) {
  return currency.toUpperCase() === "ARS" ? formatPriceARS(value) : formatPrice(value);
}

function bedroomsLabel(value: number) {
  if (value === 0) return "Monoambiente";
  return `${value} ambiente${value > 1 ? "s" : ""}`;
}

function compactText(value: string | undefined, maxLength: number) {
  if (!value) return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageListings(session.user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = quoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos invalidos para generar la cotizacion" },
      { status: 400 }
    );
  }

  const quote = parsed.data;
  const inlinePdfImages: PdfImage[] = quote.inlineImages
    .slice(0, QUOTE_IMAGE_LIMIT)
    .map((image) => ({
      data: Buffer.from(image.data, "base64"),
      width: image.width,
      height: image.height,
      mimeType: "image/jpeg" as const,
    }))
    .filter((image) => image.data.length > 0 && image.data.length <= 3 * 1024 * 1024);
  const pdfImages = inlinePdfImages.length
    ? inlinePdfImages
    : await loadPdfImages(quote.imageUrls.slice(0, QUOTE_IMAGE_LIMIT), QUOTE_IMAGE_LIMIT);

  const description = compactText(quote.description, 190);
  const comments = compactText(quote.comments, 170);
  const paymentLine =
    quote.installmentCount && quote.installmentValue
      ? `${quote.installmentCount} cuotas de ${formatMoney(quote.installmentValue, quote.currency)}`
      : undefined;
  const totalArea = quote.totalArea || quote.area + (quote.balconyArea || 0);
  const commercialFeatures = [
    `Precio final: ${formatMoney(quote.price, quote.currency)}`,
    quote.downPayment ? `Anticipo: ${formatMoney(quote.downPayment, quote.currency)}` : undefined,
    paymentLine,
    quote.expenses ? `Expensas: ${formatPriceARS(quote.expenses)}/mes` : undefined,
    quote.orientation ? `Orientacion: ${quote.orientation}` : undefined,
    `Estado: ${STATUS_LABELS[quote.status]}`,
    ...quote.features,
    description ? `Descripcion: ${description}` : undefined,
    comments ? `Comentario: ${comments}` : undefined,
  ].filter((item): item is string => Boolean(item));

  const tableRows = [
    { label: "Unidad", value: quote.unitNumber },
    { label: "Piso/Nivel", value: quote.floor || "Consultar" },
    { label: "Tipologia", value: bedroomsLabel(quote.bedrooms) },
    { label: "Banos", value: String(quote.bathrooms) },
    { label: "Area cubierta", value: `${quote.area} m2` },
    ...(quote.balconyArea ? [{ label: "Area balcon", value: `${quote.balconyArea} m2` }] : []),
    { label: "Area propia total", value: `${totalArea} m2` },
    ...(quote.clientName ? [{ label: "Cliente", value: quote.clientName }] : []),
  ];

  const pdf = createQuotePresentationPdf({
    title: "Tipologias de departamentos",
    planLabel: `Plano # ${quote.unitNumber}`,
    unitLabel: `${quote.developmentName} - Unidad ${quote.unitNumber}`,
    subtitle: [
      quote.developmentName,
      quote.address,
      quote.location,
    ]
      .filter(Boolean)
      .join(" - "),
    features: commercialFeatures,
    tableRows,
    images: pdfImages,
    footer: "Cotizacion referencial sujeta a disponibilidad. barrerabrokers.com",
  });

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${pdfFileName(
        `${quote.developmentName}-unidad-${quote.unitNumber}-cotizacion`
      )}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
