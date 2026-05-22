import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { createAgent, getAgentByEmail } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const registerSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  phone: z.string().optional(),
  role: z.enum(["agent", "admin"]).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = registerSchema.parse(body);

    // Verificar si quiere crear admin - solo otro admin puede hacerlo
    if (validatedData.role === "admin") {
      const session = await getServerSession(authOptions);
      if (!session || session.user.role !== "admin") {
        return NextResponse.json(
          { error: "Solo administradores pueden crear administradores" },
          { status: 403 }
        );
      }
    }

    // Verificar si el email ya existe
    const existing = await getAgentByEmail(validatedData.email);
    if (existing) {
      return NextResponse.json(
        { error: "Este email ya está registrado" },
        { status: 400 }
      );
    }

    // Hashear password
    const hashedPassword = await hash(validatedData.password, 10);

    // Crear agente
    const agent = await createAgent({
      name: validatedData.name,
      email: validatedData.email,
      password: hashedPassword,
      phone: validatedData.phone,
      role: validatedData.role || "agent",
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Error al crear el usuario" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: "Usuario creado exitosamente",
        user: {
          id: agent.id,
          name: agent.name,
          email: agent.email,
          role: agent.role,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Datos inválidos", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Error al registrar el usuario" },
      { status: 500 }
    );
  }
}
