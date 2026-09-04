"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Loader2, Plus, Trash2, X } from "lucide-react";
import type { CrmActivityType, CrmLead } from "@/lib/db";
import { argentinaDateKey, argentinaLocalDateTimeToIso } from "@/lib/argentina-time";

type CalendarLeadOption = Pick<
  CrmLead,
  "id" | "firstName" | "lastName" | "email" | "countryCode" | "phone"
>;

const eventTypes: { value: Extract<CrmActivityType, "reunion" | "tarea" | "nota">; label: string }[] = [
  { value: "reunion", label: "Reunión" },
  { value: "tarea", label: "Tarea" },
  { value: "nota", label: "Nota con recordatorio" },
];

function leadName(lead?: CalendarLeadOption) {
  const name = [lead?.firstName, lead?.lastName].filter(Boolean).join(" ").trim();
  return name || lead?.email || "Contacto";
}

function todayValue() {
  return argentinaDateKey(new Date());
}

export function AddCalendarEvent({ leads }: { leads: CalendarLeadOption[] }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [leadId, setLeadId] = useState(leads[0]?.id || "");
  const [type, setType] = useState<Extract<CrmActivityType, "reunion" | "tarea" | "nota">>("reunion");
  const [date, setDate] = useState(todayValue());
  const [time, setTime] = useState("10:00");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const selectedLead = useMemo(
    () => leads.find((lead) => lead.id === leadId),
    [leadId, leads]
  );

  const submitEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!leadId) {
      setError("Elegí un contacto para asociar el evento.");
      return;
    }

    setIsSaving(true);
    setError("");

    const eventLabel = eventTypes.find((item) => item.value === type)?.label || "Evento";
    const eventTitle = title.trim() || `${eventLabel} con ${leadName(selectedLead)}`;
    const scheduledAt = argentinaLocalDateTimeToIso(date, time);

    try {
      const response = await fetch("/api/crm/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          type,
          title: eventTitle,
          body,
          scheduledAt,
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(data?.error || "No se pudo guardar el evento");
      }

      setTitle("");
      setBody("");
      setIsOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el evento");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white transition-colors hover:bg-ink/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
      >
        <Plus className="h-4 w-4" />
        Agregar evento
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/30 px-4 py-8 backdrop-blur-sm">
          <form
            onSubmit={submitEvent}
            className="w-full max-w-2xl rounded-lg border border-ink/12 bg-white p-5 shadow-xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-ink/10 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/45">
                  Calendario
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-ink">Nuevo evento</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full border border-ink/12 p-2 text-ink transition-colors hover:bg-cream-100"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/48">
                  Contacto
                </span>
                <select
                  value={leadId}
                  onChange={(event) => setLeadId(event.target.value)}
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
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/48">
                  Tipo
                </span>
                <select
                  value={type}
                  onChange={(event) =>
                    setType(event.target.value as Extract<CrmActivityType, "reunion" | "tarea" | "nota">)
                  }
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
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/48">
                  Título
                </span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={`Ej: Reunión con ${leadName(selectedLead)}`}
                  className="mt-2 w-full rounded-md border border-ink/14 bg-white px-3 py-3 text-sm text-ink outline-none transition-colors placeholder:text-ink/45 focus:border-accent"
                />
              </label>

              <label>
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/48">
                  Fecha
                </span>
                <input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="mt-2 w-full rounded-md border border-ink/14 bg-white px-3 py-3 text-sm text-ink outline-none transition-colors focus:border-accent"
                  required
                />
              </label>

              <label>
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/48">
                  Hora
                </span>
                <input
                  type="time"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                  className="mt-2 w-full rounded-md border border-ink/14 bg-white px-3 py-3 text-sm text-ink outline-none transition-colors focus:border-accent"
                  required
                />
              </label>

              <label className="sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/48">
                  Nota
                </span>
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
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
                onClick={() => setIsOpen(false)}
                className="rounded-full border border-ink/15 px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-ink transition-colors hover:bg-cream-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving || leads.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:bg-ink/85 disabled:cursor-not-allowed disabled:bg-ink/35"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
                Guardar evento
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export function DeleteCalendarEvent({ activityId }: { activityId: string }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const deleteEvent = async () => {
    const confirmed = window.confirm("¿Seguro que querés eliminar este evento del calendario?");
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/crm/activities?id=${encodeURIComponent(activityId)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "No se pudo eliminar el evento");
      }
      router.refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "No se pudo eliminar el evento");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <button
      type="button"
      onClick={deleteEvent}
      disabled={isDeleting}
      title="Eliminar evento"
      className="inline-flex rounded-full border border-red-200 bg-white p-1 text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-45"
    >
      {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
    </button>
  );
}
