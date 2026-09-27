"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

const AiSales = dynamic(() => import("./ai-sales").then(module => module.AiSales), {
  loading: () => <p role="status" className="py-4 text-sm text-ink/75">Cargando informe AI Sales…</p>,
});
const openEvent = "crm:open-ai-sales";
const button = "min-h-10 rounded-md border border-[#006b6b]/30 bg-white px-3 py-2 text-sm font-medium text-[#006b6b] hover:bg-[#e7f4f2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#006b6b]";

export function AiSalesReportButton({ leadId }: { leadId: string }) {
  return <button type="button" className={button} aria-controls={`ai-sales-report-${leadId}`} onClick={() => {
    window.dispatchEvent(new CustomEvent(openEvent, { detail: { leadId } }));
  }}>AI Sales<span className="sr-only"> · Mostrar informe del cliente</span></button>;
}

export function AiSalesReport({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const show = (event: Event) => {
      if ((event as CustomEvent<{ leadId: string }>).detail?.leadId !== leadId) return;
      setOpen(true);
      toggle.current?.focus({ preventScroll: true });
      toggle.current?.scrollIntoView({ block: "start", behavior: "instant" });
    };
    window.addEventListener(openEvent, show);
    return () => window.removeEventListener(openEvent, show);
  }, [leadId]);
  return <section id="ai-sales" className="mt-5 border-t border-ink/15 pt-5">
    <button ref={toggle} type="button" className={`${button} scroll-mt-24`} aria-expanded={open} aria-controls={`ai-sales-report-${leadId}`} onClick={() => setOpen(value => !value)}>
      {open ? "Ocultar informe AI Sales" : "Mostrar informe AI Sales"}
    </button>
    <div id={`ai-sales-report-${leadId}`} hidden={!open} className="mt-3">
      {open && <AiSales leadId={leadId} expandDetails embedded />}
    </div>
  </section>;
}
