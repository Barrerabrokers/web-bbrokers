import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPropertyById, updateProperty, deleteProperty } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const property = await getPropertyById(params.id);

    if (!property) {
      return NextResponse.json(
        { error: "Propiedad no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json(property);
  } catch (error) {
    return NextResponse.json(
      { error: "Error al obtener la propiedad" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { property, error } = await updateProperty(params.id, body);

    if (!property) {
      return NextResponse.json(
        { error: `Error al actualizar: ${error || "desconocido"}` },
        { status: 500 }
      );
    }

    return NextResponse.json(property);
  } catch (error: any) {
    return NextResponse.json(
      { error: `Error al actualizar la propiedad: ${error.message}` },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const success = await deleteProperty(params.id);

    if (!success) {
      return NextResponse.json(
        { error: "Error al eliminar la propiedad" },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Propiedad eliminada" });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Error al eliminar la propiedad: ${error.message}` },
      { status: 500 }
    );
  }
}
