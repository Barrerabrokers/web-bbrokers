"use client";

import type { Development } from "@/types";

const corridor = [
  { name: "Puerto Madero", x: 74, y: 72 },
  { name: "San Telmo", x: 66, y: 77 },
  { name: "Centro", x: 62, y: 61 },
  { name: "Recoleta", x: 54, y: 47 },
  { name: "Palermo", x: 42, y: 35 },
  { name: "Belgrano", x: 28, y: 24 },
  { name: "Núñez", x: 17, y: 15 },
];

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function getPoint(development: Development, index: number) {
  const text = normalize(`${development.name} ${development.location} ${development.address}`);
  const match = corridor.find((zone) => text.includes(normalize(zone.name)));
  const base = match ?? corridor[index % corridor.length];
  return { x: base.x + (index % 3) * 2.1 - 2.1, y: base.y + Math.floor(index / 3) * 2.2 };
}

export function DevelopmentsOnlyMap({ developments }: { developments: Development[] }) {
  const visibleDevelopments = developments.filter((development) => development.status !== "entregado");

  return (
    <section className="relative h-screen w-screen overflow-hidden bg-[#070707] text-[#f8f5ef]">
      <div className="absolute inset-0 bg-[linear-gradient(120deg,#050505,#120d0a_52%,#050505)]" />
      <div className="absolute inset-y-0 right-0 w-[38vw] bg-[linear-gradient(115deg,rgba(8,28,38,.1),rgba(27,89,116,.72)_44%,rgba(8,28,38,.95))]" />

      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" role="img" aria-label="Mapa de desarrollos Barrera Brokers">
        <defs>
          <linearGradient id="mapLandOnly" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#24130f" />
            <stop offset="55%" stopColor="#7a523c" />
            <stop offset="100%" stopColor="#d8c4af" />
          </linearGradient>
          <linearGradient id="mapWaterOnly" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#123142" />
            <stop offset="100%" stopColor="#1c6b8a" />
          </linearGradient>
          <filter id="flagGlow"><feGaussianBlur stdDeviation="1.8" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>

        <g transform="translate(2 7) rotate(-14 50 50) skewX(-18) scale(1.12)">
          <path d="M 10 12 C 28 4, 51 13, 67 28 C 82 42, 86 65, 75 88 C 54 91, 31 85, 14 68 C 3 51, 1 27, 10 12 Z" fill="url(#mapLandOnly)" opacity="0.98" />
          <path d="M 70 9 C 94 23, 103 51, 86 95 L 103 105 L 103 0 Z" fill="url(#mapWaterOnly)" opacity="0.92" />
          <path d="M 76 75 C 66 65, 56 54, 47 45 C 37 35, 27 25, 17 15" fill="none" stroke="rgba(248,245,239,.28)" strokeWidth="0.8" strokeDasharray="2 1.5" />
          <path d="M 70 18 C 84 35, 86 59, 76 88" fill="none" stroke="rgba(248,245,239,.35)" strokeWidth="0.75" />

          {corridor.map((zone) => (
            <g key={zone.name} transform={`translate(${zone.x} ${zone.y})`} opacity="0.55">
              <circle r="1.25" fill="#f8f5ef" />
              <text x="3" y="0.8" fill="#f8f5ef" fontSize="2.6" fontWeight="700" paintOrder="stroke" stroke="#070707" strokeWidth="0.7">{zone.name}</text>
            </g>
          ))}

          {visibleDevelopments.map((development, index) => {
            const point = getPoint(development, index);
            return (
              <a key={development.id} href={`/desarrollos/${development.slug}`}>
                <g transform={`translate(${point.x} ${point.y - 6})`} className="cursor-pointer" filter="url(#flagGlow)">
                  <line x1="0" y1="0" x2="0" y2="6.2" stroke="#f8f5ef" strokeWidth="0.65" />
                  <path d="M 0 0 L 8 -2.6 L 8 2.5 L 0 3.6 Z" fill="#ff5c3b" stroke="#f8f5ef" strokeWidth="0.28" />
                  <circle cx="0" cy="6.2" r="1.35" fill="#f8f5ef" />
                  <text x="9.2" y="1" fill="#f8f5ef" fontSize="2.6" fontWeight="800" paintOrder="stroke" stroke="#070707" strokeWidth="0.85">{development.name}</text>
                </g>
              </a>
            );
          })}
        </g>
      </svg>

      {visibleDevelopments.length === 0 && (
        <div className="absolute left-1/2 top-1/2 z-30 w-[min(90vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-white/10 bg-black/45 p-8 text-center backdrop-blur-xl">
          <p className="mb-3 text-[10px] uppercase tracking-[0.24em] text-[#c9b8a0]">Sin desarrollos visibles</p>
          <h1 className="font-display text-5xl font-light tracking-[-0.05em]">No hay desarrollos cargados</h1>
          <p className="mt-4 text-white/60">Cuando cargues emprendimientos en la base de datos, aparecerán automáticamente como banderitas en este mapa.</p>
        </div>
      )}
    </section>
  );
}
