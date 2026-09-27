"use client";

import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { usePathname } from "next/navigation";

export function GoogleCalendarConnectionNotice() {
  const pathname = usePathname();
  const [status, setStatus] = useState<"loading" | "connected" | "disconnected" | "error">("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function check() {
      try {
        const response = await fetch("/api/crm/calendar/status", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("No se pudo verificar la conexión");
        const data = await response.json();
        setStatus(data.connected ? "connected" : "disconnected");
      } catch {
        if (!controller.signal.aborted) setStatus("error");
      }
    }
    void check();
    window.addEventListener("focus", check);
    return () => { controller.abort(); window.removeEventListener("focus", check); };
  }, [pathname, attempt]);

  if (status === "loading" || status === "connected") return null;

  return <section aria-label="Conexión con Google Calendar" role="status" className="m-3 flex flex-col gap-3 rounded-lg border border-[#006b6b]/25 bg-[#edf7f6] p-4 text-ink sm:m-4 sm:flex-row sm:items-center">
    <CalendarDays aria-hidden="true" className="h-6 w-6 shrink-0 text-[#006b6b]" />
    <div className="min-w-0 flex-1">
      <p className="font-semibold">{status === "error" ? "No pudimos verificar tu calendario" : "Conectá tu Google Calendar"}</p>
      <p className="mt-1 text-sm">{status === "error" ? "Reintentá para comprobar si tu cuenta está conectada." : "Para agendar reuniones y tareas en tu calendario, conectá tu cuenta de Google y autorizá el acceso al calendario."}</p>
    </div>
    {status === "error" ? <button type="button" onClick={() => setAttempt(value => value + 1)} className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#006b6b] px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006b6b]">Reintentar</button> : <a href="/api/crm/google/connect" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-md bg-[#006b6b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#005454] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006b6b]">Conectar Google Calendar</a>}
  </section>;
}
