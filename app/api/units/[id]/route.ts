import { unitForPriceViewer } from "@/lib/development-price-visibility";
import { canReadListing } from "@/lib/listing-visibility-policy";
import { hasValidShareToken } from "@/lib/share-token";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getUnitById,
  getDevelopmentById,
  updateUnit,
  deleteUnit,
} from "@/lib/developments-db";
import { canManageListings } from "@/lib/roles";

export async function GET(
  _req: NextRequest,
  { params: pendingparams }: { params: Promise<{ id: string }> }
) {
  const params = await pendingparams;
  const unit = await getUnitById(params.id);
  if (!unit) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }
  const session = await getServerSession(authOptions);
  const development = await getDevelopmentById(unit.developmentId);
  const token = _req.nextUrl.searchParams.get("share");
  const shared = hasValidShareToken(token, "unit", unit.id) || hasValidShareToken(token, "development", unit.developmentId);
  if (!development || !canReadListing(development.visibility, session?.user.role, shared)) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  return NextResponse.json(unitForPriceViewer(unit, development.slug, session?.user.role), { headers: { "Cache-Control": "private, no-store" } });
}

export async function PUT(
  request: NextRequest,
  { params: pendingparams }: { params: Promise<{ id: string }> }
) {
  const params = await pendingparams;
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!canManageListings(session.user.role)) {
    return NextResponse.json(
      { error: "No autorizado para gestionar unidades" },
      { status: 403 }
    );
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
  { params: pendingparams }: { params: Promise<{ id: string }> }
) {
  const params = await pendingparams;
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!canManageListings(session.user.role)) {
    return NextResponse.json(
      { error: "No autorizado para gestionar unidades" },
      { status: 403 }
    );
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
