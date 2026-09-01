"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, CheckCircle2, Loader2, MapPin, Video, X } from "lucide-react";
import type { MeetingLink } from "@/lib/meeting-scheduler";

type MeetingLead = { id: string; firstName: string; lastName: string; email: string; countryCode: string; phone: string; developmentName?: string; developmentNameText?: string };
type MeetingHistoryItem = { id: string; title: string; body: string; scheduledAt?: string; createdAt: string };
type BusyRange = { start: string; end: string };
const pad = (value: number) => String(value).padStart(2, "0");
const dateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const addMinutes = (time: string, minutes: number) => { const [hour, minute] = time.split(":").map(Number); const total = hour * 60 + minute + minutes; return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`; };

export function CrmMeetingScheduler({ lead, link, meetings = [] }: { lead: MeetingLead; link: MeetingLink | null; meetings?: MeetingHistoryItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<BusyRange[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(link?.durations[0] || 30);
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
      const start = new Date(`${date}T${value}:00-03:00`);
      const end = new Date(start.getTime() + duration * 60_000);
      if (start.getTime() > Date.now() + 5 * 60_000 && !busy.some((range) => start < new Date(range.end) && end > new Date(range.start))) values.push(value);
    }
    return values;
  }, [busy, date, duration, link]);

  const show = async () => {
    setOpen(true); setLoading(true); setError(""); setNotice("");
    if (!link) { setLoading(false); return; }
    try {
      const from = new Date().toISOString();
      const to = new Date(Date.now() + 46 * 86_400_000).toISOString();
      const response = await fetch(`/api/meetings/${link.slug}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cache: "no-store" });
      const data = await response.json().catch(() => null) as { busy?: BusyRange[]; error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "No se pudo consultar el calendario.");
      setBusy(data?.busy || []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo consultar el calendario."); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    const openScheduler = () => void show();
    window.addEventListener("crm:open-meeting-scheduler", openScheduler);
    return () => window.removeEventListener("crm:open-meeting-scheduler", openScheduler);
  });

  const confirm = async () => {
    if (!link || !date || !time) return;
    setSaving(true); setError(""); setNotice("");
    const startsAt = new Date(`${date}T${time}:00-03:00`).toISOString();
    const name = `${lead.firstName} ${lead.lastName}`.trim();
    try {
      const response = await fetch(`/api/meetings/${link.slug}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email: lead.email, phone: `${lead.countryCode}${lead.phone}`, notes: [notes, lead.developmentName || lead.developmentNameText ? `Desarrollo: ${lead.developmentName || lead.developmentNameText}` : ""].filter(Boolean).join("\n"), startsAt, duration, meetingMode: mode }) });
      const data = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "No se pudo agendar la reunión.");
      await fetch("/api/crm/activities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadId: lead.id, type: "reunion", title: `Reunión con ${name}`, body: `${mode === "google_meet" ? "Google Meet" : link.location}${notes ? `\n${notes}` : ""}`, scheduledAt: startsAt }) });
      setNotice("Reunión confirmada en Google Calendar. El cliente recibió la invitación.");
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo agendar la reunión."); }
    finally { setSaving(false); }
  };

  return <>
    <section id="reuniones-crm" className="rounded-xl bg-white p-5 ring-1 ring-ink/10"><div className="flex items-center justify-between gap-3 border-b border-ink/10 pb-4"><span className="flex items-center gap-3 text-[#006b6b]"><CalendarDays className="h-5 w-5" /><h2 className="text-base font-semibold text-ink">Reuniones programadas</h2></span><span className="text-xs font-medium text-ink/50">{meetings.length}</span></div>{meetings.length ? <ol className="divide-y divide-ink/8">{meetings.slice(0, 3).map((meeting) => { const dateValue = meeting.scheduledAt || meeting.createdAt; return <li key={meeting.id} className="py-3"><p className="line-clamp-2 text-sm font-semibold leading-snug text-ink">{meeting.title}</p><time className="mt-1.5 block text-xs font-semibold text-[#006b6b]">{new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(dateValue))}</time>{meeting.body && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink/60">{meeting.body}</p>}</li>; })}</ol> : <p className="mt-4 text-sm leading-relaxed text-ink/60">No hay reuniones programadas con este contacto.</p>}<button type="button" onClick={() => void show()} className="mt-4 inline-flex min-h-10 items-center justify-center rounded-lg border border-[#006b6b] px-4 text-sm font-medium text-[#006b6b] hover:bg-[#e7f4f2]">Agendar reunión</button></section>
    {open && <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><section role="dialog" aria-modal="true" aria-labelledby="meeting-dialog-title" className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-xl bg-white sm:rounded-xl">
      <header className="flex items-start justify-between border-b border-ink/10 px-5 py-4 sm:px-6"><div><h2 id="meeting-dialog-title" className="text-lg font-semibold text-ink">Agendar reunión con {lead.firstName}</h2><p className="mt-1 text-sm text-ink/60">Calendario de {link?.agentName || "propietario del contacto"}</p></div><button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-[#e7f4f2]"><X className="h-5 w-5" /></button></header>
      <div className="p-5 sm:p-6">{!link ? <div className="rounded-lg border border-dashed border-ink/20 px-5 py-10 text-center"><CalendarDays className="mx-auto h-8 w-8 text-ink/35" /><p className="mt-3 font-semibold text-ink">El agente todavía no configuró su disponibilidad</p><p className="mt-1 text-sm text-ink/60">Debe configurar su link de reuniones y conectar Google Calendar.</p></div> : loading ? <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-ink/60"><Loader2 className="h-5 w-5 animate-spin" />Consultando Google Calendar…</div> : <div className="space-y-6">
        <div><h3 className="text-sm font-semibold text-ink">1. Elegí el día</h3><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{days.map((day) => { const key = dateKey(day); const selected = date === key; return <button key={key} type="button" onClick={() => { setDate(key); setTime(""); }} className={`rounded-lg px-3 py-3 text-left ring-1 transition-colors ${selected ? "bg-[#006b6b] text-white ring-[#006b6b]" : "bg-white text-ink ring-ink/15 hover:bg-[#e7f4f2]"}`}><span className="block text-xs opacity-70">{new Intl.DateTimeFormat("es-AR", { weekday: "short" }).format(day)}</span><span className="mt-1 block text-sm font-semibold">{new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" }).format(day)}</span></button>; })}</div></div>
        <div><h3 className="text-sm font-semibold text-ink">2. Duración y modalidad</h3><div className="mt-3 flex flex-wrap gap-2">{link.durations.map((value) => <button key={value} type="button" onClick={() => { setDuration(value); setTime(""); }} className={`min-h-10 rounded-lg px-4 text-sm font-medium ring-1 ${duration === value ? "bg-[#006b6b] text-white ring-[#006b6b]" : "ring-ink/15"}`}>{value === 60 ? "1 hora" : `${value} min`}</button>)}{link.meetingModes.map((value) => <button key={value} type="button" onClick={() => setMode(value)} className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium ring-1 ${mode === value ? "bg-[#e7f4f2] text-[#006b6b] ring-[#006b6b]" : "ring-ink/15"}`}>{value === "google_meet" ? <Video className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}{value === "google_meet" ? "Google Meet" : "Presencial"}</button>)}</div></div>
        <div><h3 className="text-sm font-semibold text-ink">3. Horario disponible</h3>{date ? <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">{slots.map((value) => <button key={value} type="button" onClick={() => setTime(value)} className={`min-h-11 rounded-lg text-sm font-semibold ring-1 ${time === value ? "bg-[#006b6b] text-white ring-[#006b6b]" : "ring-ink/15 hover:bg-[#e7f4f2]"}`}>{value}</button>)}{slots.length === 0 && <p className="col-span-full rounded-lg bg-[#f3f4f4] px-4 py-6 text-center text-sm text-ink/60">No quedan horarios libres ese día.</p>}</div> : <p className="mt-2 text-sm text-ink/55">Primero elegí un día.</p>}</div>
        <label className="block text-sm font-semibold text-ink">Nota para la reunión (opcional)<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="mt-2 w-full rounded-lg border border-ink/15 px-3 py-2 font-normal outline-none focus:border-[#006b6b]" /></label>
        {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}{notice && <p className="flex items-center gap-2 text-sm font-medium text-[#006b6b]"><CheckCircle2 className="h-4 w-4" />{notice}</p>}
        <div className="flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-lg border border-ink/15 px-5 text-sm font-medium">Cerrar</button><button type="button" onClick={() => void confirm()} disabled={!date || !time || saving || Boolean(notice)} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#006b6b] px-5 text-sm font-semibold text-white hover:bg-[#004949] disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{saving ? "Agendando…" : "Confirmar reunión"}</button></div>
      </div>}</div>
    </section></div>}
  </>;
}
