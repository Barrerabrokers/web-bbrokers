// Reading events works with the calendar.events scope used by the CRM connection.
export async function getCrmCalendarBusy(token: string, from: Date, to: Date) {
  const busy: { start: string; end: string }[] = [];
  let pageToken = "";
  do {
    const query = new URLSearchParams({ timeMin: from.toISOString(), timeMax: to.toISOString(), singleEvents: "true", maxResults: "2500", timeZone: "America/Argentina/Buenos_Aires" });
    if (pageToken) query.set("pageToken", pageToken);
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${query}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error?.message || "No se pudo consultar Google Calendar. Reconectá tu cuenta e intentá nuevamente.");
    for (const event of data?.items || []) {
      if (event.status === "cancelled" || event.transparency === "transparent" || event.attendees?.some((guest: { self?: boolean; responseStatus?: string }) => guest.self && guest.responseStatus === "declined")) continue;
      const start = event.start?.dateTime || (event.start?.date ? `${event.start.date}T00:00:00-03:00` : "");
      const end = event.end?.dateTime || (event.end?.date ? `${event.end.date}T00:00:00-03:00` : "");
      if (start && end) busy.push({ start, end });
    }
    pageToken = data?.nextPageToken || "";
  } while (pageToken);
  return busy;
}
