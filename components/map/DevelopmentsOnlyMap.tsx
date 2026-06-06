"use client";

import type { Development } from "@/types";

const corridor = [
  { name: "Puerto Madero", x: 74, y: 72 },
  { name: "San Telmo", x: 66, y: 77 },
  { name: "Centro", x: 61, y: 61 },
  { name: "Recoleta", x: 53, y: 47 },
  { name: "Palermo", x: 42, y: 35 },
  { name: "Belgrano", x: 29, y: 24 },
  { name: "Núñez", x: 18, y: 16 },
];

const greenMasses = [
  "M 3 10 C 13 1, 30 4, 40 12 C 50 20, 47 35, 34 39 C 21 44, 7 35, 2 23 C -1 18, -1 13, 3 10 Z",
  "M 45 4 C 60 -2, 78 6, 87 18 C 96 30, 91 45, 76 49 C 62 53, 48 44, 42 32 C 37 22, 37 10, 45 4 Z",
  "M 12 51 C 25 42, 45 45, 55 58 C 64 70, 58 86, 43 91 C 27 97, 9 90, 3 75 C -2 64, 2 56, 12 51 Z",
  "M 61 53 C 75 45, 94 50, 101 65 C 109 83, 93 98, 75 96 C 60 94, 51 82, 53 68 C 54 61, 56 56, 61 53 Z",
  "M 24 25 C 37 19, 54 23, 62 35 C 70 48, 58 61, 43 59 C 29 57, 19 47, 18 36 C 17 31, 19 27, 24 25 Z",
];

const roads = [
  "M 12 76 C 24 66, 34 56, 45 47 C 57 36, 68 27, 84 18",
  "M 8 58 C 22 53, 35 49, 49 42 C 61 36, 74 30, 94 28",
  "M 24 89 C 32 76, 39 63, 50 52 C 59 43, 68 37, 78 32",
  "M 38 12 C 42 28, 48 42, 58 55 C 69 70, 82 80, 98 87",
  "M 4 28 C 18 31, 32 33, 47 35 C 62 37, 77 42, 98 52",
  "M 17 15 C 31 24, 42 35, 53 47 C 62 58, 68 67, 74 72",
];

const textureDots = Array.from({ length: 220 }, (_, i) => ({
  x: (i * 37) % 100,
  y: (i * 61) % 100,
  r: 0.12 + ((i * 7) % 4) * 0.05,
  opacity: 0.07 + ((i * 11) % 8) * 0.018,
}));

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function getPoint(development: Development, index: number) {
  const text = normalize(`${development.name} ${development.location} ${development.address}`);
  const match = corridor.find((zone) => text.includes(normalize(zone.name)));
  const base = match ?? corridor[index % corridor.length];
  return { x: base.x + (index % 2) * 3 - 1.5, y: base.y + Math.floor(index / 2) * 2.5 };
}

export function DevelopmentsOnlyMap({ developments }: { developments: Development[] }) {
  const visibleDevelopments = developments.filter((development) => development.status !== "entregado");

  return (
    <section className="relative h-screen w-screen overflow-hidden bg-[#10200f] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(255,255,255,.45),transparent_15%),radial-gradient(circle_at_92%_16%,rgba(255,255,255,.38),transparent_18%),radial-gradient(circle_at_5%_78%,rgba(255,255,255,.2),transparent_19%),linear-gradient(135deg,#183019,#456337_45%,#10200f)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,transparent_20%,rgba(0,0,0,.36)_72%,rgba(0,0,0,.62))]" />

      <div className="pointer-events-none absolute left-1/2 top-5 z-30 -translate-x-1/2 text-center text-white drop-shadow-[0_3px_12px_rgba(0,0,0,.65)]">
        <div className="font-display text-3xl font-light tracking-[-0.04em] md:text-4xl">Barrera Brokers</div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.32em] text-white/75">Mapa de desarrollos</div>
      </div>

      <a href="/#contacto" className="absolute right-5 top-6 z-30 text-[11px] font-bold uppercase tracking-[0.28em] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,.6)] hover:text-white/75">
        Consultar
      </a>

      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" role="img" aria-label="Masterplan de desarrollos Barrera Brokers">
        <defs>
          <filter id="softMapBlur"><feGaussianBlur stdDeviation="0.18" /></filter>
          <filter id="pinShadow"><feDropShadow dx="0" dy="1.1" stdDeviation="1" floodColor="#000000" floodOpacity="0.55" /></filter>
          <linearGradient id="pathLight" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#e9e3c7" stopOpacity=".72" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity=".28" />
          </linearGradient>
        </defs>

        <rect width="100" height="100" fill="#31552e" />

        {textureDots.map((dot, index) => (
          <circle key={index} cx={dot.x} cy={dot.y} r={dot.r} fill="#d9f0a3" opacity={dot.opacity} />
        ))}

        {greenMasses.map((d, index) => (
          <path key={d} d={d} fill={index % 2 === 0 ? "#5f823d" : "#395c34"} opacity="0.72" filter="url(#softMapBlur)" />
        ))}

        <path d="M 70 -5 C 65 12, 68 24, 80 33 C 91 41, 98 52, 93 68 C 89 80, 93 91, 108 104 L 108 -5 Z" fill="#12394a" opacity="0.82" />
        <path d="M 73 5 C 70 21, 74 31, 84 38 C 95 46, 97 61, 91 73" fill="none" stroke="#6fb0bc" strokeWidth="0.9" opacity="0.35" />

        <path d="M 9 20 C 20 16, 34 18, 42 26 C 49 34, 57 34, 64 27 C 72 20, 82 20, 94 25" fill="none" stroke="#133a38" strokeWidth="1.9" opacity="0.8" />
        <path d="M 2 73 C 15 66, 26 64, 37 68 C 49 72, 58 68, 64 58 C 71 47, 82 43, 99 45" fill="none" stroke="#133a38" strokeWidth="1.8" opacity="0.78" />

        {roads.map((d) => (
          <path key={d} d={d} fill="none" stroke="url(#pathLight)" strokeWidth="0.54" strokeLinecap="round" strokeDasharray="0.1 0" opacity="0.78" />
        ))}

        {visibleDevelopments.map((development, index) => {
          const point = getPoint(development, index);
          return (
            <a key={development.id} href={`/desarrollos/${development.slug}`}>
              <g transform={`translate(${point.x} ${point.y})`} className="cursor-pointer" filter="url(#pinShadow)">
                <circle r="1.3" fill="#ffffff" opacity="0.96" />
                <circle r="0.46" fill="#0f1710" opacity="0.82" />
                <text x="2.25" y="0.85" fill="#ffffff" fontSize="2.55" fontWeight="800" paintOrder="stroke" stroke="#172013" strokeWidth="0.8">{development.name}</text>
              </g>
            </a>
          );
        })}
      </svg>

      {visibleDevelopments.length === 0 && (
        <div className="absolute left-1/2 top-1/2 z-30 w-[min(90vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-white/15 bg-black/35 p-8 text-center backdrop-blur-xl">
          <p className="mb-3 text-[10px] uppercase tracking-[0.24em] text-white/65">Sin desarrollos visibles</p>
          <h1 className="font-display text-5xl font-light tracking-[-0.05em]">No hay desarrollos cargados</h1>
          <p className="mt-4 text-white/65">Cuando cargues emprendimientos en la base de datos, aparecerán automáticamente como puntos en este mapa.</p>
        </div>
      )}
    </section>
  );
}
