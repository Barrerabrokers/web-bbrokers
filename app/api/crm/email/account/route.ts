import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import nodemailer from "nodemailer";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { getCrmEmailAccount, upsertCrmEmailAccount } from "@/lib/db";
import { friendlySmtpError, normalizeSmtpPassword } from "@/lib/crm-email-errors";
import { canManageListings } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const accountSchema = z.object({
  provider: z.string().trim().optional().default("gmail"),
  email: z.string().trim().toLowerCase().email(),
  fromName: z.string().trim().optional().default(""),
  smtpHost: z.string().trim().optional().default(""),
  smtpPort: z.coerce.number().int().positive().optional(),
  smtpSecure: z.boolean().default(false),
  smtpUser: z.string().trim().optional().default(""),
  smtpPassword: z.string().min(1),
  signature: z.string().trim().optional().default(""),
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

  const account = await getCrmEmailAccount(session.user.id);
  return NextResponse.json({ account });
}

export async function POST(request: NextRequest) {
  const session = await requireApprovedAgent();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = accountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Revisá el correo, servidor SMTP, usuario y contraseña de aplicación." },
      { status: 400 }
    );
  }

  const provider = parsed.data.provider === "smtp" ? "smtp" : "gmail";
  const accountConfig = {
    ...parsed.data,
    provider,
    smtpHost: provider === "gmail" ? "smtp.gmail.com" : parsed.data.smtpHost,
    smtpPort: provider === "gmail" ? 587 : parsed.data.smtpPort,
    smtpSecure: provider === "gmail" ? false : parsed.data.smtpSecure,
    smtpUser: provider === "gmail" ? parsed.data.email : parsed.data.smtpUser,
  };

  if (!accountConfig.smtpHost || !accountConfig.smtpPort || !accountConfig.smtpUser) {
    return NextResponse.json(
      { error: "Revisá el correo, servidor SMTP, usuario y contraseña de aplicación." },
      { status: 400 }
    );
  }

  const smtpPort = accountConfig.smtpPort;

  try {
    const transporter = nodemailer.createTransport({
      host: accountConfig.smtpHost,
      port: smtpPort,
      secure: accountConfig.smtpSecure,
      auth: {
        user: accountConfig.smtpUser,
        pass: normalizeSmtpPassword(accountConfig.provider, accountConfig.smtpPassword),
      },
    });
    await transporter.verify();
  } catch (error) {
    return NextResponse.json({ error: friendlySmtpError(error) }, { status: 400 });
  }

  const { account, error } = await upsertCrmEmailAccount({
    ...accountConfig,
    smtpPort,
    smtpPassword: normalizeSmtpPassword(accountConfig.provider, accountConfig.smtpPassword),
    agentId: session.user.id,
  });

  if (!account) {
    return NextResponse.json(
      { error: error || "No se pudo conectar el correo personal." },
      { status: 500 }
    );
  }

  return NextResponse.json({ account });
}
