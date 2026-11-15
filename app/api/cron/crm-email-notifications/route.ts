import { processReservationCalendars } from "@/lib/crm-reservation-calendar";
import { NextRequest, NextResponse } from "next/server";
import { processCrmEmailNotifications } from "@/lib/crm-email-notifications";
import { processCrmTaskSchedules } from "@/lib/crm-task-schedule";
import { processMeetingOutcomes } from "@/lib/crm-meeting-lifecycle";
import { processCrmGoogleContacts } from "@/lib/crm-google-contacts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  try {
    const meetings = await processMeetingOutcomes().catch(() => ({error:"No se pudieron verificar las reuniones."}));
    // Each worker uses the same database. Running all three in parallel created
    // connection bursts that could block agents using the CRM, so they run in
    // sequence while preserving their existing retry and advisory-lock logic.
    const reservations = await processReservationCalendars().catch(() => null);
    const tasks = await processCrmTaskSchedules().catch(() => null);
    const emails = await processCrmEmailNotifications().catch(() => null);
    const contacts = await processCrmGoogleContacts().catch(() => null);
    return NextResponse.json({ reservations: reservations || { error: "No se pudieron sincronizar las firmas." }, contacts: contacts || { error: "No se pudieron sincronizar los contactos de Google." }, meetings, tasks: tasks || { error: "No se pudieron procesar las tareas." }, emails: emails || { error: "No se pudieron procesar los correos." } },
      { status: "error" in meetings || !tasks || !emails || !contacts || !reservations ? 500 : 200 });
  } catch {
    console.error("No se pudo procesar el envío de notificaciones de correo del CRM.");
    return NextResponse.json({ error: "No se pudieron procesar las notificaciones." }, { status: 500 });
  }
}
