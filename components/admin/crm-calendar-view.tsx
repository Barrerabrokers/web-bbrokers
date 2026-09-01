"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CalendarCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Mail,
  Plus,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import type { CrmActivity, CrmActivityType, CrmLead } from "@/lib/db";

type CalendarLeadOption = Pick<
  CrmLead,
  "id" | "firstName" | "lastName" | "email" | "countryCode" | "phone"
>;

type CalendarActivity = Pick<
  CrmActivity,
  "id" | "leadId" | "type" | "title" | "body" | "scheduledAt" | "createdAt"
> & {
  lead?: CalendarLeadOption;
};

type CalendarView = "day" | "week" | "month" | "year";
type CalendarEventType = Extract<CrmActivityType, "reunion" | "tarea" | "nota">;

type DraftEvent = {
  leadId: string;
  type: CalendarEventType;
  date: string;
  time: string;
  title: string;
  body: string;
};

const calendarHours = Array.from({ length: 13 }, (_, index) => index + 8);

const eventTypes: { value: CalendarEventType; label: string; tone: string }[] = [
  { value: "reunion", label: "Reunión", tone: "border-[#0f766e]/20 bg-[#e8f5f1] text-[#0f4f4a]" },
  { value: "tarea", label: "Tarea", tone: "border-[#a16207]/20 bg-[#fff7e8] text-[#70430a]" },
  { value: "nota", label: "Nota", tone: "border-[#7c3aed]/20 bg-[#f4efff] text-[#4c1d95]" },
];

const viewLabels: { value: CalendarView; label: string }[] = [
  { value: "day", label: "Día" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
  { value: "year", label: "Año" },
];

function leadName(lead?: CalendarLeadOption) {
  const name = [lead?.firstName, lead?.lastName].filter(Boolean).join(" ").trim();
  return name || lead?.email || "Contacto sin asignar";
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayValue() {
  return dateKey(new Date());
}

function timeValue(hour = 10) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function startOfWeek(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  return start;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function addYears(date: Date, years: number) {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + years);
  return next;
}

function formatTitle(date: Date, view: CalendarView) {
  if (view === "day") {
    return new Intl.DateTimeFormat("es-AR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(date);
  }

  if (view === "week") {
    const start = startOfWeek(date);
    const end = addDays(start, 6);
    return `${new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" }).format(start)} - ${new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric" }).format(end)}`;
  }

  if (view === "year") {
    return String(date.getFullYear());
  }

  return new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatDayLabel(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "2-digit",
  }).format(date);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function isSameDay(a: Date, b: Date) {
  return dateKey(a) === dateKey(b);
}

function eventTone(type: CrmActivityType) {
  return eventTypes.find((item) => item.value === type)?.tone || "border-ink/10 bg-cream-50 text-ink";
}

function createDraft(leads: CalendarLeadOption[], date: Date, hour = 10): DraftEvent {
  return {
    leadId: leads[0]?.id || "",
    type: "reunion",
    date: dateKey(date),
    time: timeValue(hour),
    title: "",
    body: "",
  };
}

function googleCalendarEmbedUrl(email?: string | null) {
  if (!email) return "";
  const params = new URLSearchParams({
    src: email,
    ctz: "America/Argentina/Buenos_Aires",
    mode: "WEEK",
    showTitle: "0",
    showNav: "1",
    showPrint: "0",
    showTabs: "1",
    showCalendars: "0",
    showTz: "0",
    wkst: "2",
    bgcolor: "#ffffff",
  });

  return `https://calendar.google.com/calendar/embed?${params.toString()}`;
}

export function CrmCalendarView({
  activities,
  leads,
  email,
  isGoogleConnected,
}: {
  activities: CalendarActivity[];
  leads: CalendarLeadOption[];
  email?: string | null;
  isGoogleConnected?: boolean;
}) {
  const router = useRouter();
  const [view, setView] = useState<CalendarView>("week");
  const [cursorDate, setCursorDate] = useState(() => new Date());
  const [draft, setDraft] = useState<DraftEvent | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState("");
  const [error, setError] = useState("");
  const [calendarFrameKey, setCalendarFrameKey] = useState(0);

  const scheduledActivities = useMemo(
    () =>
      activities
        .filter(
          (activity) =>
            activity.scheduledAt &&
            (activity.type === "reunion" || activity.type === "tarea" || activity.type === "nota")
        )
        .sort(
          (a, b) =>
            new Date(a.scheduledAt || a.createdAt).getTime() -
            new Date(b.scheduledAt || b.createdAt).getTime()
        ),
    [activities]
  );

  const activitiesByDate = useMemo(() => {
    return scheduledActivities.reduce<Record<string, CalendarActivity[]>>((groups, activity) => {
      if (!activity.scheduledAt) return groups;
      const key = dateKey(new Date(activity.scheduledAt));
      groups[key] = [...(groups[key] || []), activity];
      return groups;
    }, {});
  }, [scheduledActivities]);

  const upcoming = scheduledActivities.filter((activity) => {
    if (!activity.scheduledAt) return false;
    return new Date(activity.scheduledAt).getTime() >= new Date().setHours(0, 0, 0, 0);
  });

  const selectedLead = leads.find((lead) => lead.id === draft?.leadId);
  const googleEmbedUrl = isGoogleConnected ? googleCalendarEmbedUrl(email) : "";

  const goToday = () => setCursorDate(new Date());
  const goPrevious = () => {
    setCursorDate((current) => {
      if (view === "day") return addDays(current, -1);
      if (view === "week") return addDays(current, -7);
      if (view === "year") return addYears(current, -1);
      return addMonths(current, -1);
    });
  };
  const goNext = () => {
    setCursorDate((current) => {
      if (view === "day") return addDays(current, 1);
      if (view === "week") return addDays(current, 7);
      if (view === "year") return addYears(current, 1);
      return addMonths(current, 1);
    });
  };

  const openDraft = (date: Date, hour = 10) => {
    setError("");
    setDraft(createDraft(leads, date, hour));
  };

  const saveEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft?.leadId) {
      setError("Elegí un contacto para asociar el evento.");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const label = eventTypes.find((item) => item.value === draft.type)?.label || "Evento";
      const title = draft.title.trim() || `${label} con ${leadName(selectedLead)}`;
      const response = await fetch("/api/crm/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: draft.leadId,
          type: draft.type,
          title,
          body: draft.body,
          scheduledAt: new Date(`${draft.date}T${draft.time}:00`).toISOString(),
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error || "No se pudo crear el evento en Google Calendar");
      }
      setDraft(null);
      setCalendarFrameKey((current) => current + 1);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el evento en Google Calendar");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteEvent = async (activityId: string) => {
    const confirmed = window.confirm("¿Seguro que querés eliminar este evento del calendario?");
    if (!confirmed) return;

    setIsDeletingId(activityId);
    try {
      const response = await fetch(`/api/crm/activities?id=${encodeURIComponent(activityId)}`, {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error || "No se pudo eliminar el evento");
      }
      router.refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "No se pudo eliminar el evento");
    } finally {
      setIsDeletingId("");
    }
  };

  return (
    <main className="-m-6 h-[calc(100vh-56px)] overflow-hidden bg-cream-100 p-2 md:-m-10">
      <div className="grid h-full min-h-0 w-full grid-rows-[auto_minmax(0,1fr)] gap-2">
        <section className="rounded-md border border-ink/12 bg-white px-3 py-2">
          <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="text-lg font-semibold tracking-tight text-ink">
                Calendario
              </h1>
              <span className="hidden h-4 w-px bg-ink/12 sm:block" />
              <p className="max-w-[56ch] truncate text-xs text-ink/62">
                Google Calendar embebido para ver el día y la semana completa de un pantallazo.
              </p>
              <span className="rounded-full border border-ink/10 bg-cream-50 px-2.5 py-1 text-[11px] font-medium text-ink/70">
                {isGoogleConnected ? email || "Gmail conectado" : "Gmail pendiente"}
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Link
                href="/admin/crm/reuniones"
                className="rounded-full bg-[#17384a] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#244f67]"
              >
                Link de reuniones
              </Link>
              <Link
                href="/admin/crm/correo"
                className="rounded-full border border-ink/14 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink transition-colors hover:bg-cream-100"
              >
                Configurar
              </Link>
              <a
                href="https://calendar.google.com/calendar/u/0/r"
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-ink/14 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink transition-colors hover:bg-cream-100"
              >
                Abrir Google
              </a>
              <button
                type="button"
                onClick={() => openDraft(cursorDate, 10)}
                className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-ink/85"
              >
                <Plus className="h-3.5 w-3.5" />
                Evento
              </button>
            </div>
          </div>
        </section>

        <section className="min-h-0 overflow-hidden rounded-md border border-ink/12 bg-white">
          <GoogleCalendarFrame key={calendarFrameKey} email={email} embedUrl={googleEmbedUrl} />
        </section>
      </div>

      {draft && (
        <EventDialog
          draft={draft}
          leads={leads}
          selectedLead={selectedLead}
          error={error}
          isSaving={isSaving}
          setDraft={setDraft}
          onClose={() => setDraft(null)}
          onSubmit={saveEvent}
        />
      )}
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: number;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-ink/10 bg-cream-50 px-3 py-2.5">
      <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-ink/68">
        <Icon className="h-4 w-4 shrink-0 text-accent" />
        <span className="truncate">{label}</span>
      </span>
      <span className="shrink-0 text-lg font-semibold text-ink">{value}</span>
    </div>
  );
}

function GoogleCalendarFrame({
  email,
  embedUrl,
}: {
  email?: string | null;
  embedUrl: string;
}) {
  if (!email || !embedUrl) {
    return (
      <div className="flex h-full items-center justify-center bg-cream-50 p-6 text-center">
        <div className="max-w-lg rounded-lg border border-ink/12 bg-white p-6 shadow-sm">
          <Mail className="mx-auto h-8 w-8 text-accent" />
          <h3 className="mt-4 text-xl font-semibold text-ink">
            Conectá Google para usar Gmail y Calendar
          </h3>
          <p className="mt-2 text-sm leading-6 text-ink/62">
            Primero conectá tu cuenta de Google en Correo de CRM. Después vas a poder ver la agenda y crear reuniones desde esta pantalla.
          </p>
          <Link
            href="/api/crm/google/connect"
            className="mt-5 inline-flex rounded-full bg-ink px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white transition-colors hover:bg-ink/85"
          >
            Conectar Google
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-cream-50">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 bg-white px-4 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/45">
            Google Calendar
          </p>
          <p className="truncate text-sm font-semibold text-ink">{email}</p>
        </div>
        <a
          href="https://calendar.google.com/calendar/u/0/r"
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-ink/14 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink transition-colors hover:bg-cream-100"
        >
          Abrir en Google
        </a>
      </div>
      <iframe
        title={`Google Calendar de ${email}`}
        src={embedUrl}
        className="min-h-0 flex-1 border-0 bg-white"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}

function DayView({
  date,
  activitiesByDate,
  openDraft,
  deleteEvent,
  isDeletingId,
}: CalendarGridProps & { date: Date }) {
  const key = dateKey(date);
  return (
    <div className="h-full overflow-y-auto">
      <div className="grid grid-cols-[64px_1fr]">
        {calendarHours.map((hour) => (
          <HourRow
            key={hour}
            date={date}
            hour={hour}
            events={(activitiesByDate[key] || []).filter((activity) => new Date(activity.scheduledAt || "").getHours() === hour)}
            openDraft={openDraft}
            deleteEvent={deleteEvent}
            isDeletingId={isDeletingId}
          />
        ))}
      </div>
    </div>
  );
}

type CalendarGridProps = {
  activitiesByDate: Record<string, CalendarActivity[]>;
  openDraft: (date: Date, hour?: number) => void;
  deleteEvent: (activityId: string) => void;
  isDeletingId: string;
};

function WeekView({ date, activitiesByDate, openDraft, deleteEvent, isDeletingId }: CalendarGridProps & { date: Date }) {
  const weekStart = startOfWeek(date);
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));

  return (
    <div className="h-full overflow-hidden">
      <div className="grid grid-cols-[58px_repeat(7,minmax(0,1fr))] border-b border-ink/10 bg-cream-50">
        <div className="border-r border-ink/10 p-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink/45">
          Hora
        </div>
        {weekDays.map((day) => (
          <button
            key={dateKey(day)}
            type="button"
            onClick={() => openDraft(day, 10)}
            className={`min-w-0 truncate border-r border-ink/10 p-2 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-ink last:border-r-0 hover:bg-white ${
              isSameDay(day, new Date()) ? "bg-[#eef7f3]" : ""
            }`}
          >
            {formatDayLabel(day)}
          </button>
        ))}
      </div>
      <div className="h-[calc(100%-39px)] overflow-y-auto">
        {calendarHours.map((hour) => (
          <div
            key={hour}
            className="grid min-h-[76px] grid-cols-[58px_repeat(7,minmax(0,1fr))] border-b border-ink/10 last:border-b-0"
          >
            <div className="border-r border-ink/10 bg-cream-50 p-2 text-[11px] font-semibold text-ink/50">
              {String(hour).padStart(2, "0")}:00
            </div>
            {weekDays.map((day) => {
              const events = (activitiesByDate[dateKey(day)] || []).filter(
                (activity) => new Date(activity.scheduledAt || "").getHours() === hour
              );
              return (
                <div
                  key={`${dateKey(day)}-${hour}`}
                  onClick={() => openDraft(day, hour)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") openDraft(day, hour);
                  }}
                  role="button"
                  tabIndex={0}
                  className="min-w-0 border-r border-ink/10 p-1.5 text-left transition-colors hover:bg-cream-50 last:border-r-0"
                >
                  <EventStack
                    events={events}
                    deleteEvent={deleteEvent}
                    isDeletingId={isDeletingId}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

type HourRowProps = Omit<CalendarGridProps, "activitiesByDate"> & {
  date: Date;
  hour: number;
  events: CalendarActivity[];
};

function HourRow({
  date,
  hour,
  events,
  openDraft,
  deleteEvent,
  isDeletingId,
}: HourRowProps) {
  return (
    <>
      <div className="min-h-[78px] border-b border-r border-ink/10 bg-cream-50 p-2 text-[11px] font-semibold text-ink/50">
        {String(hour).padStart(2, "0")}:00
      </div>
      <div
        onClick={() => openDraft(date, hour)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") openDraft(date, hour);
        }}
        role="button"
        tabIndex={0}
        className="min-h-[78px] border-b border-ink/10 p-2 text-left transition-colors hover:bg-cream-50"
      >
        <EventStack events={events} deleteEvent={deleteEvent} isDeletingId={isDeletingId} />
      </div>
    </>
  );
}

function MonthView({ date, activitiesByDate, openDraft, deleteEvent, isDeletingId }: CalendarGridProps & { date: Date }) {
  const monthStart = startOfMonth(date);
  const gridStart = startOfWeek(monthStart);
  const days = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  const currentMonth = date.getMonth();

  return (
    <div className="grid h-full grid-rows-[32px_1fr] overflow-hidden">
      <div className="grid grid-cols-7 border-b border-ink/10 bg-cream-50">
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((label) => (
          <div key={label} className="border-r border-ink/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/50 last:border-r-0">
            {label}
          </div>
        ))}
      </div>
      <div className="grid min-h-0 grid-cols-7 grid-rows-6">
        {days.map((day) => {
          const key = dateKey(day);
          const events = activitiesByDate[key] || [];
          return (
            <div
              key={key}
              onClick={() => openDraft(day, 10)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") openDraft(day, 10);
              }}
              role="button"
              tabIndex={0}
              className={`min-h-0 border-b border-r border-ink/10 p-2 text-left transition-colors hover:bg-cream-50 ${
                day.getMonth() === currentMonth ? "bg-white" : "bg-cream-50/55 text-ink/35"
              }`}
            >
              <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                isSameDay(day, new Date()) ? "bg-ink text-white" : "text-ink/70"
              }`}>
                {day.getDate()}
              </span>
              <div className="mt-1 space-y-1">
                {events.slice(0, 3).map((activity) => (
                  <CalendarEventPill
                    key={activity.id}
                    activity={activity}
                    compact
                    deleteEvent={deleteEvent}
                    isDeleting={isDeletingId === activity.id}
                  />
                ))}
                {events.length > 3 && (
                  <span className="block text-[11px] font-semibold text-ink/45">+{events.length - 3} más</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function YearView({
  date,
  activitiesByDate,
  openDraft,
}: {
  date: Date;
  activitiesByDate: Record<string, CalendarActivity[]>;
  openDraft: (date: Date, hour?: number) => void;
}) {
  const months = Array.from({ length: 12 }, (_, index) => new Date(date.getFullYear(), index, 1));

  return (
    <div className="h-full overflow-y-auto p-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {months.map((month) => (
          <article key={month.toISOString()} className="rounded-md border border-ink/10 bg-white p-3">
            <h3 className="text-sm font-semibold capitalize text-ink">
              {new Intl.DateTimeFormat("es-AR", { month: "long" }).format(month)}
            </h3>
            <MiniMonth month={month} activitiesByDate={activitiesByDate} openDraft={openDraft} />
          </article>
        ))}
      </div>
    </div>
  );
}

function MiniMonth({
  month,
  activitiesByDate,
  openDraft,
}: {
  month: Date;
  activitiesByDate: Record<string, CalendarActivity[]>;
  openDraft: (date: Date, hour?: number) => void;
}) {
  const start = startOfWeek(startOfMonth(month));
  const days = Array.from({ length: 42 }, (_, index) => addDays(start, index));
  return (
    <div className="mt-3 grid grid-cols-7 gap-1">
      {days.map((day) => {
        const hasEvents = (activitiesByDate[dateKey(day)] || []).length > 0;
        return (
          <button
            key={dateKey(day)}
            type="button"
            onClick={() => openDraft(day, 10)}
            className={`relative rounded-md px-1.5 py-1 text-xs transition-colors hover:bg-cream-100 ${
              day.getMonth() === month.getMonth() ? "text-ink" : "text-ink/25"
            } ${isSameDay(day, new Date()) ? "bg-ink text-white hover:bg-ink/90" : ""}`}
          >
            {day.getDate()}
            {hasEvents && <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-accent" />}
          </button>
        );
      })}
    </div>
  );
}

function EventStack({
  events,
  deleteEvent,
  isDeletingId,
}: {
  events: CalendarActivity[];
  deleteEvent: (activityId: string) => void;
  isDeletingId: string;
}) {
  return (
    <div className="space-y-1">
      {events.map((activity) => (
        <CalendarEventPill
          key={activity.id}
          activity={activity}
          deleteEvent={deleteEvent}
          isDeleting={isDeletingId === activity.id}
        />
      ))}
    </div>
  );
}

function CalendarEventPill({
  activity,
  compact = false,
  deleteEvent,
  isDeleting,
}: {
  activity: CalendarActivity;
  compact?: boolean;
  deleteEvent: (activityId: string) => void;
  isDeleting: boolean;
}) {
  return (
    <span
      className={`group flex min-w-0 items-start justify-between gap-1 rounded-md border px-2 py-1 text-left shadow-sm ${eventTone(activity.type)}`}
      onClick={(event) => event.stopPropagation()}
    >
      <span className="min-w-0">
        <span className="block truncate text-[11px] font-semibold">
          {activity.scheduledAt && !compact ? `${formatTime(activity.scheduledAt)} · ` : ""}
          {activity.title}
        </span>
        {!compact && <span className="block truncate text-[10px] opacity-75">{leadName(activity.lead)}</span>}
      </span>
      {deleteEvent && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            deleteEvent(activity.id);
          }}
          disabled={isDeleting}
          className="shrink-0 rounded-full p-0.5 opacity-0 transition-opacity hover:bg-white/70 group-hover:opacity-100 disabled:opacity-50"
          title="Eliminar evento"
        >
          {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
        </button>
      )}
    </span>
  );
}

function EventDialog({
  draft,
  leads,
  selectedLead,
  error,
  isSaving,
  setDraft,
  onClose,
  onSubmit,
}: {
  draft: DraftEvent;
  leads: CalendarLeadOption[];
  selectedLead?: CalendarLeadOption;
  error: string;
  isSaving: boolean;
  setDraft: (draft: DraftEvent) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/30 px-4 py-8 backdrop-blur-sm">
      <form onSubmit={onSubmit} className="w-full max-w-2xl rounded-lg border border-ink/12 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-ink/10 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/45">Calendario</p>
            <h2 className="mt-1 text-2xl font-semibold text-ink">Nuevo evento</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-ink/12 p-2 text-ink transition-colors hover:bg-cream-100"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/48">Contacto</span>
            <select
              value={draft.leadId}
              onChange={(event) => setDraft({ ...draft, leadId: event.target.value })}
              className="mt-2 w-full rounded-md border border-ink/14 bg-white px-3 py-3 text-sm text-ink outline-none transition-colors focus:border-accent"
              required
            >
              {leads.length === 0 && <option value="">No hay contactos disponibles</option>}
              {leads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {leadName(lead)}{lead.email ? ` · ${lead.email}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/48">Tipo</span>
            <select
              value={draft.type}
              onChange={(event) => setDraft({ ...draft, type: event.target.value as CalendarEventType })}
              className="mt-2 w-full rounded-md border border-ink/14 bg-white px-3 py-3 text-sm text-ink outline-none transition-colors focus:border-accent"
            >
              {eventTypes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/48">Título</span>
            <input
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              placeholder={`Ej: Reunión con ${leadName(selectedLead)}`}
              className="mt-2 w-full rounded-md border border-ink/14 bg-white px-3 py-3 text-sm text-ink outline-none transition-colors placeholder:text-ink/45 focus:border-accent"
            />
          </label>

          <label>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/48">Fecha</span>
            <input
              type="date"
              value={draft.date}
              onChange={(event) => setDraft({ ...draft, date: event.target.value })}
              className="mt-2 w-full rounded-md border border-ink/14 bg-white px-3 py-3 text-sm text-ink outline-none transition-colors focus:border-accent"
              required
            />
          </label>

          <label>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/48">Hora</span>
            <input
              type="time"
              value={draft.time}
              onChange={(event) => setDraft({ ...draft, time: event.target.value })}
              className="mt-2 w-full rounded-md border border-ink/14 bg-white px-3 py-3 text-sm text-ink outline-none transition-colors focus:border-accent"
              required
            />
          </label>

          <label className="sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/48">Nota</span>
            <textarea
              value={draft.body}
              onChange={(event) => setDraft({ ...draft, body: event.target.value })}
              rows={4}
              placeholder="Detalle del evento, dirección, recordatorio o próximos pasos."
              className="mt-2 w-full resize-none rounded-md border border-ink/14 bg-white px-3 py-3 text-sm leading-6 text-ink outline-none transition-colors placeholder:text-ink/45 focus:border-accent"
            />
          </label>
        </div>

        {error && (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-ink/15 px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-ink transition-colors hover:bg-cream-100"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSaving || leads.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:bg-ink/85 disabled:cursor-not-allowed disabled:bg-ink/35"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Guardar en Google
          </button>
        </div>
      </form>
    </div>
  );
}
