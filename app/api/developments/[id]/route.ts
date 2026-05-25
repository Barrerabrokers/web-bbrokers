import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getDevelopmentById,
  updateDevelopment,
  deleteDevelopment,
} from "@/lib/developments-db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const development = await getDevelopmentById(params.id);
  if (!development) {
    return NextResponse.json(
      { error: "No encontrado" },
      { status: 404 }
    );
  }
  return NextResponse.json(development);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { development, error } = await updateDevelopment(params.id, body);
    if (!development) {
      return NextResponse.json(
        { error: error || "Error al actualizar" },
        { status: 500 }
      );
    }
    return NextResponse.json(development);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const ok = await deleteDevelopment(params.id);
  if (!ok) {
    return NextResponse.json(
      { error: "Error al eliminar" },
      { status: 500 }
    );
  }
  return NextResponse.json({ success: true });
}
