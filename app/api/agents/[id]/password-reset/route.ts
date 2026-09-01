import { randomBytes, createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canManageAdminPanel } from "@/lib/roles";
import { createAgentPasswordResetToken, getAgentById } from "@/lib/db";
import { sendAgentPasswordResetEmail } from "@/lib/contact-notifications";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getRequestOrigin(request: NextRequest) {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL;

  if (configuredUrl) {
    return configuredUrl.startsWith("http") ? configuredUrl : `https://${configuredUrl}`;
  }

  if (request.nextUrl.origin) {
    return request.nextUrl.origin;
  }

  return "https://barrerabrokers.com";
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !canManageAdminPanel(session.user.role)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const agent = await getAgentById(params.id);
    if (!agent) {
      return NextResponse.json({ error: "Agente no encontrado" }, { status: 404 });
    }

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const result = await createAgentPasswordResetToken({
      agentId: agent.id,
      tokenHash: hashToken(token),
      expiresAt,
      approveOnUse: true,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "No se pudo crear el enlace" },
        { status: 500 }
      );
    }

    const origin = getRequestOrigin(request);
    const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(token)}`;
    await sendAgentPasswordResetEmail({
      agentName: agent.name,
      agentEmail: agent.email,
      resetUrl,
      requestedBy: session.user.email,
    });

    return NextResponse.json({
      success: true,
      message: `Email de recuperación enviado a ${agent.email}`,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al enviar recuperación";
    console.error("Password reset email error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
