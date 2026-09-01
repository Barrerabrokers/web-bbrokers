import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { updateAgentPasswordWithResetToken } from "@/lib/db";

const resetPasswordSchema = z.object({
  token: z.string().min(20, "El enlace no es válido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = resetPasswordSchema.parse(body);
    const passwordHash = await hash(validatedData.password, 10);

    const result = await updateAgentPasswordWithResetToken({
      tokenHash: hashToken(validatedData.token),
      passwordHash,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "No se pudo actualizar la contraseña" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Contraseña actualizada correctamente",
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Datos inválidos", details: error.errors },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : "Error al actualizar contraseña";
    console.error("Reset password error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
