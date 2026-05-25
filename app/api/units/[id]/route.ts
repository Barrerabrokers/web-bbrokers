import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getUnitById,
  updateUnit,
  deleteUnit,
} from "@/lib/developments-db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const unit = await getUnitById(params.id);
  if (!unit) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }
  return NextResponse.json(unit);
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
    const { unit, error } = await updateUnit(params.id, body);
    if (!unit) {
      return NextResponse.json(
        { error: error || "Error al actualizar" },
        { status: 500 }
      );
    }
    return NextResponse.json(unit);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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
  const ok = await deleteUnit(params.id);
  if (!ok) {
    return NextResponse.json(
      { error: "Error al eliminar" },
      { status: 500 }
    );
  }
  return NextResponse.json({ success: true });
}
