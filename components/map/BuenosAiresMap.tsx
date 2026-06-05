"use client";

import { useMemo, useState } from "react";
import { mapNeighborhoods, type MapNeighborhood } from "@/lib/map-neighborhoods";
import { NeighborhoodPanel } from "@/components/map/NeighborhoodPanel";

const districtShapes = [
  "M 15 18 L 31 9 L 44 17 L 39 31 L 22 32 Z",
  "M 31 9 L 52 13 L 61 27 L 44 37 L 39 31 L 44 17 Z",
  "M 52 13 L 70 25 L 73 43 L 61 50 L 61 27 Z",
  "M 22 32 L 39 31 L 44 37 L 40 51 L 21 53 L 10 40 Z",
  "M 44 37 L 61 27 L 61 50 L 52 62 L 40 51 Z",
  "M 61 50 L 73 43 L 80 58 L 72 73 L 59 66 Z",
  "M 21 53 L 40 51 L 52 62 L 43 78 L 24 77 L 12 63 Z",
  "M 52 62 L 59 66 L 72 73 L 63 88 L 43 78 Z",
];

export function BuenosAiresMap() {
  const [selected, setSelected] = useState<MapNeighborhood | null>(mapNeighborhoods[2]);
  const [hovered, setHovered] = useState<string | null>(null);
  const active = useMemo(() => selected ?? mapNeighborhoods[2], [selected]);

  return (
    <section className="relative min-h-screen overflow-hidden bg-[#070707] text-[#f8f5ef]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(192,138,90,0.26),transparent_34%),radial-gradient(circle_at_82%_58%,rgba(255,107,74,0.16),transparent_32%),linear-gradient(180deg,#070707,#120d0a_58%,#070707)]" />
      <div className="absolute inset-0 opacity-[0.11] [background-image:linear-gradient(rgba(248,245,239,.16)_1px,transparent_1px),linear-gradient(90deg,rgba(248,245,239,.16)_1px,transparent_1px)] [background-size:54px_54px]" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1500px] flex-col px-5 py-6 md:px-10 lg:px-14">
        <header className="flex items-center justify-between gap-4">
          <a href="/" className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/75 backdrop-blur-md transition hover:bg-white/10 hover:text-white">
            Barrera Brokers
          </a>
          <div className="hidden rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-[10px] uppercase tracking-[0.22em] text-white/55 backdrop-blur-md md:block">
            Mapa interactivo de inversión
          </div>
        </header>

        <div className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="max-w-2xl">
            <p className="mb-5 text-[11px] uppercase tracking-[0.34em] text-[#c9b8a0]">Buenos Aires · Real Estate Intelligence</p>
            <h1 className="font-display text-[18vw] font-light leading-[0.78] tracking-[-0.075em] md:text-[8.8rem] lg:text-[9.6rem]">
              Explorá
              <span className="block italic text-[#d8c4af]">Buenos Aires</span>
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-relaxed text-white/65 md:text-xl">
              Recorré las zonas con mayor demanda para invertir, vivir o generar renta temporaria en la Ciudad de Buenos Aires.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#mapa-interactivo" className="rounded-full bg-[#f8f5ef] px-7 py-4 text-[10px] font-bold uppercase tracking-[0.22em] text-[#070707] transition hover:bg-[#d8c4af]">
                Explorar mapa
              </a>
              <a href="/#contacto" className="rounded-full border border-white/15 px-7 py-4 text-[10px] font-bold uppercase tracking-[0.22em] text-white/80 transition hover:bg-white/10 hover:text-white">
                Agendar consulta
              </a>
            </div>
          </div>

          <div id="mapa-interactivo" className="relative mx-auto w-full max-w-[760px]">
            <div className="absolute -inset-8 rounded-[52px] bg-[#b89d87]/10 blur-3xl" />
            <div className="relative rounded-[40px] border border-white/10 bg-white/[0.035] p-4 shadow-[0_40px_120px_rgba(0,0,0,.45)] backdrop-blur-xl md:p-7">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Vista isométrica</p>
                  <p className="font-display text-3xl font-light tracking-[-0.04em] text-white">CABA</p>
                </div>
                <div className="rounded-full border border-white/10 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-white/50">Night mode</div>
              </div>

              <div className="relative aspect-[1.08/1] overflow-hidden rounded-[30px] border border-white/10 bg-[#0d0a08]">
                <svg viewBox="0 0 100 100" className="h-full w-full drop-shadow-2xl" role="img" aria-label="Mapa interactivo de Buenos Aires">
                  <defs>
                    <linearGradient id="baDistrict" x1="0" x2="1" y1="0" y2="1">
                      <stop offset="0%" stopColor="#3a1d17" />
                      <stop offset="100%" stopColor="#b89d87" />
                    </linearGradient>
                    <filter id="glow"><feGaussianBlur stdDeviation="1.8" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                  </defs>

                  <g transform="translate(2 3) rotate(-7 50 50) skewX(-8)">
                    {districtShapes.map((d, index) => (
                      <path key={d} d={d} fill="url(#baDistrict)" opacity={0.18 + index * 0.035} stroke="rgba(248,245,239,.18)" strokeWidth="0.28" />
                    ))}
                    <path d="M 76 22 C 91 39 93 65 76 92" fill="none" stroke="rgba(216,196,175,.42)" strokeWidth="1.2" strokeLinecap="round" />
                    <path d="M 16 18 L 44 37 L 72 73" fill="none" stroke="rgba(248,245,239,.14)" strokeWidth="0.6" strokeDasharray="2 2" />
                    <path d="M 24 77 L 44 37 L 70 25" fill="none" stroke="rgba(248,245,239,.10)" strokeWidth="0.6" strokeDasharray="2 2" />

                    {mapNeighborhoods.map((item) => {
                      const isActive = active.id === item.id;
                      const isHovered = hovered === item.id;
                      return (
                        <g key={item.id} transform={`translate(${item.x} ${item.y})`} className="cursor-pointer" onMouseEnter={() => setHovered(item.id)} onMouseLeave={() => setHovered(null)} onClick={() => setSelected(item)}>
                          <circle r={isActive ? 4.1 : 3.1} fill={item.accent} opacity="0.22" filter="url(#glow)" />
                          <circle r={isActive ? 2.1 : 1.55} fill={item.accent} stroke="#f8f5ef" strokeWidth="0.32" />
                          <circle r={isActive ? 6.3 : 4.8} fill="none" stroke={item.accent} strokeWidth="0.32" opacity={isActive || isHovered ? 0.85 : 0.28}>
                            <animate attributeName="r" values="4.8;7.2;4.8" dur="3s" repeatCount="indefinite" />
                            <animate attributeName="opacity" values=".55;.12;.55" dur="3s" repeatCount="indefinite" />
                          </circle>
                          {(isActive || isHovered) && (
                            <text x="3.8" y="-3.2" fill="#f8f5ef" fontSize="2.8" fontWeight="600" letterSpacing=".04em">{item.name}</text>
                          )}
                        </g>
                      );
                    })}
                  </g>
                </svg>

                <div className="pointer-events-none absolute bottom-4 left-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-white/50 backdrop-blur-md">
                  Tocá un punto para explorar
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[10px] uppercase tracking-[0.18em] text-white/45">
                <div className="rounded-full border border-white/10 py-3">Demanda</div>
                <div className="rounded-full border border-white/10 py-3">Renta</div>
                <div className="rounded-full border border-white/10 py-3">m²</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {selected && <NeighborhoodPanel neighborhood={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}
