import { NextRequest, NextResponse } from "next/server";
import { hasGoogleCalendarAccess } from "@/lib/google-calendar-connection";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import {
  createCrmActivity,
  getAgentByEmail,
  getCrmEmailAccountWithSecret,
  getCrmLeads,
  type CrmActivityType,
} from "@/lib/db";
import { getAccessTokenForGoogleAccount } from "@/lib/google-oauth";
import { getCrmCalendarBusy } from "@/lib/crm-calendar-availability";
import { canManageListings, canViewAllCrmContacts } from "@/lib/roles";
import { POST as createActivity } from "@/app/api/crm/activities/route";
import { registerScheduledMeeting } from "@/lib/crm-meeting-lifecycle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const eventSchema = z.object({
  leadId: z.string().uuid(),
  type: z.enum(["reunion", "tarea", "nota"]),
  title: z.string().trim().min(1),
  body: z.string().trim().optional().default(""),
  scheduledAt: z.string().datetime(),
  duration: z.number().int().min(10).max(180).optional(),
  meetingMode: z.enum(["in_person", "google_meet"]).optional(),
  location: z.string().trim().max(160).optional(),
  includePablo: z.boolean().default(false),
  includeLucas: z.boolean().default(false),
  sendClientInvitation: z.boolean().optional(),
  moveToMeeting: z.boolean().default(false),
});

function requestOrigin(request: NextRequest) {
  return process.env.NEXTAUTH_URL || new URL(request.url).origin;
}

function leadName(lead?: { firstName?: string; lastName?: string; email?: string }) {
  const name = [lead?.firstName, lead?.lastName].filter(Boolean).join(" ").trim();
  return name || lead?.email || "Contacto";
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageListings(session.user.role)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const account = await getCrmEmailAccountWithSecret(session.user.id);
  if (!account || !hasGoogleCalendarAccess(account)) return NextResponse.json({ error: "Conectá Google Calendar para agendar reuniones.", connected: false }, { status: 409 });
  try {
    const token = await getAccessTokenForGoogleAccount({ origin: requestOrigin(request), account });
    const busy = await getCrmCalendarBusy(token, new Date(), new Date(Date.now() + 46 * 86_400_000));
    return NextResponse.json({ busy, connected: true, organizer: session.user.name || session.user.email }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo consultar tu calendario." }, { status: 424 });
  }
}

export async function POST(request: NextRequest) {
  const taskRequest = request.clone();
  const taskBody = await taskRequest.json().catch(() => null);
  if (taskBody?.type === "tarea") return createActivity(request);
  const session = await getServerSession(authOptions);
  if (!session || !canManageListings(session.user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Revisá contacto, título, fecha y hora." }, { status: 400 });
  }
  if (parsed.data.type === "reunion" && parsed.data.duration !== undefined && ![30, 60].includes(parsed.data.duration)) return NextResponse.json({ error: "Las reuniones deben durar 30 minutos o 1 hora." }, { status: 400 });
  if (parsed.data.type === "reunion" && parsed.data.sendClientInvitation === undefined) {
    return NextResponse.json({ error: "Elegí si querés enviar la invitación al cliente o no enviarla." }, { status: 400 });
  }

  const includeAll = canViewAllCrmContacts(session.user.role);
  const [account, leads] = await Promise.all([
    getCrmEmailAccountWithSecret(session.user.id),
    getCrmLeads({ agentId: session.user.id, includeAll }),
  ]);
  const lead = leads.find((item) => item.id === parsed.data.leadId);

  if (!lead) {
    return NextResponse.json({ error: "No se encontró el contacto para este agente." }, { status: 404 });
  }
  if (parsed.data.type === "reunion" && parsed.data.sendClientInvitation && !lead.email?.trim()) {
    return NextResponse.json({ error: "El contacto no tiene correo. Elegí no enviar la invitación o agregá su email." }, { status: 400 });
  }

  if (!account || !hasGoogleCalendarAccess(account)) {
    return NextResponse.json(
      { error: "Conectá Google desde Correo de CRM para agendar en Calendar." },
      { status: 400 }
    );
  }

  try {
    const accessToken = await getAccessTokenForGoogleAccount({
      origin: requestOrigin(request),
      account,
    });
    const start = new Date(parsed.data.scheduledAt);
    if (Number.isNaN(start.getTime())) {
      return NextResponse.json({ error: "Revisá la fecha y hora del evento." }, { status: 400 });
    }
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + (parsed.data.duration || (parsed.data.type === "tarea" ? 30 : 60)));
    if (parsed.data.type === "reunion") {
      if (start.getTime() < Date.now() + 5 * 60_000) return NextResponse.json({ error: "Elegí un horario futuro." }, { status: 400 });
      const busy = await getCrmCalendarBusy(accessToken, start, end);
      if (busy.some((range) => start < new Date(range.end) && end > new Date(range.start))) return NextResponse.json({ error: "Ese horario ya está ocupado en tu calendario. Elegí otro." }, { status: 409 });
    }
    const inviteClient = parsed.data.type === "reunion" && parsed.data.sendClientInvitation === true;
    const attendees: { email: string; displayName?: string }[] = inviteClient ? [{ email: lead.email.trim() }] : [];
    if (parsed.data.includePablo && parsed.data.type === "reunion") {
      const pablo = await getAgentByEmail("pablo@barrerabrokers.com");
      if (!pablo?.active) return NextResponse.json({ error: "No se encontró la cuenta activa de Pablo Barrera." }, { status: 409 });
      if (!inviteClient && pablo.email.toLowerCase() === lead.email?.trim().toLowerCase()) return NextResponse.json({ error: "El cliente es Pablo. Para invitarlo, elegí enviar al cliente; de lo contrario, desmarcá Invitar a Pablo." }, { status: 400 });
      if (pablo.id !== session.user.id && !attendees.some((guest) => guest.email.toLowerCase() === pablo.email.toLowerCase())) attendees.push({ email: pablo.email, displayName: pablo.name });
    }
    if (parsed.data.includeLucas && parsed.data.type === "reunion") {
      const lucas = await getAgentByEmail("lucas@barrerabrokers.com");
      if (!lucas?.active) return NextResponse.json({ error: "No se encontró la cuenta activa de Lucas Barrera." }, { status: 409 });
      if (!inviteClient && lucas.email.toLowerCase() === lead.email?.trim().toLowerCase()) return NextResponse.json({ error: "El cliente es Lucas. Para invitarlo, elegí enviar al cliente; de lo contrario, desmarcá Invitar a Lucas." }, { status: 400 });
      if (lucas.id !== session.user.id && !attendees.some((guest) => guest.email.toLowerCase() === lucas.email.toLowerCase())) attendees.push({ email: lucas.email, displayName: lucas.name });
    }
    const phone = [lead.countryCode, lead.phone].filter(Boolean).join(" ");
    const internalDescription = [
      parsed.data.body,
      `Contacto: ${leadName(lead)}`,
      lead.email ? `Email: ${lead.email}` : "",
      phone ? `Telefono: ${phone}` : "",
      "Creado desde CRM Barrera Brokers.",
    ]
      .filter(Boolean)
      .join("\n");

    const googleResponse = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=${attendees.length ? "all" : "none"}${parsed.data.meetingMode === "google_meet" ? "&conferenceDataVersion=1" : ""}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: parsed.data.title,
        // This description is visible to guests. Never copy CRM body/notes here.
        description: "Reunión con Barrera Brokers.",
        start: {
          dateTime: start.toISOString(),
          timeZone: "America/Argentina/Buenos_Aires",
        },
        end: {
          dateTime: end.toISOString(),
          timeZone: "America/Argentina/Buenos_Aires",
        },
        attendees,
        location: parsed.data.meetingMode === "in_person" ? parsed.data.location : undefined,
        conferenceData: parsed.data.meetingMode === "google_meet" ? { createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } } } : undefined,
      }),
    });
    const googleEvent = (await googleResponse.json().catch(() => null)) as {
      id?: string;
      htmlLink?: string;
      error?: { message?: string };
    } | null;

    if (!googleResponse.ok || !googleEvent?.id) {
      throw new Error(googleEvent?.error?.message || "Google Calendar no pudo crear el evento.");
    }

    const { activity, error: activityError } = await createCrmActivity({
      leadId: parsed.data.leadId,
      type: parsed.data.type as CrmActivityType,
      title: parsed.data.title,
      body: [internalDescription, parsed.data.type === "reunion" ? (inviteClient ? "Invitación al cliente: solicitada a Google Calendar." : "Invitación al cliente: no enviar.") : "", parsed.data.includePablo ? "Participante: Pablo Barrera" : "", parsed.data.includeLucas ? "Participante: Lucas Barrera" : "", googleEvent.htmlLink || ""].filter(Boolean).join("\n"),
      scheduledAt: parsed.data.scheduledAt,
      createdBy: session.user.id,
      externalSource: "google_calendar",
      externalId: googleEvent.id,
    });

    if (!activity) {
      return NextResponse.json({ ok: true, warning: activityError || "La reunión se creó en Google Calendar, pero no se pudo guardar en las actividades del CRM. No vuelvas a crearla.", event: { id: googleEvent.id, url: googleEvent.htmlLink } });
    }

    if (activity.type === "reunion") {
      try { await registerScheduledMeeting(activity.id, end.toISOString(), session.user.id, parsed.data.moveToMeeting); }
      catch { return NextResponse.json({ok:true,warning:"La cita está creada. No vuelvas a agendarla: no se pudo completar el cambio de estado; actualizá el contacto y revisá los resultados pendientes.",activity,event:{id:googleEvent.id,url:googleEvent.htmlLink}}); }
    }

    return NextResponse.json({
      ok: true,
      activity,
      event: {
        id: googleEvent.id,
        url: googleEvent.htmlLink,
      },
    });
  } catch (error) {
    console.error("Google Calendar event error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear el evento en Google Calendar." },
      { status: 500 }
    );
  }
}
