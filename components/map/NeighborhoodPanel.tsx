"use client";

import type { MapNeighborhood } from "@/lib/map-neighborhoods";

export function NeighborhoodPanel({
  neighborhood,
  onClose,
}: {
  neighborhood: MapNeighborhood;
  onClose: () => void;
}) {
  return (
    <aside className="fixed bottom-4 left-4 right-4 z-40 rounded-[28px] border border-white/10 bg-[#090807]/90 p-6 text-[#f8f5ef] shadow-2xl backdrop-blur-xl md:left-auto md:top-1/2 md:right-8 md:bottom-auto md:w-[390px] md:-translate-y-1/2">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-[10px] uppercase tracking-[0.28em] text-[#c9b8a0]">Zona destacada</p>
          <h2 className="font-display text-5xl font-light leading-none tracking-[-0.05em]">{neighborhood.name}</h2>
        </div>
        <button
          onClick={onClose}
          className="rounded-full border border-white/10 px-3 py-2 text-xs uppercase tracking-[0.18em] text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          Cerrar
        </button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-white/45">Precio m²</p>
          <p className="text-lg text-white">{neighborhood.price}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-white/45">Demanda</p>
          <p className="text-lg text-white">{neighborhood.demand}</p>
        </div>
      </div>

      <p className="mb-5 text-base leading-relaxed text-white/72">{neighborhood.description}</p>
      <p className="mb-8 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm leading-relaxed text-[#d8c4af]">{neighborhood.profile}</p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <a href="/#desarrollos" className="rounded-full bg-[#f8f5ef] px-6 py-3 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-[#070707] transition hover:bg-[#d8c4af]">
          Ver oportunidades
        </a>
        <a href="/#contacto" className="rounded-full border border-white/15 px-6 py-3 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-white/10">
          Agendar consulta
        </a>
      </div>
    </aside>
  );
}
