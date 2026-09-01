"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Check,
  MapPin,
  Minus,
  Plus,
  RotateCcw,
  Target,
} from "lucide-react";
import { DEVELOPMENT_STATUS_LABELS, DevelopmentStatus } from "@/types";
import { formatPrice } from "@/lib/utils";
import { DevelopmentCoverMedia } from "@/components/development/development-cover-media";

export interface CityDevelopment {
  id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  location: string;
  address: string;
  status: DevelopmentStatus;
  progress: number;
  completionDate?: string;
  priceFrom?: number;
  minPriceAvailable?: number;
  availableUnits?: number;
  unitsCount?: number;
  amenities: string[];
  features: string[];
  image?: string;
  video?: string;
}

const ZONE_ORDER = [
  "Puerto Madero",
  "Recoleta",
  "Palermo",
  "Belgrano",
  "Nuñez",
];

function normalizeZone(location: string) {
  const lower = location.toLowerCase();
  if (lower.includes("puerto")) return "Puerto Madero";
  if (lower.includes("recoleta")) return "Recoleta";
  if (lower.includes("palermo")) return "Palermo";
  if (lower.includes("belgrano")) return "Belgrano";
  if (lower.includes("nunez") || lower.includes("nuñez")) return "Nuñez";
  return location.split(",")[0].trim() || "Buenos Aires";
}

function getZoneIndex(zone: string) {
  const idx = ZONE_ORDER.findIndex((item) => item.toLowerCase() === zone.toLowerCase());
  return idx >= 0 ? idx : ZONE_ORDER.length;
}

const ZONE_POSITIONS: Record<string, { x: number; y: number }> = {
  "Puerto Madero": { x: 78, y: 49 },
  Recoleta: { x: 66, y: 40 },
  Palermo: { x: 50, y: 34 },
  Belgrano: { x: 30, y: 22 },
  Nuñez: { x: 28, y: 13 },
};

function getMapZone(dev: CityDevelopment) {
  const name = dev.name.toLowerCase();
  if (name.includes("alpha place libertador") || name.includes("alpha place belgrano")) {
    return "Belgrano";
  }

  return normalizeZone(dev.location);
}

function getPinPosition(dev: CityDevelopment, idx: number) {
  const name = dev.name.toLowerCase();

  if (name.includes("feel recoleta")) {
    return { x: 67, y: 36 };
  }

  if (name.includes("we surf")) {
    return { x: 67, y: 50 };
  }

  if (name.includes("feel palermo")) {
    return { x: 48, y: 24 };
  }

  if (name.includes("alpha place libertador")) {
    return { x: 24, y: 17 };
  }

  if (name.includes("alpha place belgrano")) {
    return { x: 24, y: 28 };
  }

  if (name.includes("aguilar point belgrano")) {
    return { x: 24, y: 39 };
  }

  if (name.includes("9 de julio")) {
    return { x: 68, y: 72 };
  }

  const zoneName = getMapZone(dev);
  const base = ZONE_POSITIONS[zoneName] || { x: 48, y: 54 };
  const offsets = [
    { x: 0, y: 0 },
    { x: 6, y: -3 },
    { x: -6, y: 3 },
    { x: 5, y: 6 },
    { x: -5, y: -6 },
  ];
  const offset = offsets[idx % offsets.length];

  return {
    x: Math.min(84, Math.max(12, base.x + offset.x)),
    y: Math.min(86, Math.max(10, base.y + offset.y)),
  };
}

function shouldPlaceLabelToLeft(dev: CityDevelopment, idx: number) {
  const name = dev.name.toLowerCase();

  if (name.includes("alpha place libertador")) return false;
  if (name.includes("alpha place belgrano")) return false;
  if (name.includes("aguilar point belgrano")) return false;
  if (name.includes("feel palermo")) return false;
  if (name.includes("feel recoleta")) return true;
  if (name.includes("we surf")) return true;
  if (name.includes("9 de julio")) return true;
  if (name.includes("puerto")) return true;

  return idx % 2 === 1;
}

export function BuenosAiresDevelopments({
  developments,
  embedded = false,
}: {
  developments: CityDevelopment[];
  embedded?: boolean;
}) {
  const [activeId, setActiveId] = useState(developments[0]?.id || "");
  const [zoom, setZoom] = useState(1);

  const sortedDevelopments = useMemo(() => {
    return [...developments].sort(
      (a, b) => getZoneIndex(normalizeZone(a.location)) - getZoneIndex(normalizeZone(b.location))
    );
  }, [developments]);

  const activeDevelopment =
    sortedDevelopments.find((dev) => dev.id === activeId) || sortedDevelopments[0] || developments[0];
  const activeIndex = activeDevelopment
    ? Math.max(
        0,
        sortedDevelopments.findIndex((dev) => dev.id === activeDevelopment.id)
      )
    : 0;
  const activePinPosition = activeDevelopment
    ? getPinPosition(activeDevelopment, activeIndex)
    : { x: 56, y: 40 };

  if (!developments.length) {
    return (
      <section className="bg-[#F1EADE] px-5 py-24 text-center text-[#151415]">
        <p className="font-display text-4xl">Pronto vamos a publicar desarrollos en la ciudad.</p>
      </section>
    );
  }

  return (
    <section id={embedded ? "mapa" : undefined} className={`bg-[#F1EADE] text-[#151415] ${embedded ? "scroll-mt-20" : "pt-[86px]"}`}>
      <div className="relative min-h-[calc(100svh-86px)] overflow-hidden border-y border-[#151415]/10 bg-[#E1D0B8]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(248,245,239,0.95),transparent_28%),radial-gradient(circle_at_82%_6%,rgba(107,151,158,0.22),transparent_30%)]" />

        <div className="relative min-h-[calc(100svh-86px)] lg:grid lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="relative min-h-[72svh] overflow-hidden lg:min-h-[calc(100svh-86px)]">
            <div
              className="absolute inset-0 transition-transform duration-500 ease-out"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: `${activePinPosition.x}% ${activePinPosition.y}%`,
              }}
            >
              <Image
                src="/mapa-bsas.png"
                alt="Mapa de Buenos Aires con barrios, avenidas y Río de la Plata"
                fill
                className="object-cover object-center"
                sizes="(max-width: 1024px) 100vw, calc(100vw - 380px)"
                priority
              />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_58%_42%,transparent_0%,rgba(248,245,239,0.05)_48%,rgba(21,20,21,0.08)_100%)]" />

              <div className="absolute inset-0 z-30">
                {sortedDevelopments.map((dev, idx) => {
                  const selected = activeDevelopment?.id === dev.id;
                  const priceFrom = dev.minPriceAvailable ?? dev.priceFrom;
                  const position = getPinPosition(dev, idx);
                  const labelToLeft = shouldPlaceLabelToLeft(dev, idx);

                  return (
                    <button
                      key={dev.id}
                      type="button"
                      onClick={() => setActiveId(dev.id)}
                      className={`group absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 transition-transform duration-200 hover:z-40 hover:scale-[1.03] active:scale-[0.98] ${
                        labelToLeft ? "flex-row-reverse" : ""
                      }`}
                      style={{
                        left: `${position.x}%`,
                        top: `${position.y}%`,
                        zIndex: selected ? 45 : 30 + idx,
                      }}
                      aria-label={`Ver ficha de ${dev.name}`}
                    >
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-full border shadow-[0_10px_26px_rgba(21,20,21,0.22)]"
                        style={{
                          background: selected ? "#151415" : "#F8F5EF",
                          borderColor: selected ? "#D8C4AF" : "rgba(21,20,21,0.22)",
                          color: selected ? "#D8C4AF" : "#151415",
                        }}
                      >
                        <MapPin className="h-5 w-5" />
                      </div>

                      <div
                        className="hidden min-w-[170px] rounded-2xl border px-3 py-2 text-left shadow-[0_12px_34px_rgba(21,20,21,0.18)] backdrop-blur-sm transition-opacity duration-200 sm:block"
                        style={{
                          background: selected ? "rgba(21,20,21,0.92)" : "rgba(248,245,239,0.9)",
                          borderColor: selected ? "rgba(216,196,175,0.4)" : "rgba(21,20,21,0.14)",
                        }}
                      >
                        <p
                          className="text-[9px] uppercase tracking-[0.18em]"
                          style={{ color: selected ? "rgba(248,245,239,0.58)" : "rgba(21,20,21,0.46)" }}
                        >
                          {normalizeZone(dev.location)}
                        </p>
                        <p
                          className="mt-1 font-display text-lg leading-[0.95]"
                          style={{ color: selected ? "#F8F5EF" : "#151415" }}
                        >
                          {dev.name}
                        </p>
                        {priceFrom ? (
                          <p
                            className="mt-1 text-[10px] uppercase tracking-[0.14em]"
                            style={{ color: selected ? "#D8C4AF" : "#3A1D17" }}
                          >
                            {formatPrice(priceFrom)}
                          </p>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="absolute left-4 top-4 z-40 rounded-full border border-[#151415]/14 bg-[#F8F5EF]/88 px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-[#151415]/62 shadow-sm backdrop-blur-md lg:left-6 lg:top-6">
              Puerto Madero a Nuñez
            </div>

            <div className="absolute right-4 top-4 z-40 overflow-hidden rounded-full border border-[#151415]/14 bg-[#F8F5EF]/90 shadow-[0_12px_34px_rgba(58,29,23,0.12)] backdrop-blur-md lg:right-6 lg:top-6">
              <button
                type="button"
                onClick={() => setZoom((value) => Math.min(2, Number((value + 0.18).toFixed(2))))}
                className="flex h-11 w-11 items-center justify-center border-b border-[#151415]/10 text-[#151415] transition-colors hover:bg-white/60"
                aria-label="Acercar mapa"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoom((value) => Math.max(1, Number((value - 0.18).toFixed(2))))}
                className="flex h-11 w-11 items-center justify-center border-b border-[#151415]/10 text-[#151415] transition-colors hover:bg-white/60"
                aria-label="Alejar mapa"
              >
                <Minus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoom(1.65)}
                className="flex h-11 w-11 items-center justify-center border-b border-[#151415]/10 text-[#151415] transition-colors hover:bg-white/60"
                aria-label="Acercar proyecto seleccionado"
              >
                <Target className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoom(1)}
                className="flex h-11 w-11 items-center justify-center text-[#151415] transition-colors hover:bg-white/60"
                aria-label="Restaurar mapa"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>

            <div className="absolute bottom-4 left-4 right-4 z-40 rounded-[24px] border border-[#151415]/12 bg-[#F8F5EF]/86 p-4 shadow-[0_12px_34px_rgba(58,29,23,0.14)] backdrop-blur-md md:left-6 md:right-auto md:max-w-sm">
              <p className="text-[10px] uppercase tracking-[0.22em] text-[#151415]/48">
                Mapa
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[#151415]/68">
                Tocá un pin para abrir la ficha del desarrollo sin salir de la ciudad.
              </p>
            </div>
          </div>

          <aside className="z-40 border-t border-[#151415]/10 bg-[#F8F5EF]/95 p-4 shadow-[0_-16px_50px_rgba(58,29,23,0.1)] backdrop-blur-xl lg:h-[calc(100svh-86px)] lg:overflow-hidden lg:border-l lg:border-t-0 lg:p-4">
            {activeDevelopment ? (
              <DevelopmentFicha development={activeDevelopment} />
            ) : null}
          </aside>
        </div>
      </div>

    </section>
  );
}

function DevelopmentFicha({ development }: { development: CityDevelopment }) {
  const priceFrom = development.minPriceAvailable ?? development.priceFrom;

  return (
    <article className="flex max-h-[calc(100svh-118px)] flex-col overflow-hidden rounded-[28px] border border-[#151415]/16 bg-[#151415] text-[#F8F5EF] shadow-[0_24px_80px_rgba(21,20,21,0.26)] lg:h-full lg:max-h-none">
        <div className="relative aspect-[16/8] shrink-0 overflow-hidden bg-[#2B211D]">
          {(development.image || development.video) && (
            <DevelopmentCoverMedia
              name={development.name}
              image={development.image}
              video={development.video}
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 40vw"
              priority
            />
          )}
          <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.72)_0%,rgba(0,0,0,0.24)_42%,transparent_68%)]" />
          <div className="absolute left-5 top-5 rounded-full bg-[#F8F5EF] px-4 py-2 text-[10px] font-medium uppercase tracking-[0.18em] text-[#151415]">
            {DEVELOPMENT_STATUS_LABELS[development.status]}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6 md:p-6">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[#D8C4AF]">
            <MapPin className="h-4 w-4" />
            {development.address} · {development.location}
          </div>
          <h2 className="mt-4 font-display text-4xl font-light leading-[0.95] tracking-[-0.035em] md:text-[42px]">
            {development.name}
          </h2>
          <p className="mt-5 text-sm leading-relaxed text-[#F8F5EF]/68">
            {development.shortDescription || development.description}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden bg-[#F8F5EF]/12">
            <FichaStat label="Desde" value={priceFrom ? formatPrice(priceFrom) : "Consultar"} />
            <FichaStat label="Entrega" value={development.completionDate || "A confirmar"} />
            <FichaStat label="Avance" value={`${development.progress}%`} />
            <FichaStat
              label="Unidades"
              value={
                development.availableUnits !== undefined
                  ? `${development.availableUnits} disp.`
                  : `${development.unitsCount || 0}`
              }
            />
          </div>

          <div className="mt-6 space-y-3">
            {[...development.amenities, ...development.features].slice(0, 5).map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm text-[#F8F5EF]/72">
                <Check className="h-4 w-4 text-[#D8C4AF]" />
                {item}
              </div>
            ))}
          </div>

        </div>

        <div className="relative z-10 flex shrink-0 border-t border-[#F8F5EF]/12 bg-[#151415] p-4">
          <Link
            href={`/desarrollos/${development.slug}`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#F8F5EF] px-5 py-3 text-[10px] font-medium uppercase tracking-[0.18em] text-[#151415] transition-colors duration-200 hover:bg-white active:scale-[0.98]"
          >
            Ver detalle
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </article>
  );
}

function FichaStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#151415] p-3">
      <p className="text-[9px] uppercase tracking-[0.18em] text-[#F8F5EF]/38">{label}</p>
      <p className="mt-1 font-display text-xl font-light text-[#F8F5EF]">{value}</p>
    </div>
  );
}
