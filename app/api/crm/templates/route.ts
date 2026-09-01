import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import {
  deleteCrmEmailTemplate,
  getCrmEmailTemplates,
  upsertCrmEmailTemplate,
} from "@/lib/db";
import { canManageListings } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const columnItemSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string(), html: z.string().optional(), color: z.string().optional(), fontSize: z.number().min(10).max(64).optional(), fontFamily: z.string().optional(), align: z.enum(["left", "center", "right"]).optional(), bold: z.boolean().optional() }),
  z.object({ type: z.literal("image"), url: z.string().trim().min(1), alt: z.string().optional(), borderRadius: z.number().min(0).max(40).optional() }),
]);

const templateSchema = z.object({
  id: z.string().uuid().or(z.literal("")).optional(),
  channel: z.enum(["email", "whatsapp"]).optional().default("email"),
  name: z.string().trim().min(1),
  category: z.string().trim().optional().default("General"),
  subject: z.string().trim().optional().default(""),
  body: z.string().trim().optional().default(""),
  imageUrls: z.array(z.string().trim().min(1)).optional().default([]),
  contentBlocks: z
    .array(
      z.discriminatedUnion("type", [
        z.object({
          id: z.string().trim().min(1),
          type: z.literal("text"),
          text: z.string(),
          html: z.string().optional(),
          color: z.string().optional(),
          fontFamily: z.string().optional(),
          fontSize: z.number().min(10).max(64).optional(),
          align: z.enum(["left", "center", "right"]).optional(),
          backgroundColor: z.string().optional(),
          padding: z.number().min(0).max(80).optional(),
        }),
        z.object({
          id: z.string().trim().min(1),
          type: z.literal("image"),
          url: z.string().trim().min(1),
          width: z.number().min(20).max(100).default(100),
          align: z.enum(["left", "center", "right"]).optional(),
    alt: z.string().optional(),
    borderRadius: z.number().min(0).max(40).optional(),
    caption: z.string().max(240).optional(),
    linkUrl: z.string().optional(),
        }),
        z.object({
          id: z.string().trim().min(1),
          type: z.literal("button"),
          label: z.string().trim().min(1),
          url: z.string().trim().min(1),
          align: z.enum(["left", "center", "right"]).optional(),
          backgroundColor: z.string().optional(),
          textColor: z.string().optional(),
          borderRadius: z.number().min(0).max(40).optional(),
        }),
        z.object({
          id: z.string().trim().min(1),
          type: z.literal("divider"),
          color: z.string().optional(),
          thickness: z.number().min(1).max(12).optional(),
          width: z.number().min(20).max(100).optional(),
        }),
        z.object({
          id: z.string().trim().min(1),
          type: z.literal("spacer"),
          height: z.number().min(8).max(160),
        }),
        z.object({
          id: z.string().trim().min(1),
          type: z.literal("attachment"),
          url: z.string().trim().min(1),
          name: z.string().trim().min(1),
        }),
        z.object({
          id: z.string().trim().min(1),
          type: z.literal("columns"),
          gap: z.number().min(0).max(48).optional(),
          widths: z.array(z.number().min(1).max(100)).min(1).max(4).optional(),
          columns: z.array(columnItemSchema).min(1).max(4),
        }),
      ])
    )
    .optional()
    .default([]),
});

async function requireApprovedAgent() {
  const session = await getServerSession(authOptions);
  if (!session || !canManageListings(session.user.role)) return null;
  return session;
}

export async function GET() {
  const session = await requireApprovedAgent();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const templates = await getCrmEmailTemplates();
  return NextResponse.json({ templates });
}

export async function POST(request: NextRequest) {
  const session = await requireApprovedAgent();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = templateSchema.safeParse(body);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path.join(".");
    return NextResponse.json(
      { error: field ? `Revisá el campo ${field} de la plantilla.` : "Revisá los datos de la plantilla." },
      { status: 400 }
    );
  }

  if (parsed.data.channel === "whatsapp" && !parsed.data.body.trim()) {
    return NextResponse.json(
      { error: "Escribí el contenido del mensaje de WhatsApp." },
      { status: 400 }
    );
  }

  const emailSubject = parsed.data.subject.trim() || parsed.data.name.trim();

  const { template, error } = await upsertCrmEmailTemplate({
    ...parsed.data,
    id: parsed.data.id || undefined,
    subject:
      parsed.data.channel === "whatsapp"
        ? parsed.data.subject || "Mensaje de WhatsApp"
        : emailSubject,
    imageUrls: parsed.data.imageUrls,
    contentBlocks: parsed.data.channel === "whatsapp" ? [] : parsed.data.contentBlocks,
    createdBy: session.user.id,
  });

  if (!template) {
    return NextResponse.json(
      { error: error || "No se pudo guardar la plantilla" },
      { status: 500 }
    );
  }

  return NextResponse.json({ template });
}

export async function DELETE(request: NextRequest) {
  const session = await requireApprovedAgent();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  const { success, error } = await deleteCrmEmailTemplate(id);
  if (!success) {
    return NextResponse.json(
      { error: error || "No se pudo eliminar la plantilla" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
