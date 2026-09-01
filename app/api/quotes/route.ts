import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { deleteQuote, getQuotes, upsertQuote } from "@/lib/db";
import { canManageListings } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QUOTE_IMAGE_LIMIT = 2;

const quotePayloadSchema = z.object({
  developmentId: z.string().min(1),
  developmentName: z.string().optional(),
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
  imageUrls: z.array(z.string().min(1)).max(QUOTE_IMAGE_LIMIT).default([]),
  pdfUrl: z.string().min(1).optional(),
});

const quoteSchema = z.object({
  id: z.string().uuid().optional(),
  developmentId: z.string().min(1),
  developmentName: z.string().min(1),
  developmentSlug: z.string().optional().default(""),
  clientName: z.string().optional().default(""),
  clientPhone: z.string().optional().default(""),
  clientEmail: z.string().optional().default(""),
  unitNumber: z.string().min(1),
  payload: quotePayloadSchema,
});

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session || !canManageListings(session.user.role)) return null;
  return session;
}

export async function GET() {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const quotes = await getQuotes({
    viewerId: session.user.id,
    viewerRole: session.user.role,
  });
  return NextResponse.json({ quotes });
}

export async function POST(request: NextRequest) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = quoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Datos invalidos para guardar la cotizacion",
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  const { quote, error } = await upsertQuote({
    ...parsed.data,
    payload: parsed.data.payload,
    developmentSlug: parsed.data.developmentSlug || "",
    createdBy: session.user.id,
    viewerRole: session.user.role,
  });

  if (!quote) {
    return NextResponse.json(
      { error: error || "No se pudo guardar la cotizacion" },
      { status: 500 }
    );
  }

  return NextResponse.json({ quote });
}

export async function DELETE(request: NextRequest) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  const result = await deleteQuote(id, {
    viewerId: session.user.id,
    viewerRole: session.user.role,
  });
  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "No se pudo eliminar la cotizacion" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
