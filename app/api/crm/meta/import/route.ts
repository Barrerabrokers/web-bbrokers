import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { importMetaLeadgenId } from "@/lib/meta-leads";
import { canManageAdminPanel } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const importSchema = z.object({
  leadgenId: z.string().trim().min(1),
});

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageAdminPanel(session.user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ingresá un leadgen_id válido de Meta" },
      { status: 400 }
    );
  }

  try {
    const result = await importMetaLeadgenId(parsed.data.leadgenId, {
      createdBy: session.user.id,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error importing Meta lead manually:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo importar desde Meta" },
      { status: 500 }
    );
  }
}
