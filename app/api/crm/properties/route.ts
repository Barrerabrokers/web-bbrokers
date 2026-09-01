import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import {
  deleteCrmDataProperty,
  getCrmDataProperties,
  upsertCrmDataProperty,
  type CrmDataPropertyType,
} from "@/lib/db";
import { canManageAdminPanel, canManageListings } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const propertyTypes = ["lead_status", "development"] as const;

const propertySchema = z.object({
  id: z.string().uuid().or(z.literal("")).optional(),
  type: z.enum(propertyTypes),
  value: z.string().trim().min(1),
  label: z.string().trim().min(1),
  hubspotValue: z.string().trim().optional().default(""),
  localDevelopmentId: z.string().uuid().or(z.literal("")).optional(),
  active: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional().default(0),
});

async function requireCrmAccess() {
  const session = await getServerSession(authOptions);
  if (!session || !canManageListings(session.user.role)) return null;
  return session;
}

async function requireCrmSettingsAccess() {
  const session = await getServerSession(authOptions);
  if (!session || !canManageAdminPanel(session.user.role)) return null;
  return session;
}

export async function GET(request: NextRequest) {
  const session = await requireCrmAccess();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const type = request.nextUrl.searchParams.get("type") as CrmDataPropertyType | null;
  const properties = await getCrmDataProperties(
    type && propertyTypes.includes(type) ? type : undefined
  );

  return NextResponse.json({ properties });
}

export async function POST(request: NextRequest) {
  const session = await requireCrmSettingsAccess();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = propertySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Revisá tipo, etiqueta y valor de la propiedad" },
      { status: 400 }
    );
  }

  const { property, error } = await upsertCrmDataProperty({
    ...parsed.data,
    id: parsed.data.id || undefined,
    localDevelopmentId: parsed.data.localDevelopmentId || undefined,
  });

  if (!property) {
    return NextResponse.json(
      { error: error || "No se pudo guardar la propiedad" },
      { status: 500 }
    );
  }

  return NextResponse.json({ property });
}

export async function DELETE(request: NextRequest) {
  const session = await requireCrmSettingsAccess();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Falta el ID de la propiedad" }, { status: 400 });
  }

  const result = await deleteCrmDataProperty(id);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "No se pudo eliminar la propiedad" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
