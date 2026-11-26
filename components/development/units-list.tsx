"use client";
import { UnitSheet } from "./unit-sheet";
import { ViewportVideo } from "@/components/viewport-video";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Bed,
  Car,
  Bath,
  Maximize2,
  Compass,
  ChevronRight,
} from "lucide-react";
import { isAccessoryUnit, accessoryUnitLabel } from "@/lib/unit-kind";
import { Unit } from "@/types";
import { formatPrice } from "@/lib/utils";
import { hasAgentOnlyPrices } from "@/lib/development-price-visibility";
import { buildMailto } from "@/lib/mail-share";

interface Props {
  units: Unit[];
  developmentFeatures?: string[];
  developmentName?: string;
  developmentLocation?: string;
  developmentSlug?: string;
  shareToken?: string;
  canSeePrices?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  disponible: "bg-emerald-500/12 border-emerald-500/45 text-emerald-700",
  reservada: "bg-amber-500/14 border-amber-500/45 text-amber-800",
  vendida: "bg-ink/7 border-ink/18 text-ink/50",
};

const STATUS_LABEL: Record<string, string> = {
  disponible: "Disponible",
  reservada: "Reservada",
  vendida: "Vendida",
};

function bedroomsLabel(n: number) {
  if (n === 0) return "Monoambiente";
  return `${n} ambiente${n > 1 ? "s" : ""}`;
}

function hasPaymentPlan(unit: Unit) {
  return !!(unit.downPayment || unit.installmentCount || unit.installmentValue);
}

function safeNumber(value: number | undefined, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function safeFeatures(features: string[] | undefined) {
  return Array.isArray(features)
    ? features.filter((feature) => typeof feature === "string" && feature.trim().length > 0)
    : [];
}

function normalizeUnit(unit: Unit): Unit {
  return {
    ...unit,
    unitNumber: unit.unitNumber || "Unidad",
    bedrooms: safeNumber(unit.bedrooms),
    bathrooms: safeNumber(unit.bathrooms),
    area: safeNumber(unit.area),
    price: safeNumber(unit.price),
    features: safeFeatures(unit.features),
    images: Array.isArray(unit.images)
      ? unit.images.filter((image) => typeof image?.url === "string" && image.url.trim().length > 0)
      : [],
  };
}

function withClientShareParam(path: string, token?: string) {
  if (!token) return path;
  const hashIndex = path.indexOf("#");
  const base = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : "";
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}share=${encodeURIComponent(token)}${hash}`;
}

export function UnitsList({
  units,
  developmentFeatures = [],
  developmentName = "el desarrollo",
  developmentLocation,
  developmentSlug,
  canSeePrices = true,
  shareToken,
}: Props) {
  const [filter, setFilter] = useState<string>("todos");
  const [activeUnit, setActiveUnit] = useState<Unit | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [shareComments, setShareComments] = useState("");


  const safeUnits = useMemo(() => units.map(normalizeUnit), [units]);
  const safeDevelopmentFeatures = useMemo(
    () => safeFeatures(developmentFeatures),
    [developmentFeatures]
  );

  const bedroomsAvailable = useMemo(() => {
    const set = new Set(safeUnits.filter((u) => !isAccessoryUnit(u)).map((u) => u.bedrooms));
    return Array.from(set).sort();
  }, [safeUnits]);

  const filteredUnits = useMemo(() => {
    if (filter === "todos") return safeUnits;
    if (filter === "cocheras") return safeUnits.filter(isAccessoryUnit);
    return safeUnits.filter((u) => !isAccessoryUnit(u) && u.bedrooms === parseInt(filter));
  }, [safeUnits, filter]);

  const activeFeatures =
    activeUnit && activeUnit.features.length > 0
      ? activeUnit.features
      : safeDevelopmentFeatures;

  const openUnit = useCallback((unit: Unit) => {
    setActiveImageIndex(0);
    setShareComments("");
    setActiveUnit(unit);
  }, []);

  useEffect(() => {
    const openFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const hashUnitId = window.location.hash.startsWith("#unidad-")
        ? window.location.hash.replace("#unidad-", "")
        : "";
      const unitId = params.get("unidad") || hashUnitId;
      if (!unitId) return;
      const unit = safeUnits.find((candidate) => candidate.id === unitId);
      if (!unit) return;

      if (hashUnitId && !params.get("unidad")) {
        params.set("unidad", hashUnitId);
        const query = params.toString();
        window.history.replaceState(
          null,
          "",
          `${window.location.pathname}${query ? `?${query}` : ""}`
        );
      }

      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      window.requestAnimationFrame(() => openUnit(unit));
    };

    openFromUrl();
    window.addEventListener("hashchange", openFromUrl);
    window.addEventListener("popstate", openFromUrl);
    return () => {
      window.removeEventListener("hashchange", openFromUrl);
      window.removeEventListener("popstate", openFromUrl);
    };
  }, [openUnit, safeUnits]);

  const closeUnit = () => {
    setActiveUnit(null);
    setActiveImageIndex(0);
    setShareComments("");
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.has("unidad")) {
        params.delete("unidad");
        const query = params.toString();
        window.history.replaceState(
          null,
          "",
          `${window.location.pathname}${query ? `?${query}` : ""}`
        );
      }
    }
  };

  const getUnitPdfPath = (unit: Unit) => {
    const comments = shareComments.trim();
    const query = comments ? `?comments=${encodeURIComponent(comments)}` : "";
    return withClientShareParam(`/api/units/${unit.id}/ficha${query}`, shareToken);
  };

  const getUnitPdfUrl = (unit: Unit) => {
    const path = getUnitPdfPath(unit);
    if (typeof window === "undefined") return path;
    return `${window.location.origin}${path}`;
  };

  const getUnitOnlineUrl = (unit: Unit) => {
    if (!developmentSlug || typeof window === "undefined") return null;
    const path = withClientShareParam(
      `/desarrollos/${developmentSlug}?unidad=${encodeURIComponent(unit.id)}`,
      shareToken
    );
    return `${window.location.origin}${path}`;
  };

  const getUnitShareText = (unit: Unit, pdfUrl?: string) => {
    const comments = shareComments.trim();
    const onlineUrl = getUnitOnlineUrl(unit);
    const lines = [
      `Ficha de unidad - ${developmentName}`,
      `Unidad: ${unit.unitNumber}`,
      `Tipología: ${isAccessoryUnit(unit) ? accessoryUnitLabel(unit) : bedroomsLabel(unit.bedrooms)}`,
      !isAccessoryUnit(unit) && unit.bathrooms > 0 ? `Baños: ${unit.bathrooms}` : null,
      unit.area > 0 ? `Superficie cubierta: ${unit.area}m²` : null,
      unit.totalArea ? `Superficie total: ${unit.totalArea}m²` : null,
      unit.floor ? `Piso: ${unit.floor}` : null,
      unit.orientation ? `Orientación: ${unit.orientation}` : null,
      developmentLocation ? `Ubicación: ${developmentLocation}` : null,
      unit.downPayment ? `Anticipo: ${formatPrice(unit.downPayment)}` : null,
      unit.installmentCount && unit.installmentValue
        ? `${unit.installmentCount} cuotas de ${formatPrice(unit.installmentValue)}`
        : null,
      !hasAgentOnlyPrices(developmentSlug) ? `Precio final: ${formatPrice(unit.price)}` : null,
      comments ? `Comentarios: ${comments}` : null,
      pdfUrl ? `Link ficha PDF: ${pdfUrl}` : null,
      onlineUrl ? `Ver online: ${onlineUrl}` : null,
    ];

    return lines.filter(Boolean).join("\n");
  };

  const getWhatsAppShareHref = (unit: Unit) => {
    const pdfUrl = getUnitPdfUrl(unit);
    return `https://wa.me/?text=${encodeURIComponent(getUnitShareText(unit, pdfUrl))}`;
  };

  const getMailShareContent = (unit: Unit) => {
    const pdfUrl = getUnitPdfUrl(unit);
    const subject = `Ficha unidad ${unit.unitNumber} - ${developmentName}`;
    return {
      subject,
      body: getUnitShareText(unit, pdfUrl),
    };
  };

  if (safeUnits.length === 0) {
    return (
      <div className="border-t border-bone/15 pt-12 text-center">
        <p className="text-bone/60 text-base">
          Pronto vamos a publicar las unidades disponibles.
        </p>
      </div>
    );
  }


  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-8">
        <button
          onClick={() => setFilter("todos")}
          className={`px-4 py-2 rounded-full text-xs uppercase tracking-widest border transition-colors ${
            filter === "todos"
              ? "bg-accent text-ink border-accent"
              : "bg-transparent text-bone/70 border-bone/20 hover:border-accent"
          }`}
        >
          Todas ({safeUnits.length})
        </button>
        {safeUnits.some(isAccessoryUnit) && (
          <button onClick={() => setFilter("cocheras")}
            className={`px-4 py-2 rounded-full text-xs uppercase tracking-widest border transition-colors ${filter === "cocheras" ? "bg-accent text-ink border-accent" : "bg-transparent text-bone/70 border-bone/20 hover:border-accent"}`}>
            Complementarias ({safeUnits.filter(isAccessoryUnit).length})
          </button>
        )}
        {bedroomsAvailable.map((b) => {
          const count = safeUnits.filter((u) => !isAccessoryUnit(u) && u.bedrooms === b).length;
          return (
            <button
              key={b}
              onClick={() => setFilter(b.toString())}
              className={`px-4 py-2 rounded-full text-xs uppercase tracking-widest border transition-colors ${
                filter === b.toString()
                  ? "bg-accent text-ink border-accent"
                  : "bg-transparent text-bone/70 border-bone/20 hover:border-accent"
              }`}
            >
              {bedroomsLabel(b)} ({count})
            </button>
          );
        })}
      </div>

      {/* Units grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUnits.map((unit) => {
          const planImg =
            unit.images[0]?.url;
          const isAvailable = unit.status === "disponible";
          return (
            <button
              key={unit.id}
              onClick={() => openUnit(unit)}
              className="group text-left overflow-hidden rounded-xl border border-[#d8c4af]/70 bg-[#f4ebdd] text-ink shadow-[0_18px_60px_rgba(0,0,0,0.22)] transition-all hover:-translate-y-1 hover:border-accent/80"
            >
              <div className="relative aspect-[4/3] bg-[#e7d8c8]">
                {unit.videoUrl ? (
                  <ViewportVideo
                    src={unit.videoUrl}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    muted
                    playsInline
                    preload="metadata"
                  />
                ) : planImg ? (
                  <Image
                    src={planImg}
                    alt={unit.unitNumber}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-ink/30">
                    <Maximize2 className="h-10 w-10" />
                  </div>
                )}
                <div className="absolute top-3 left-3">
                  <span
                    className={`inline-block px-2.5 py-1 rounded-full text-[10px] uppercase tracking-widest font-medium border ${
                      STATUS_COLORS[unit.status] || STATUS_COLORS.vendida
                    }`}
                  >
                    {STATUS_LABEL[unit.status] || unit.status}
                  </span>
                </div>
              </div>
              <div className="p-5">
                <div className="flex items-baseline justify-between mb-3">
                  <h3 className="font-display font-light text-2xl text-ink">
                    {unit.unitNumber}
                  </h3>
                  {unit.floor && (
                    <span className="text-[10px] uppercase tracking-widest text-ink/45">
                      Piso {unit.floor}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-3 text-ink/68 text-xs mb-4">
                  <span className="flex items-center gap-1">
                    {isAccessoryUnit(unit) ? <Car className="h-3 w-3 text-accent" /> : <Bed className="h-3 w-3 text-accent" />}
                    {isAccessoryUnit(unit) ? accessoryUnitLabel(unit) : bedroomsLabel(unit.bedrooms)}
                  </span>
                  {!isAccessoryUnit(unit) && unit.bathrooms > 0 && <span className="flex items-center gap-1">
                    <Bath className="h-3 w-3 text-accent" />
                    {unit.bathrooms} baño{unit.bathrooms > 1 ? "s" : ""}
                  </span>}
                  {unit.area > 0 && <span className="flex items-center gap-1">
                    <Maximize2 className="h-3 w-3 text-accent" />
                    {unit.area}m²
                  </span>}
                  {unit.orientation && (
                    <span className="flex items-center gap-1">
                      <Compass className="h-3 w-3 text-accent" />
                      {unit.orientation}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-ink/12">
                  <div>
                    {isAvailable && hasPaymentPlan(unit) ? (
                      <div className="space-y-1">
                        {unit.downPayment && (
                          <p className="text-[10px] uppercase tracking-widest text-ink/48">
                            Anticipo {formatPrice(unit.downPayment)}
                          </p>
                        )}
                        {unit.installmentCount && unit.installmentValue && (
                          <p className="font-display text-lg text-accent">
                            {unit.installmentCount} cuotas de{" "}
                            {formatPrice(unit.installmentValue)}
                          </p>
                        )}
                        {canSeePrices && <p className="text-xs text-ink/58">
                          Precio final {formatPrice(unit.price)}
                        </p>}
                      </div>
                    ) : (
                      <span className="font-display text-xl text-accent">
                        {isAvailable ? canSeePrices ? formatPrice(unit.price) : "Consultar financiación" : "—"}
                      </span>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-ink/38 group-hover:text-accent transition-colors" />
                </div>
              </div>
            </button>
          );
        })}
      </div>


      {activeUnit && (
        <UnitSheet key={activeUnit.id} unit={activeUnit} developmentName={developmentName}
          developmentLocation={developmentLocation} canSeePrices={canSeePrices}
          features={activeFeatures || []} imageIndex={activeImageIndex}
          onImageChange={setActiveImageIndex} comments={shareComments} onCommentsChange={setShareComments}
          pdfHref={getUnitPdfPath(activeUnit)} whatsAppHref={getWhatsAppShareHref(activeUnit)}
          mailHref={buildMailto(getMailShareContent(activeUnit).subject, getMailShareContent(activeUnit).body)} onClose={closeUnit} />
      )}
    </>
  );
}
