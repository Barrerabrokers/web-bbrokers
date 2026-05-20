import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createProperty, getProperties } from "@/lib/db";
import { z } from "zod";

const propertySchema = z.object({
  title: z.string().min(5),
  description: z.string().min(20),
  category: z.enum(["desarrollo", "pozo", "usados", "rentals", "inversiones", "oportunidades"]),
  price: z.number().positive(),
  location: z.string().min(3),
  address: z.string().min(5),
  bedrooms: z.number().optional(),
  bathrooms: z.number().optional(),
  area: z.number().positive(),
  images: z.array(z.string().url()),
  features: z.array(z.string()),
  agentId: z.string(),
  status: z.enum(["disponible", "reservada", "vendida"]),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get("category");
    const status = searchParams.get("status");

    const filter: any = {};
    if (category) filter.category = category;
    if (status) filter.status = status;

    const properties = await getProperties(filter);

    return NextResponse.json(properties);
  } catch (error) {
    return NextResponse.json(
      { error: "Error al obtener propiedades" },
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
    const validatedData = propertySchema.parse(body);

    const property = await createProperty(validatedData);

    return NextResponse.json(property, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Datos inválidos", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Error al crear la propiedad" },
      { status: 500 }
    );
  }
}
