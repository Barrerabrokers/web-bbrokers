import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import {
  getCrmExtensionPreferences,
  getCrmLeadById,
  setCrmExtensionContactTabs,
  setCrmFeaturedLead,
} from "@/lib/db";
import { canManageListings, canViewAllCrmContacts } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const preferencesSchema = z.object({
  contactTabs: z.array(z.object({
    id: z.string().trim().min(1).max(80),
    name: z.string().trim().min(1).max(40),
    status: z.string().trim().max(80).default(""),
    kind: z.string().trim().max(30).optional(),
  })).max(30),
});

const featuredSchema = z.object({
  leadId: z.string().uuid(),
  featured: z.boolean(),
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
  return NextResponse.json({ preferences }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

export async function PUT(request: NextRequest) {
  const session = await requireApprovedAgent();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const parsed = preferencesSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "La configuración de la extensión no es válida" }, { status: 400 });
  }

  // Updating the tab layout must never overwrite favorites. Stars are changed
  // independently through PATCH so concurrent CRM/extension updates stay safe.
  const preferences = await setCrmExtensionContactTabs(session.user.id, parsed.data.contactTabs);
  return NextResponse.json({ preferences });
}

export async function PATCH(request: NextRequest) {
  const session = await requireApprovedAgent();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const parsed = featuredSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "El contacto destacado no es válido" }, { status: 400 });
  }

  const lead = await getCrmLeadById(parsed.data.leadId, {
    agentId: session.user.id,
    includeAll: canViewAllCrmContacts(session.user.role),
  });
  if (!lead) {
    return NextResponse.json({ error: "No podés acceder a este contacto" }, { status: 403 });
  }

  const preferences = await setCrmFeaturedLead(
    session.user.id,
    parsed.data.leadId,
    parsed.data.featured
  );
  return NextResponse.json({ preferences });
}
