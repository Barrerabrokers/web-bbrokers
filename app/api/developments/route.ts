import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getDevelopments,
  createDevelopment,
} from "@/lib/developments-db";
import { z } from "zod";

const imageSchema = z.object({
  url: z.string().url(),
  type: z.string().optional(),
  caption: z.string().optional(),
});

const developmentSchema = z.object({
  name: z.string().min(3, "El nombre es muy corto"),
  shortDescription: z.string().optional(),
  description: z.string().min(10, "La descripcion es muy corta"),
  location: z.string().min(2, "Ubicacion muy corta"),
  address: z.string().min(2, "Direccion muy corta"),
  status: z
    .enum(["pre_venta", "en_construccion", "finalizado", "entregado"])
    .optional(),
  totalUnits: z.number().int().nonnegative().optional(),
  completionDate: z.string().optional(),
  progress: z.number().int().min(0).max(100).optional(),
  priceFrom: z.number().positive().optional(),
  amenities: z.array(z.string()).default([]),
  features: z.array(z.string()).default([]),
  highlight: z.boolean().optional(),
  agentId: z.string().optional(),
  images: z.array(imageSchema).default([]),
});


export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status") || undefined;
    const highlightParam = searchParams.get("highlight");
    const highlight =
      highlightParam === "true"
        ? true
        : highlightParam === "false"
        ? false
        : undefined;

    const developments = await getDevelopments({ status, highlight });

    return NextResponse.json(developments);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Error al obtener desarrollos: " + error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const body = await request.json();
    if (!body.agentId && session.user?.id) body.agentId = session.user.id;

    const result = developmentSchema.safeParse(body);
    if (!result.success) {
      const errors = result.error.errors.map(
        (e) => `${e.path.join(".")}: ${e.message}`
      );
      return NextResponse.json(
        { error: `Datos invalidos: ${errors.join(", ")}` },
        { status: 400 }
      );
    }

    const { development, error: dbError } = await createDevelopment(
      result.data as any
    );

    if (!development) {
      return NextResponse.json(
        { error: `Error al guardar: ${dbError || "desconocido"}` },
        { status: 500 }
      );
    }

    return NextResponse.json(development, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Error: ${error.message}` },
      { status: 500 }
    );
  }
}
