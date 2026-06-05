"use client";

import { useMemo, useState } from "react";
import { mapNeighborhoods, type MapNeighborhood } from "@/lib/map-neighborhoods";
import { NeighborhoodPanel } from "@/components/map/NeighborhoodPanel";

const avenues = [
  "M 76 76 C 67 67, 58 56, 49 47 C 39 37, 29 27, 17 15",
  "M 70 78 C 62 66, 56 57, 48 49 C 39 41, 31 33, 22 21",
  "M 63 83 C 58 72, 55 63, 51 53 C 47 44, 43 36, 38 27",
  "M 82 62 C 73 58, 63 55, 52 51 C 42 47, 34 42, 27 35",
];

const parks = [
  { x: 33, y: 25, w: 13, h: 8, r: -16 },
  { x: 42, y: 39, w: 16, h: 9, r: -13 },
  { x: 24, y: 15, w: 10, h: 6, r: -15 },
  { x: 58, y: 45, w: 9, h: 5, r: -10 },
];

const buildings = Array.from({ length: 92 }, (_, index) => {
  const col = index % 14;
  const row = Math.floor(index / 14);
  const x = 18 + col * 4.1 + (row % 2) * 1.4;
  const y = 18 + row * 7.1;
  const h = 2.4 + ((index * 7) % 9) * 0.55;
  const tall = index % 13 === 0 || index % 17 === 0;
  return { x, y, w: 1.8 + (index % 3) * 0.35, d: 1.6 + (index % 4) * 0.25, h: tall ? h + 5.5 : h };
});

function Building({ x, y, w, d, h }: { x: number; y: number; w: number; d: number; h: number }) {
  return (
    <g transform={`translate(${x} ${y})`} opacity="0.92">
      <polygon points={`0,0 ${w},-${d} ${w},${-d - h} 0,${-h}`} fill="#d8c4af" opacity="0.78" />
      <polygon points={`${w},-${d} ${w + 1.05},-${d - 0.55} ${w + 1.05},${-d - h + 0.55} ${w},${-d - h}`} fill="#8b6f5b" opacity="0.9" />
      <polygon points={`0,${-h} ${w},${-d - h} ${w + 1.05},${-d - h + 0.55} 1.05,${-h + 0.55}`} fill="#f8f5ef" opacity="0.5" />
    </g>
  );
}

export function BuenosAiresMap() {
  const [selected, setSelected] = useState<MapNeighborhood | null>(mapNeighborhoods[4]);
  const [hovered, setHovered] = useState<string | null>(null);
  const active = useMemo(() => selected ?? mapNeighborhoods[4], [selected]);

  return (
    <section className="relative h-screen w-screen overflow-hidden bg-[#070707] text-[#f8f5ef]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_15%,rgba(184,157,135,.28),transparent_28%),radial-gradient(circle_at_82%_58%,rgba(255,107,74,.15),transparent_32%),linear-gradient(120deg,#050505,#110d0a_48%,#050505)]" />
      <div className="absolute inset-y-0 right-0 w-[37vw] bg-[linear-gradient(115deg,rgba(19,64,83,.12),rgba(27,89,116,.75)_42%,rgba(8,28,38,.92))]" />

      <div className="absolute inset-0 z-10 flex items-center justify-center pt-16 md:pt-0">
        <svg viewBox="0 0 100 100" className="h-[120vh] w-[150vw] min-w-[1200px] md:h-[112vh] md:w-[118vw]" role="img" aria-label="Plano 3D estilizado del corredor Puerto Madero a Núñez">
          <defs>
            <linearGradient id="land" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#2a1711" />
              <stop offset="58%" stopColor="#7a523c" />
              <stop offset="100%" stopColor="#d8c4af" />
            </linearGradient>
            <linearGradient id="water" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#123142" />
              <stop offset="100%" stopColor="#1c6b8a" />
            </linearGradient>
            <filter id="softGlow"><feGaussianBlur stdDeviation="1.8" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          </defs>

          <g transform="translate(1 8) rotate(-14 50 50) skewX(-18) scale(1.08)">
            <path d="M 10 12 C 28 4, 51 13, 67 28 C 82 42, 86 65, 75 88 C 54 91, 31 85, 14 68 C 3 51, 1 27, 10 12 Z" fill="url(#land)" opacity="0.95" />
            <path d="M 70 9 C 94 23, 103 51, 86 95 L 103 105 L 103 0 Z" fill="url(#water)" opacity="0.9" />
            <path d="M 72 18 C 84 35, 86 59, 76 88" fill="none" stroke="rgba(248,245,239,.35)" strokeWidth="0.7" />

            {parks.map((park) => (
              <rect key={`${park.x}-${park.y}`} x={park.x} y={park.y} width={park.w} height={park.h} rx="1.2" fill="#314f31" opacity="0.78" transform={`rotate(${park.r} ${park.x} ${park.y})`} />
            ))}

            {avenues.map((d) => (
              <path key={d} d={d} fill="none" stroke="rgba(248,245,239,.34)" strokeWidth="0.55" strokeDasharray="1.7 1.3" />
            ))}

            <g opacity="0.78">
              {buildings.map((b, index) => (
                <Building key={index} {...b} />
              ))}
            </g>

            {mapNeighborhoods.map((item) => {
              const isActive = active.id === item.id;
              const isHovered = hovered === item.id;
              return (
                <g key={item.id} transform={`translate(${item.x} ${item.y})`} className="cursor-pointer" onMouseEnter={() => setHovered(item.id)} onMouseLeave={() => setHovered(null)} onClick={() => setSelected(item)}>
                  <circle r={isActive ? 4.8 : 3.3} fill={item.accent} opacity="0.22" filter="url(#softGlow)" />
                  <circle r={isActive ? 2.3 : 1.6} fill={item.accent} stroke="#f8f5ef" strokeWidth="0.32" />
                  <text x="3.7" y="-3" fill="#f8f5ef" fontSize="2.8" fontWeight="700" paintOrder="stroke" stroke="#070707" strokeWidth="0.8">{item.name}</text>
                  {(isActive || isHovered) && <circle r="6.6" fill="none" stroke={item.accent} strokeWidth="0.35" opacity="0.8" />}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {selected && <NeighborhoodPanel neighborhood={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}
