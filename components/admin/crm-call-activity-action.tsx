"use client";

import { Phone } from "lucide-react";

export function CrmCallActivityAction() {
  return (
    <div className="mt-5 flex flex-col gap-3 rounded-xl bg-[#f2f8f7] p-4 ring-1 ring-[#006b6b]/20 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-sm font-semibold text-ink">Registrar una llamada</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink/62">
          Se guardarán el inicio, la finalización, la duración y la nota en el historial.
        </p>
      </div>
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event("crm:start-call"))}
        className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#006b6b] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#005858] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006b6b] focus-visible:ring-offset-2"
      >
        <Phone className="h-4 w-4" />
        Iniciar llamada
      </button>
    </div>
  );
}
