import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import {
  getCrmExtensionPreferences,
  upsertCrmExtensionPreferences,
} from "@/lib/db";
import { canManageListings } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const preferencesSchema = z.object({
  contactTabs: z.array(z.object({
    id: z.string().trim().min(1).max(80),
    name: z.string().trim().min(1).max(40),
    status: z.string().trim().max(80).default(""),
    kind: z.string().trim().max(30).optional(),
  })).max(30),
  featuredLeadIds: z.array(z.string().uuid()).max(1000),
});

async function requireApprovedAgent() {
  const session = await getServerSession(authOptions);
  if (!session || !canManageListings(session.user.role)) return null;
  return session;
}

export async function GET() {
  const session = await requireApprovedAgent();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const preferences = await getCrmExtensionPreferences(session.user.id);
  return NextResponse.json({ preferences });
}

export async function PUT(request: NextRequest) {
  const session = await requireApprovedAgent();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const parsed = preferencesSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "La configuración de la extensión no es válida" }, { status: 400 });
  }

  const preferences = await upsertCrmExtensionPreferences(session.user.id, parsed.data);
  return NextResponse.json({ preferences });
}
