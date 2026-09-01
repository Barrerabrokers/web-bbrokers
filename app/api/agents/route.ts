import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { hash } from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { getAllAgents, updateAgent, deleteAgent, updateAgentsOrder } from "@/lib/db";
import { canManageAdminPanel } from "@/lib/roles";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !canManageAdminPanel(session.user.role)) {
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
    if (!session || !canManageAdminPanel(session.user.role)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    if (Array.isArray(body.order)) {
      const order = body.order
        .filter((item: any) => typeof item?.id === "string")
        .map((item: any, index: number) => ({
          id: item.id,
          sortOrder: Number.isFinite(item.sortOrder) ? item.sortOrder : index,
        }));

      const result = await updateAgentsOrder(order);
      if (!result.success) {
        return NextResponse.json(
          { error: result.error || "Error al ordenar agentes" },
          { status: 500 }
        );
      }

      const agents = await getAllAgents();
      const sanitized = agents.map(({ password, ...rest }) => rest);
      return NextResponse.json(sanitized);
    }

    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    if (data.email !== undefined) {
      if (session.user.role !== "admin") {
        delete data.email;
      } else if (typeof data.email !== "string" || !data.email.includes("@")) {
        return NextResponse.json({ error: "Email inválido" }, { status: 400 });
      } else {
        data.email = data.email.trim().toLowerCase();
      }
    }

    if (data.password !== undefined) {
      if (session.user.role !== "admin") {
        delete data.password;
      } else if (typeof data.password !== "string" || data.password.length === 0) {
        delete data.password;
      } else if (data.password.length < 6) {
        return NextResponse.json(
          { error: "La contraseña debe tener al menos 6 caracteres" },
          { status: 400 }
        );
      } else {
        data.password = await hash(data.password, 10);
      }
    }

    if (session.user.role !== "admin") {
      if (data.role !== undefined) delete data.role;
      if (data.active !== undefined) delete data.active;
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

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !canManageAdminPanel(session.user.role)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    // Evitar que el admin se elimine a si mismo
    if (session.user.id === id) {
      return NextResponse.json(
        { error: "No podes eliminar tu propia cuenta" },
        { status: 400 }
      );
    }

    const { success, error } = await deleteAgent(id);
    if (!success) {
      return NextResponse.json(
        { error: error || "Error al eliminar" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
