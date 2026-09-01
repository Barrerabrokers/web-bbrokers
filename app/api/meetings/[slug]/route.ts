import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCrmEmailAccountWithSecret } from "@/lib/db";
import { getAccessTokenForGoogleAccount } from "@/lib/google-oauth";
import { createMeetingBooking, getBookedRanges, getMeetingLinkBySlug } from "@/lib/meeting-scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bookingSchema = z.object({
  name: z.string().trim().min(2).max(120), email: z.string().trim().email(),
  phone: z.string().trim().max(50).optional().default(""), notes: z.string().trim().max(1000).optional().default(""),
  startsAt: z.string().datetime(), duration: z.number().int().min(10).max(180),
  meetingMode: z.enum(["in_person", "google_meet"]),
});

function origin(request: NextRequest) { return process.env.NEXTAUTH_URL || new URL(request.url).origin; }

export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  const link = await getMeetingLinkBySlug(params.slug);
  if (!link) return NextResponse.json({ error: "Enlace no disponible" }, { status: 404 });
  const fromValue = request.nextUrl.searchParams.get("from");
  const toValue = request.nextUrl.searchParams.get("to");
  const from = fromValue ? new Date(fromValue) : new Date();
  const to = toValue ? new Date(toValue) : new Date(Date.now() + 31 * 86400000);
  const bookings = await getBookedRanges(link.agentId, from, to);
  const busy = bookings.map((x: any) => ({ start: x.starts_at, end: x.ends_at }));
  const account = await getCrmEmailAccountWithSecret(link.agentId);
  if (account?.provider === "google-oauth") {
    try {
      const token = await getAccessTokenForGoogleAccount({ origin: origin(request), account });
      const response = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ timeMin: from.toISOString(), timeMax: to.toISOString(), timeZone: "America/Argentina/Buenos_Aires", items: [{ id: "primary" }] }),
        cache: "no-store",
      });
      const data = await response.json().catch(() => null);
      if (response.ok) busy.push(...(data?.calendars?.primary?.busy || []));
    } catch (error) {
      console.error("Google Calendar availability error:", error);
    }
  }
  return NextResponse.json({ meetingLink: { ...link, agentEmail: undefined }, busy });
}

export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  const parsed = bookingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Completá nombre, email y horario." }, { status: 400 });
  const link = await getMeetingLinkBySlug(params.slug);
  if (!link) return NextResponse.json({ error: "Enlace no disponible" }, { status: 404 });
  if (!link.durations.includes(parsed.data.duration)) return NextResponse.json({ error: "Duración no permitida." }, { status: 400 });
  if (!link.meetingModes.includes(parsed.data.meetingMode)) return NextResponse.json({ error: "Modalidad no disponible." }, { status: 400 });
  const start = new Date(parsed.data.startsAt);
  const end = new Date(start.getTime() + parsed.data.duration * 60000);
  if (start.getTime() < Date.now() + 5 * 60000) return NextResponse.json({ error: "Elegí un horario futuro." }, { status: 400 });
  const arParts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Argentina/Buenos_Aires", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(start);
  const weekday = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(arParts.find(p=>p.type==="weekday")?.value || "");
  const time = `${arParts.find(p=>p.type==="hour")?.value}:${arParts.find(p=>p.type==="minute")?.value}`;
  if (!link.weekdays.includes(weekday) || time < link.startTime || time >= link.endTime) return NextResponse.json({ error: "El horario no está dentro de la disponibilidad." }, { status: 400 });
  const existing = await getBookedRanges(link.agentId, start, end);
  if (existing.length) return NextResponse.json({ error: "Ese horario acaba de ser reservado. Elegí otro." }, { status: 409 });
  const account = await getCrmEmailAccountWithSecret(link.agentId);
  if (!account || account.provider !== "google-oauth") return NextResponse.json({ error: "El asesor todavía no conectó Google Calendar." }, { status: 409 });
  try {
    const token = await getAccessTokenForGoogleAccount({ origin: origin(request), account });
    const freeBusyResponse = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ timeMin: start.toISOString(), timeMax: end.toISOString(), timeZone: "America/Argentina/Buenos_Aires", items: [{ id: "primary" }] }),
    });
    const freeBusy = await freeBusyResponse.json().catch(() => null);
    if (!freeBusyResponse.ok) throw new Error(freeBusy?.error?.message || "No se pudo consultar Google Calendar.");
    if (freeBusy?.calendars?.primary?.busy?.length) {
      return NextResponse.json({ error: "Ese horario ya está ocupado en el calendario. Elegí otro." }, { status: 409 });
    }
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all${parsed.data.meetingMode === "google_meet" ? "&conferenceDataVersion=1" : ""}`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: `${link.title} con ${parsed.data.name}`,
        location: parsed.data.meetingMode === "in_person" ? link.location : undefined,
        conferenceData: parsed.data.meetingMode === "google_meet" ? { createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } } } : undefined,
        description: [`Reserva desde Barrera Brokers`, `Cliente: ${parsed.data.name}`, `Email: ${parsed.data.email}`, parsed.data.phone && `Teléfono: ${parsed.data.phone}`, parsed.data.notes && `Mensaje: ${parsed.data.notes}`].filter(Boolean).join("\n"),
        start: { dateTime: start.toISOString(), timeZone: "America/Argentina/Buenos_Aires" },
        end: { dateTime: end.toISOString(), timeZone: "America/Argentina/Buenos_Aires" },
        attendees: [{ email: parsed.data.email, displayName: parsed.data.name }],
      }),
    });
    const event = await response.json().catch(() => null);
    if (!response.ok || !event?.id) throw new Error(event?.error?.message || "Google Calendar no pudo crear la reunión.");
    await createMeetingBooking({ link, name: parsed.data.name, email: parsed.data.email, phone: parsed.data.phone, notes: parsed.data.notes, startsAt: start, endsAt: end, googleEventId: event.id, googleEventUrl: event.htmlLink || "" });
    return NextResponse.json({ ok: true, eventUrl: event.htmlLink || "" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo reservar la reunión." }, { status: 500 });
  }
}
