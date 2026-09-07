import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { getCrmNotifications, markCrmNotificationRead } from "@/lib/db";
import { canManageListings, canViewAllCrmContacts } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const readSchema = z.object({ notificationId: z.string().uuid() });

async function requireAgent() {
  const session = await getServerSession(authOptions);
  if (!session || !canManageListings(session.user.role)) return null;
  return session;
}

export async function GET() {
  const session = await requireAgent();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const notifications = await getCrmNotifications({
    agentId: session.user.id,
    includeAll: canViewAllCrmContacts(session.user.role),
  });
  return NextResponse.json({ notifications }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: NextRequest) {
  const session = await requireAgent();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = readSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Notificación inválida" }, { status: 400 });
  const success = await markCrmNotificationRead({
    notificationId: parsed.data.notificationId,
    agentId: session.user.id,
    includeAll: canViewAllCrmContacts(session.user.role),
  });
  return NextResponse.json({ success }, { status: success ? 200 : 404 });
}
