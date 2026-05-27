import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAllAgents, updateAgent } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "admin") {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const agents = await getAllAgents();

    // No retornar passwords
    const sanitized = agents.map(({ password, ...rest }) => rest);

    return NextResponse.json(sanitized);
  } catch (error) {
    return NextResponse.json(
      { error: "Error al obtener agentes" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    const { agent, error } = await updateAgent(id, data);
    if (!agent) {
      return NextResponse.json({ error: error || "Error al actualizar" }, { status: 500 });
    }

    const { password, ...sanitized } = agent;
    return NextResponse.json(sanitized);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
