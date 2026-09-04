"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, ClipboardList, Loader2, Mail, MessageCircle, NotebookPen, Phone } from "lucide-react";
import { argentinaLocalDateTimeToIso } from "@/lib/argentina-time";

type ActivityType = "all" | "nota" | "correo" | "whatsapp" | "llamada" | "tarea" | "reunion";
const MODULES = {
  nota: { title: "Agregar una nota", label: "Nota", description: "Guardá información, observaciones o próximos pasos del contacto.", icon: NotebookPen },
  correo: { title: "Enviar un correo", label: "Correo", description: "Redactá desde el CRM y elegí una de las plantillas disponibles.", icon: Mail },
  whatsapp: { title: "Registrar WhatsApp", label: "WhatsApp", description: "Abrí la conversación o dejá asentado un mensaje en el historial.", icon: MessageCircle },
  llamada: { title: "Registrar una llamada", label: "Llamada", description: "Se guardarán el inicio, la finalización, la duración y la nota.", icon: Phone },
  tarea: { title: "Crear una tarea", label: "Tarea", description: "Definí el próximo paso y cuándo debe realizarse.", icon: ClipboardList },
  reunion: { title: "Agendar una reunión", label: "Reunión", description: "Consultá la disponibilidad del agente y guardala en Google Calendar.", icon: CalendarDays },
} as const;

export function CrmCallActivityAction({ activityType, leadId, whatsappUrl }: { activityType: ActivityType; leadId: string; whatsappUrl: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  if (activityType === "all") return <div className="mt-5 rounded-xl bg-[#f2f8f7] p-4 ring-1 ring-[#006b6b]/20"><p className="text-sm font-semibold text-ink">Crear una actividad</p><p className="mt-1 text-sm text-ink/62">Elegí el tipo de registro que querés agregar.</p><div className="mt-3 flex flex-wrap gap-2">{Object.entries(MODULES).map(([value, module]) => { const Icon = module.icon; return <button key={value} type="button" onClick={() => router.push(`?activity=${value}`)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#006b6b]/20 bg-white px-3 text-sm font-medium text-[#006b6b] hover:bg-[#e7f4f2]"><Icon className="h-4 w-4" />{module.label}</button>; })}</div></div>;

  // eslint-disable-next-line @next/next/no-assign-module-variable
  const module = MODULES[activityType];
  const Icon = module.icon;
  const isManual = activityType === "nota" || activityType === "whatsapp" || activityType === "tarea";
  const saveManualActivity = async () => {
    const finalTitle = title.trim() || (activityType === "nota" ? "Nota de contacto" : activityType === "whatsapp" ? "Registro de WhatsApp" : "Tarea de seguimiento");
    if (!body.trim() && activityType !== "tarea") return;
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/crm/activities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadId, type: activityType, title: finalTitle, body: body.trim(), scheduledAt: scheduledAt ? argentinaLocalDateTimeToIso(scheduledAt) : "" }) });
      const data = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "No se pudo guardar la actividad.");
      setTitle(""); setBody(""); setScheduledAt(""); setNotice("Registro guardado en actividades."); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo guardar la actividad."); }
    finally { setSaving(false); }
  };
  const primaryAction = () => { if (activityType === "llamada") window.dispatchEvent(new Event("crm:start-call")); if (activityType === "correo") window.dispatchEvent(new Event("crm:open-email-composer")); if (activityType === "reunion") window.dispatchEvent(new Event("crm:open-meeting-scheduler")); };

  return <div className="mt-5 rounded-xl bg-[#f2f8f7] p-4 ring-1 ring-[#006b6b]/20"><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#006b6b] text-white"><Icon className="h-4 w-4" /></span><div><h2 className="text-sm font-semibold text-ink">{module.title}</h2><p className="mt-1 text-sm leading-relaxed text-ink/62">{module.description}</p></div></div>{isManual ? <div className="mt-4 space-y-3">{activityType === "tarea" && <><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Título de la tarea" className="h-11 w-full rounded-lg border border-ink/15 bg-white px-3 text-sm outline-none placeholder:text-ink/48 focus:border-[#006b6b]" /><input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} className="h-11 w-full rounded-lg border border-ink/15 bg-white px-3 text-sm outline-none focus:border-[#006b6b]" /></>}<textarea value={body} onChange={(event) => setBody(event.target.value)} rows={4} placeholder={activityType === "nota" ? "Escribí la nota y el próximo paso…" : activityType === "whatsapp" ? "Mensaje o resumen de la conversación…" : "Detalle de la tarea…"} className="w-full resize-y rounded-lg border border-ink/15 bg-white px-3 py-3 text-sm leading-relaxed outline-none placeholder:text-ink/48 focus:border-[#006b6b] focus:ring-2 focus:ring-[#006b6b]/15" /><div className="flex flex-wrap justify-end gap-2">{activityType === "whatsapp" && whatsappUrl && <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#006b6b] bg-white px-4 text-sm font-medium text-[#006b6b]">Abrir WhatsApp</a>}<button type="button" onClick={() => void saveManualActivity()} disabled={saving || (activityType !== "tarea" && !body.trim())} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#006b6b] px-5 text-sm font-semibold text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Guardar registro</button></div></div> : <div className="mt-4 flex justify-end"><button type="button" onClick={primaryAction} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#006b6b] px-5 text-sm font-semibold text-white"><Icon className="h-4 w-4" />{activityType === "correo" ? "Redactar correo" : activityType === "reunion" ? "Agendar reunión" : "Iniciar llamada"}</button></div>}{error && <p role="alert" className="mt-3 text-sm font-medium text-red-700">{error}</p>}{notice && <p className="mt-3 text-sm font-medium text-emerald-700">{notice}</p>}</div>;
}
