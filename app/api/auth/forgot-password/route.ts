import { randomBytes, createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAgentPasswordResetToken, getAgentByEmail } from "@/lib/db";
import { sendAgentPasswordResetEmail } from "@/lib/contact-notifications";

const forgotPasswordSchema = z.object({
  email: z.string().email("Email inválido"),
});

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getRequestOrigin(request: NextRequest) {
  if (request.nextUrl.origin) return request.nextUrl.origin;

  const configuredUrl =
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL;

  if (configuredUrl) {
    return configuredUrl.startsWith("http") ? configuredUrl : `https://${configuredUrl}`;
  }

  return "https://barrerabrokers.com";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = forgotPasswordSchema.parse(body);
    const agent = await getAgentByEmail(email);

    if (agent) {
      const token = randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const tokenResult = await createAgentPasswordResetToken({
        agentId: agent.id,
        tokenHash: hashToken(token),
        expiresAt,
      });

      if (!tokenResult.success) {
        return NextResponse.json(
          { error: tokenResult.error || "No se pudo generar el enlace" },
          { status: 500 }
        );
      }

      const resetUrl = `${getRequestOrigin(request)}/reset-password?token=${encodeURIComponent(token)}`;
      await sendAgentPasswordResetEmail({
        agentName: agent.name,
        agentEmail: agent.email,
        resetUrl,
        requestedBy: "Solicitud desde login",
      });
    }

    return NextResponse.json({
      success: true,
      message: "Si el email pertenece a un agente, recibirá un enlace para cambiar la contraseña.",
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Ingresá un email válido.", details: error.errors },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : "No se pudo enviar el email";
    console.error("Forgot password error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
