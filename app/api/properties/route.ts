import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createProperty, getProperties } from "@/lib/db";
import { canManageListings } from "@/lib/roles";
import { z } from "zod";

const propertySchema = z.object({
  title: z.string().min(3, "El titulo es muy corto"),
  description: z.string().min(10, "La descripcion es muy corta"),
  category: z.enum(["desarrollo", "pozo", "usados", "rentals", "inversiones", "oportunidades"]),
  price: z.number().positive("El precio debe ser positivo"),
  location: z.string().min(2, "Ubicacion muy corta"),
  address: z.string().min(2, "Direccion muy corta"),
  bedrooms: z.number().optional(),
  bathrooms: z.number().optional(),
  area: z.number().positive("El area debe ser positiva"),
  expenses: z.number().optional(),
  images: z.array(z.string()).min(1, "Debes subir al menos una imagen"),
  videoUrls: z.array(z.string().url()).default([]),
  videoIsPrimary: z.boolean().default(false),
  features: z.array(z.string()).default([]),
  agentId: z.string().min(1, "agentId requerido"),
  status: z.enum(["disponible", "reservada", "vendida"]).default("disponible"),
  visibility: z.enum(["public", "agents"]).default("public"),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const visibility = searchParams.get("visibility");

    const filter: any = {};
    if (category) filter.category = category;
    if (status) filter.status = status;
    if (visibility) {
      filter.visibility = visibility;
    } else if (!session) {
      filter.visibility = "public";
    }

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
        { error: "No autorizado. Debes iniciar sesion." },
        { status: 401 }
      );
    }

    if (!canManageListings(session.user.role)) {
      return NextResponse.json(
        { error: "No autorizado para gestionar propiedades" },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Asegurarse de que agentId esté seteado
    if (!body.agentId && session.user?.id) {
      body.agentId = session.user.id;
    }

    const result = propertySchema.safeParse(body);

    if (!result.success) {
      // Devolver mensaje de error mas claro
      const errors = result.error.errors.map((e) => {
        const field = e.path.join(".");
        return `${field}: ${e.message}`;
      });

      return NextResponse.json(
        {
          error: `Datos invalidos: ${errors.join(", ")}`,
          details: result.error.errors,
        },
        { status: 400 }
      );
    }

    const { property, error: dbError } = await createProperty(result.data as any);

    if (!property) {
      return NextResponse.json(
        {
          error: `Error al guardar la propiedad: ${dbError || "desconocido"}`,
          dbError,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(property, { status: 201 });
  } catch (error: any) {
    console.error("Error creating property:", error);
    return NextResponse.json(
      { error: `Error al crear la propiedad: ${error.message}` },
      { status: 500 }
    );
  }
}
