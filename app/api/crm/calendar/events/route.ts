import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import {
  createCrmActivity,
  getCrmEmailAccountWithSecret,
  getCrmLeads,
  type CrmActivityType,
} from "@/lib/db";
import { getAccessTokenForGoogleAccount } from "@/lib/google-oauth";
import { canManageListings, canViewAllCrmContacts } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const eventSchema = z.object({
  leadId: z.string().uuid(),
  type: z.enum(["reunion", "tarea", "nota"]),
  title: z.string().trim().min(1),
  body: z.string().trim().optional().default(""),
  scheduledAt: z.string().trim().min(1),
});

function requestOrigin(request: NextRequest) {
  return process.env.NEXTAUTH_URL || new URL(request.url).origin;
}

function leadName(lead?: { firstName?: string; lastName?: string; email?: string }) {
  const name = [lead?.firstName, lead?.lastName].filter(Boolean).join(" ").trim();
  return name || lead?.email || "Contacto";
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageListings(session.user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Revisá contacto, título, fecha y hora." }, { status: 400 });
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

  if (!account || account.provider !== "google-oauth") {
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
    end.setMinutes(end.getMinutes() + (parsed.data.type === "tarea" ? 30 : 60));
    const phone = [lead.countryCode, lead.phone].filter(Boolean).join(" ");
    const description = [
      parsed.data.body,
      `Contacto: ${leadName(lead)}`,
      lead.email ? `Email: ${lead.email}` : "",
      phone ? `Telefono: ${phone}` : "",
      "Creado desde CRM Barrera Brokers.",
    ]
      .filter(Boolean)
      .join("\n");

    const googleResponse = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: parsed.data.title,
        description,
        start: {
          dateTime: start.toISOString(),
          timeZone: "America/Argentina/Buenos_Aires",
        },
        end: {
          dateTime: end.toISOString(),
          timeZone: "America/Argentina/Buenos_Aires",
        },
        attendees: lead.email ? [{ email: lead.email }] : undefined,
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
      body: description,
      scheduledAt: parsed.data.scheduledAt,
      createdBy: session.user.id,
      externalSource: "google_calendar",
      externalId: googleEvent.id,
    });

    if (!activity) {
      throw new Error(activityError || "Google creó el evento, pero no se pudo guardar en el CRM.");
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
