import { NextRequest, NextResponse } from "next/server";
import { processCrmEmailNotifications } from "@/lib/crm-email-notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  try {
    return NextResponse.json(await processCrmEmailNotifications());
  } catch {
    console.error("No se pudo procesar el envío de notificaciones de correo del CRM.");
    return NextResponse.json({ error: "No se pudieron procesar las notificaciones." }, { status: 500 });
  }
}
