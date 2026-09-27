import { NextRequest, NextResponse } from "next/server";
import { processCrmEmailNotifications } from "@/lib/crm-email-notifications";
import { processCrmTaskSchedules } from "@/lib/crm-task-schedule";
import { processCrmPush } from "@/lib/crm-push";
import { processMeetingOutcomes } from "@/lib/crm-meeting-lifecycle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  try {
    const meetings = await processMeetingOutcomes().catch(() => ({error:"No se pudieron verificar las reuniones."}));
    const [tasks, emails, push] = await Promise.allSettled([processCrmTaskSchedules(), processCrmEmailNotifications(), processCrmPush()]);
    return NextResponse.json({ meetings, tasks: tasks.status === "fulfilled" ? tasks.value : { error: "No se pudieron procesar las tareas." },
      emails: emails.status === "fulfilled" ? emails.value : { error: "No se pudieron procesar los correos." },
      push: push.status === "fulfilled" ? push.value : { error: "No se pudieron procesar los avisos push." } },
      { status: "error" in meetings || [tasks, emails, push].some(result => result.status === "rejected") ? 500 : 200 });
  } catch {
    console.error("No se pudo procesar el envío de notificaciones de correo del CRM.");
    return NextResponse.json({ error: "No se pudieron procesar las notificaciones." }, { status: 500 });
  }
}
