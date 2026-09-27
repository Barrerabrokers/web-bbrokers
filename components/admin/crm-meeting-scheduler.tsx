"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, CheckCircle2, Loader2, MapPin, Video, X } from "lucide-react";
import { CrmActivityEditor } from "@/components/admin/crm-activity-editor";
import { MeetingClientInvitation } from "@/components/admin/meeting-client-invitation";
import type { CrmActivity } from "@/lib/db";
import type { MeetingLink } from "@/lib/meeting-scheduler";
import { argentinaLocalDateTimeToIso } from "@/lib/argentina-time";

type MeetingLead = { id: string; firstName: string; lastName: string; email: string; countryCode: string; phone: string; developmentName?: string; developmentNameText?: string };
type MeetingHistoryItem = CrmActivity;
type BusyRange = { start: string; end: string };
const pad = (value: number) => String(value).padStart(2, "0");
const dateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const addMinutes = (time: string, minutes: number) => { const [hour, minute] = time.split(":").map(Number); const total = hour * 60 + minute + minutes; return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`; };

export function CrmMeetingScheduler({ lead, link: savedLink, meetings = [] }: { lead: MeetingLead; link: MeetingLink | null; meetings?: MeetingHistoryItem[] }) {
  const router = useRouter();
  const link = useMemo(() => savedLink || { durations: [30, 60], meetingModes: ["google_meet", "in_person"] as ("google_meet" | "in_person")[], weekdays: [0, 1, 2, 3, 4, 5, 6], startTime: "09:00", endTime: "19:00", slotInterval: 15, location: "A definir" }, [savedLink]);
  const [includePablo, setIncludePablo] = useState(false);
  const [includeLucas, setIncludeLucas] = useState(false);
  const [sendClientInvitation, setSendClientInvitation] = useState<boolean>();
  const [organizer, setOrganizer] = useState("");
  const [calendarReady, setCalendarReady] = useState(false);
  const [needsConnection, setNeedsConnection] = useState(false);
  const [open, setOpen] = useState(false);
  const [moveToMeeting, setMoveToMeeting] = useState(false);
  const [busy, setBusy] = useState<BusyRange[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(60);
  const [mode, setMode] = useState<"in_person" | "google_meet">(link?.meetingModes[0] || "google_meet");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const days = useMemo(() => {
    if (!link) return [];
    return Array.from({ length: 45 }, (_, index) => { const value = new Date(); value.setHours(0, 0, 0, 0); value.setDate(value.getDate() + index); return value; })
      .filter((value) => link.weekdays.includes(value.getDay())).slice(0, 16);
  }, [link]);
  const slots = useMemo(() => {
    if (!link || !date) return [];
    const values: string[] = [];
    for (let value = link.startTime; addMinutes(value, duration) <= link.endTime; value = addMinutes(value, link.slotInterval)) {
      const start = new Date(argentinaLocalDateTimeToIso(date, value));
      const end = new Date(start.getTime() + duration * 60_000);
      if (start.getTime() > Date.now() + 5 * 60_000 && !busy.some((range) => start < new Date(range.end) && end > new Date(range.start))) values.push(value);
    }
    return values;
  }, [busy, date, duration, link]);

  const show = async () => { setDuration(60);
    setSendClientInvitation(undefined);
    setOpen(true); setLoading(true); setError(""); setNotice(""); setCalendarReady(false); setNeedsConnection(false); setTime("");
    if (!link) { setLoading(false); return; }
    try {
      const response = await fetch("/api/crm/calendar/events", { cache: "no-store" });
      const data = await response.json().catch(() => null) as { busy?: BusyRange[]; error?: string; connected?: boolean; organizer?: string } | null;
      if (data?.connected === false) setNeedsConnection(true);
      if (!response.ok) throw new Error(data?.error || "No se pudo consultar el calendario.");
      setBusy(data?.busy || []); setOrganizer(data?.organizer || "tu cuenta"); setCalendarReady(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo consultar el calendario."); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    const openScheduler = (event: Event) => {setMoveToMeeting(Boolean((event as CustomEvent).detail?.moveToMeeting));void show();};
    window.addEventListener("crm:open-meeting-scheduler", openScheduler);
    return () => window.removeEventListener("crm:open-meeting-scheduler", openScheduler);
  });
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("scheduleMeeting") === "1") {
      setMoveToMeeting(true); void show();
      const url=new URL(window.location.href);url.searchParams.delete("scheduleMeeting");window.history.replaceState(null,"",url);
    }
    // Open once when arriving from a status selector.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirm = async () => {
    if (!calendarReady || !date || !time || saving || notice) return;
    if (sendClientInvitation === undefined) { setError("Elegí si querés enviar la invitación al cliente o no enviarla."); return; }
    setSaving(true); setError(""); setNotice("");
    const startsAt = argentinaLocalDateTimeToIso(date, time);
    const name = `${lead.firstName} ${lead.lastName}`.trim();
    try {
      const response = await fetch("/api/crm/calendar/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadId: lead.id, type: "reunion", title: `Reunión con ${name}`, body: [notes, lead.developmentName || lead.developmentNameText ? `Desarrollo: ${lead.developmentName || lead.developmentNameText}` : ""].filter(Boolean).join("\n"), scheduledAt: startsAt, duration, meetingMode: mode, location: link.location, includePablo, includeLucas, sendClientInvitation, moveToMeeting }) });
      const data = await response.json().catch(() => null) as { error?: string; warning?: string } | null;
      if (!response.ok) throw new Error(data?.error || "No se pudo agendar la reunión.");
      setNotice(data?.warning || `Reunión creada en tu Google Calendar.${sendClientInvitation ? " Se solicitó a Google el envío de la invitación al cliente." : " No se envió invitación al cliente."}${includePablo ? " Pablo Barrera está incluido en la reunión." : ""}`);
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo agendar la reunión."); }
    finally { setSaving(false); }
  };

  return <>
    <section id="reuniones-crm" className="rounded-xl bg-white p-5 ring-1 ring-ink/10"><div className="flex items-center justify-between gap-3 border-b border-ink/10 pb-4"><span className="flex items-center gap-3 text-[#006b6b]"><CalendarDays className="h-5 w-5" /><h2 className="text-base font-semibold text-ink">Reuniones programadas</h2></span><span className="text-xs font-medium text-ink/50">{meetings.length}</span></div>{meetings.length ? <ol className="divide-y divide-ink/8">{meetings.map((meeting) => { const dateValue = meeting.scheduledAt || meeting.createdAt; return <li key={meeting.id} className="py-3"><p className="line-clamp-2 text-sm font-semibold leading-snug text-ink">{meeting.title}</p><time className="mt-1.5 block text-xs font-semibold text-[#006b6b]">{new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(dateValue))}</time>{meeting.body && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink/60">{meeting.body}</p>}<CrmActivityEditor activity={meeting} /></li>; })}</ol> : <p className="mt-4 text-sm leading-relaxed text-ink/60">No hay reuniones programadas con este contacto.</p>}<button type="button" onClick={() => {setMoveToMeeting(false);void show();}} className="mt-4 inline-flex min-h-10 items-center justify-center rounded-lg border border-[#006b6b] px-4 text-sm font-medium text-[#006b6b] hover:bg-[#e7f4f2]">Agendar reunión</button></section>
    {open && <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (!saving && event.target === event.currentTarget) setOpen(false); }}><section role="dialog" aria-modal="true" aria-labelledby="meeting-dialog-title" className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-xl bg-white sm:rounded-xl">
      <header className="flex items-start justify-between border-b border-ink/10 px-5 py-4 sm:px-6"><div><h2 id="meeting-dialog-title" className="text-lg font-semibold text-ink">Agendar reunión con {lead.firstName}</h2><p className="mt-1 text-sm text-ink/60">Calendario de {organizer || "tu cuenta de Google"}</p></div><button type="button" disabled={saving} onClick={() => setOpen(false)} aria-label="Cerrar" className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-[#e7f4f2]"><X className="h-5 w-5" /></button></header>
      <div className="p-5 sm:p-6">{moveToMeeting && <p className="mb-4 rounded-lg bg-[#e7f4f2] p-3 text-sm text-[#006b6b]">El estado cambiará a Reunión únicamente después de confirmar día y horario. Si cerrás este panel, se conserva el estado anterior.</p>}{loading ? <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-ink/60"><Loader2 className="h-5 w-5 animate-spin" />Consultando Google Calendar…</div> : <div className="space-y-6">
        <div><h3 className="text-sm font-semibold text-ink">1. Elegí el día</h3><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{days.map((day) => { const key = dateKey(day); const selected = date === key; return <button key={key} type="button" onClick={() => { setDate(key); setTime(""); }} className={`rounded-lg px-3 py-3 text-left ring-1 transition-colors ${selected ? "bg-[#006b6b] text-white ring-[#006b6b]" : "bg-white text-ink ring-ink/15 hover:bg-[#e7f4f2]"}`}><span className="block text-xs opacity-70">{new Intl.DateTimeFormat("es-AR", { weekday: "short" }).format(day)}</span><span className="mt-1 block text-sm font-semibold">{new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" }).format(day)}</span></button>; })}</div></div>
        <div><h3 className="text-sm font-semibold text-ink">2. Duración y modalidad</h3><div className="mt-3 flex flex-wrap gap-2">{[30, 60].map((value) => <button key={value} type="button" onClick={() => { setDuration(value); setTime(""); }} className={`min-h-10 rounded-lg px-4 text-sm font-medium ring-1 ${duration === value ? "bg-[#006b6b] text-white ring-[#006b6b]" : "ring-ink/15"}`}>{value === 60 ? "1 hora" : `${value} min`}</button>)}{link.meetingModes.map((value) => <button key={value} type="button" onClick={() => setMode(value)} className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium ring-1 ${mode === value ? "bg-[#e7f4f2] text-[#006b6b] ring-[#006b6b]" : "ring-ink/15"}`}>{value === "google_meet" ? <Video className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}{value === "google_meet" ? "Google Meet" : "Presencial"}</button>)}</div></div>
        <div><h3 className="text-sm font-semibold text-ink">3. Horario disponible</h3>{date ? <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">{slots.map((value) => <button key={value} type="button" onClick={() => setTime(value)} className={`min-h-11 rounded-lg text-sm font-semibold ring-1 ${time === value ? "bg-[#006b6b] text-white ring-[#006b6b]" : "ring-ink/15 hover:bg-[#e7f4f2]"}`}>{value}</button>)}{slots.length === 0 && <p className="col-span-full rounded-lg bg-[#f3f4f4] px-4 py-6 text-center text-sm text-ink/60">No quedan horarios libres ese día.</p>}</div> : <p className="mt-2 text-sm text-ink/55">Primero elegí un día.</p>}</div>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-[#f2f8f7] p-4 text-sm text-ink"><input type="checkbox" checked={includePablo} onChange={(event) => setIncludePablo(event.target.checked)} disabled={saving || Boolean(notice)} className="mt-0.5 h-4 w-4 accent-[#006b6b]" /><span><span className="block font-semibold">Invitar a Pablo Barrera</span><span className="mt-1 block">Recibirá la invitación en pablo@barrerabrokers.com.</span></span></label>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-[#f2f8f7] p-4 text-sm text-ink"><input type="checkbox" checked={includeLucas} onChange={(event) => setIncludeLucas(event.target.checked)} disabled={saving || Boolean(notice)} className="mt-0.5 h-4 w-4 accent-[#006b6b]" /><span><span className="block font-semibold">Invitar a Lucas Barrera</span><span className="mt-1 block">Recibirá la invitación en lucas@barrerabrokers.com.</span></span></label>
        <MeetingClientInvitation value={sendClientInvitation} onChange={event => setSendClientInvitation(event.target.value === "yes")} email={lead.email} disabled={saving || Boolean(notice)} />
        <label className="block text-sm font-semibold text-ink">Notas internas (opcional, no se envían al cliente)<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="mt-2 w-full rounded-lg border border-ink/15 px-3 py-2 font-normal outline-none focus:border-[#006b6b]" /></label>
        {error && <div role="alert" className="space-y-2 text-sm font-medium text-red-700"><p>{error}</p>{needsConnection ? <a href="/api/crm/google/connect" className="inline-flex min-h-11 items-center underline">Conectar Google Calendar</a> : <button type="button" onClick={() => void show()} className="min-h-11 underline">Volver a consultar calendario</button>}</div>}{notice && <p className="flex items-center gap-2 text-sm font-medium text-[#006b6b]"><CheckCircle2 className="h-4 w-4" />{notice}</p>}
        <div className="flex justify-end gap-2"><button type="button" disabled={saving} onClick={() => setOpen(false)} className="min-h-11 rounded-lg border border-ink/15 px-5 text-sm font-medium">Cerrar</button><button type="button" onClick={() => void confirm()} disabled={!calendarReady || !date || !time || saving || Boolean(notice)} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#006b6b] px-5 text-sm font-semibold text-white hover:bg-[#004949] disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{saving ? "Agendando…" : "Confirmar reunión"}</button></div>
      </div>}</div>
    </section></div>}
  </>;
}
