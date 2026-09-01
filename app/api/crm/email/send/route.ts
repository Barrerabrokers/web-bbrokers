import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { getCrmLeadById } from "@/lib/db";
import { sendCrmEmail } from "@/lib/crm-email-sender";
import { canManageListings, canViewAllCrmContacts } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const columnItemSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string(), html: z.string().optional(), color: z.string().optional(), fontSize: z.number().min(10).max(64).optional(), fontFamily: z.string().optional(), align: z.enum(["left", "center", "right"]).optional(), bold: z.boolean().optional() }),
  z.object({ type: z.literal("image"), url: z.string().url(), alt: z.string().optional(), borderRadius: z.number().min(0).max(40).optional() }),
]);

const contentBlockSchema = z.discriminatedUnion("type", [
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
    url: z.string().url(),
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
    url: z.string().url(),
    name: z.string().trim().min(1),
  }),
  z.object({
    id: z.string().trim().min(1),
    type: z.literal("columns"),
    gap: z.number().min(0).max(48).optional(),
    widths: z.array(z.number().min(1).max(100)).min(1).max(4).optional(),
    columns: z.array(columnItemSchema).min(1).max(4),
  }),
]);

const sendEmailSchema = z.object({
  leadId: z.string().uuid(),
  subject: z.string().trim().min(1),
  body: z.string().trim().min(1),
  imageUrls: z.array(z.string().url()).optional().default([]),
  contentBlocks: z.array(contentBlockSchema).optional().default([]),
});

async function requireApprovedAgent() {
  const session = await getServerSession(authOptions);
  if (!session || !canManageListings(session.user.role)) return null;
  return session;
}

function getPublicBaseUrl(request: NextRequest) {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  if (configuredUrl) return configuredUrl.replace(/\/$/, "");

  const proto = request.headers.get("x-forwarded-proto") || "http";
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  return host ? `${proto}://${host}` : "";
}

export async function POST(request: NextRequest) {
  const session = await requireApprovedAgent();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = sendEmailSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Completá asunto y mensaje para enviar el correo." },
      { status: 400 }
    );
  }

  const lead = await getCrmLeadById(parsed.data.leadId, {
    agentId: session.user.id,
    includeAll: canViewAllCrmContacts(session.user.role),
  });

  if (!lead) {
    return NextResponse.json({ error: "No podés enviar correo a este contacto." }, { status: 403 });
  }

  const result = await sendCrmEmail({
    lead,
    agentId: session.user.id,
    subject: parsed.data.subject,
    body: parsed.data.body,
    imageUrls: parsed.data.imageUrls,
    contentBlocks: parsed.data.contentBlocks,
    baseUrl: getPublicBaseUrl(request),
  });

  if (!result.sent) {
    return NextResponse.json({ error: result.error || "No se pudo enviar el correo." }, { status: 500 });
  }

  return NextResponse.json({
    sent: true,
    activity: result.activity,
    activityError: result.activity ? undefined : result.error,
  });
}
