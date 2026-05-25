import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getUnitsByDevelopment,
  createUnit,
} from "@/lib/developments-db";
import { z } from "zod";

const imageSchema = z.object({
  url: z.string().url(),
  type: z.string().optional(),
});

const unitSchema = z.object({
  developmentId: z.string().min(1),
  unitNumber: z.string().min(1),
  floor: z.string().optional(),
  bedrooms: z.number().int().nonnegative(),
  bathrooms: z.number().int().nonnegative(),
  area: z.number().positive(),
  balconyArea: z.number().nonnegative().optional(),
  totalArea: z.number().nonnegative().optional(),
  price: z.number().positive(),
  expenses: z.number().nonnegative().optional(),
  orientation: z.string().optional(),
  status: z.enum(["disponible", "reservada", "vendida"]).optional(),
  description: z.string().optional(),
  features: z.array(z.string()).default([]),
  images: z.array(imageSchema).default([]),
});

export async function GET(request: NextRequest) {
  const developmentId = request.nextUrl.searchParams.get("developmentId");
  if (!developmentId) {
    return NextResponse.json(
      { error: "developmentId es requerido" },
      { status: 400 }
    );
  }
  const units = await getUnitsByDevelopment(developmentId);
  return NextResponse.json(units);
}


export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const result = unitSchema.safeParse(body);
    if (!result.success) {
      const errors = result.error.errors.map(
        (e) => `${e.path.join(".")}: ${e.message}`
      );
      return NextResponse.json(
        { error: `Datos invalidos: ${errors.join(", ")}` },
        { status: 400 }
      );
    }

    const { unit, error } = await createUnit(result.data as any);
    if (!unit) {
      return NextResponse.json(
        { error: `Error al guardar: ${error || "desconocido"}` },
        { status: 500 }
      );
    }
    return NextResponse.json(unit, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Error: ${error.message}` },
      { status: 500 }
    );
  }
}
