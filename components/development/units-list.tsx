"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  X,
  Bed,
  Bath,
  Maximize2,
  Compass,
  ChevronRight,
  FileText,
  Mail,
  MessageCircle,
} from "lucide-react";
import { Unit } from "@/types";
import { formatPrice } from "@/lib/utils";
import { openMailShare } from "@/lib/mail-share";

interface Props {
  units: Unit[];
  developmentFeatures?: string[];
  developmentName?: string;
  developmentLocation?: string;
  developmentSlug?: string;
  shareToken?: string;
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
  shareToken,
}: Props) {
  const [filter, setFilter] = useState<string>("todos");
  const [activeUnit, setActiveUnit] = useState<Unit | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [shareComments, setShareComments] = useState("");
  const modalScrollRef = useRef<HTMLDivElement>(null);

  const safeUnits = useMemo(() => units.map(normalizeUnit), [units]);
  const safeDevelopmentFeatures = useMemo(
    () => safeFeatures(developmentFeatures),
    [developmentFeatures]
  );

  const bedroomsAvailable = useMemo(() => {
    const set = new Set(safeUnits.map((u) => u.bedrooms));
    return Array.from(set).sort();
  }, [safeUnits]);

  const filteredUnits = useMemo(() => {
    if (filter === "todos") return safeUnits;
    return safeUnits.filter((u) => u.bedrooms === parseInt(filter));
  }, [safeUnits, filter]);

  const activeFeatures =
    activeUnit && activeUnit.features.length > 0
      ? activeUnit.features
      : safeDevelopmentFeatures;
  const activeImages = activeUnit?.images || [];
  const activeImage = activeImages[activeImageIndex] || activeImages[0];

  useEffect(() => {
    if (!activeUnit) return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [activeUnit]);

  const scrollModal = (deltaY: number) => {
    if (!modalScrollRef.current) return;
    modalScrollRef.current.scrollTop += deltaY;
  };

  const openUnit = useCallback((unit: Unit) => {
    setActiveImageIndex(unit.videoUrl ? -1 : 0);
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
      `Tipología: ${bedroomsLabel(unit.bedrooms)}`,
      `Baños: ${unit.bathrooms}`,
      `Superficie cubierta: ${unit.area}m²`,
      unit.totalArea ? `Superficie total: ${unit.totalArea}m²` : null,
      unit.floor ? `Piso: ${unit.floor}` : null,
      unit.orientation ? `Orientación: ${unit.orientation}` : null,
      developmentLocation ? `Ubicación: ${developmentLocation}` : null,
      unit.downPayment ? `Anticipo: ${formatPrice(unit.downPayment)}` : null,
      unit.installmentCount && unit.installmentValue
        ? `${unit.installmentCount} cuotas de ${formatPrice(unit.installmentValue)}`
        : null,
      `Precio final: ${formatPrice(unit.price)}`,
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

  const shareUnitByWhatsApp = (unit: Unit) => {
    window.open(getWhatsAppShareHref(unit), "_blank", "noopener,noreferrer");
  };

  const getMailShareContent = (unit: Unit) => {
    const pdfUrl = getUnitPdfUrl(unit);
    const subject = `Ficha unidad ${unit.unitNumber} - ${developmentName}`;
    return {
      subject,
      body: getUnitShareText(unit, pdfUrl),
    };
  };

  const shareUnitByMail = (unit: Unit) => {
    const { subject, body } = getMailShareContent(unit);
    openMailShare(subject, body);
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
        {bedroomsAvailable.map((b) => {
          const count = safeUnits.filter((u) => u.bedrooms === b).length;
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
            unit.images.find((i) => i.type === "plano")?.url ||
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
                  <video
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
                    <Bed className="h-3 w-3 text-accent" />
                    {bedroomsLabel(unit.bedrooms)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Bath className="h-3 w-3 text-accent" />
                    {unit.bathrooms} baño{unit.bathrooms > 1 ? "s" : ""}
                  </span>
                  <span className="flex items-center gap-1">
                    <Maximize2 className="h-3 w-3 text-accent" />
                    {unit.area}m²
                  </span>
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
                        <p className="text-xs text-ink/58">
                          Precio final {formatPrice(unit.price)}
                        </p>
                      </div>
                    ) : (
                      <span className="font-display text-xl text-accent">
                        {isAvailable ? formatPrice(unit.price) : "—"}
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


      {/* Unit Detail Modal */}
      {activeUnit && (
        <div
          className="fixed inset-0 z-[100] h-[100dvh] overflow-y-auto bg-ink/95 p-3 md:p-8"
          data-native-scroll
          onClick={closeUnit}
        >
          <div
            className="flex min-h-full items-start justify-center md:items-center"
            onClick={(e) => e.stopPropagation()}
            onWheel={(e) => {
              if (modalScrollRef.current?.contains(e.target as Node)) return;
              e.stopPropagation();
              scrollModal(e.deltaY);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Detalle de unidad ${activeUnit.unitNumber}`}
              className="bg-[#F4EBDD] text-ink border border-ink/10 rounded-lg max-w-6xl w-full max-h-none min-h-0 overflow-hidden flex flex-col shadow-2xl md:max-h-[calc(100dvh-4rem)]"
            >
              <div
                className="flex items-start justify-between gap-4 p-4 md:p-5 border-b border-ink/10 flex-shrink-0"
                onWheel={(e) => {
                  e.stopPropagation();
                  scrollModal(e.deltaY);
                }}
              >
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-widest text-accent mb-1">
                    Detalle de unidad
                  </p>
                  <h3 className="font-display font-light text-2xl md:text-3xl text-ink truncate">
                    Unidad {activeUnit.unitNumber}
                  </h3>
                  <p className="text-ink/62 text-sm mt-1 flex flex-wrap gap-x-2 gap-y-1">
                    {bedroomsLabel(activeUnit.bedrooms)} ·{" "}
                    {activeUnit.bathrooms} baño
                    {activeUnit.bathrooms > 1 ? "s" : ""} · {activeUnit.area}m²
                    {activeUnit.floor && <> · Piso {activeUnit.floor}</>}
                    {activeUnit.orientation && <> · {activeUnit.orientation}</>}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeUnit}
                  className="h-10 w-10 rounded-full bg-ink/8 hover:bg-accent flex items-center justify-center text-ink hover:text-ink transition-colors flex-shrink-0"
                  aria-label="Cerrar detalle de unidad"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div
                ref={modalScrollRef}
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y"
                data-native-scroll
                onWheel={(e) => e.stopPropagation()}
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)] gap-5 p-4 md:p-5">
                  <div className="space-y-3">
                    {activeUnit.videoUrl || activeImages.length > 0 ? (
                      <>
                        <div className="relative aspect-[4/3] lg:aspect-[5/4] bg-ink-600 rounded overflow-hidden border border-bone/10">
                          {activeImageIndex === -1 && activeUnit.videoUrl ? (
                            <video
                              src={activeUnit.videoUrl}
                              className="h-full w-full object-contain"
                              autoPlay
                              loop
                              muted
                              playsInline
                              preload="metadata"
                            />
                          ) : (
                            <>
                              <Image
                                src={activeImage?.url || ""}
                                alt={`${activeUnit.unitNumber} - ${
                                  activeImage?.type || "imagen"
                                }`}
                                fill
                                className="object-contain"
                                sizes="(max-width: 1024px) 100vw, 55vw"
                              />
                              {activeImage?.type === "plano" && (
                                <span className="absolute top-3 left-3 px-2 py-1 bg-accent text-ink text-[9px] uppercase tracking-widest font-medium rounded">
                                  Plano
                                </span>
                              )}
                            </>
                          )}
                        </div>

                        {(activeUnit.videoUrl || activeImages.length > 1) && (
                          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                            {activeUnit.videoUrl && (
                              <button
                                type="button"
                                onClick={() => setActiveImageIndex(-1)}
                                className={`relative aspect-square rounded overflow-hidden border bg-ink text-bone transition-colors ${
                                  activeImageIndex === -1
                                    ? "border-accent"
                                    : "border-bone/15 hover:border-bone/40"
                                }`}
                                aria-label="Ver video de la unidad"
                              >
                                <video
                                  src={activeUnit.videoUrl}
                                  className="h-full w-full object-cover opacity-70"
                                  muted
                                  playsInline
                                  preload="metadata"
                                />
                                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium uppercase tracking-widest">
                                  Video
                                </span>
                              </button>
                            )}
                            {activeImages.map((img, idx) => (
                              <button
                                key={img.id || idx}
                                type="button"
                                onClick={() => setActiveImageIndex(idx)}
                                className={`relative aspect-square rounded overflow-hidden border transition-colors ${
                                  idx === activeImageIndex
                                    ? "border-accent"
                                    : "border-bone/15 hover:border-bone/40"
                                }`}
                                aria-label={`Ver imagen ${idx + 1}`}
                              >
                                <Image
                                  src={img.url}
                                  alt={`${activeUnit.unitNumber} miniatura ${idx + 1}`}
                                  fill
                                  className="object-cover"
                                  sizes="96px"
                                />
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="aspect-[4/3] bg-ink-600 rounded border border-bone/10 flex items-center justify-center text-bone/30">
                        <Maximize2 className="h-12 w-12" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-5">
                    <div className="rounded border border-ink/10 bg-white/25 p-4">
                      <p className="text-[10px] uppercase tracking-widest text-ink/50 mb-3">
                        Forma de pago
                      </p>
                      {(activeUnit.downPayment ||
                        activeUnit.installmentCount ||
                        activeUnit.installmentValue) ? (
                        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-4">
                          {activeUnit.downPayment && (
                            <div>
                              <p className="text-[10px] uppercase tracking-widest text-ink/50">
                                Anticipo
                              </p>
                              <p className="font-display text-2xl text-accent mt-1">
                                {formatPrice(activeUnit.downPayment)}
                              </p>
                            </div>
                          )}
                          {activeUnit.installmentCount && (
                            <div>
                              <p className="text-[10px] uppercase tracking-widest text-ink/50">
                                Cantidad de cuotas
                              </p>
                              <p className="font-display text-2xl text-ink mt-1">
                                {activeUnit.installmentCount}
                              </p>
                            </div>
                          )}
                          {activeUnit.installmentValue && (
                            <div>
                              <p className="text-[10px] uppercase tracking-widest text-ink/50">
                                Valor de cuota
                              </p>
                              <p className="font-display text-2xl text-accent mt-1">
                                {formatPrice(activeUnit.installmentValue)}
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-ink/65 text-sm">
                          Consultá por el plan de financiación disponible.
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 pb-5 border-b border-ink/12">
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-ink/50">
                          Precio final
                        </p>
                        <p className="font-display text-2xl text-accent mt-1">
                          {formatPrice(activeUnit.price)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-ink/50">
                          Sup. cubierta
                        </p>
                        <p className="font-display text-2xl text-ink mt-1">
                          {activeUnit.area}m²
                        </p>
                      </div>
                      {activeUnit.balconyArea && (
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-ink/50">
                            Balcón
                          </p>
                          <p className="font-display text-2xl text-ink mt-1">
                            {activeUnit.balconyArea}m²
                          </p>
                        </div>
                      )}
                      {activeUnit.totalArea && (
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-ink/50">
                            Sup. total
                          </p>
                          <p className="font-display text-2xl text-ink mt-1">
                            {activeUnit.totalArea}m²
                          </p>
                        </div>
                      )}
                      {activeUnit.expenses && (
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-ink/50">
                            Expensas
                          </p>
                          <p className="font-display text-lg text-ink mt-1">
                            ${activeUnit.expenses.toLocaleString("es-AR")}
                          </p>
                        </div>
                      )}
                    </div>

                    {activeUnit.description && (
                      <p className="text-ink/75 leading-relaxed">
                        {activeUnit.description}
                      </p>
                    )}

                    {activeFeatures.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-ink/55 mb-3">
                          Características
                        </p>
                        <ul className="grid grid-cols-1 gap-2">
                          {activeFeatures.map((f) => (
                            <li
                              key={f}
                              className="text-ink/75 text-sm flex items-start gap-2"
                            >
                              <span className="text-accent mt-0.5">•</span>
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="pt-5 border-t border-ink/12 space-y-4">
                      <div>
                        <label
                          htmlFor={`unit-comments-${activeUnit.id}`}
                          className="mb-2 block text-[10px] uppercase tracking-widest text-ink/55"
                        >
                          Comentarios para el cliente
                        </label>
                        <textarea
                          id={`unit-comments-${activeUnit.id}`}
                          value={shareComments}
                          onChange={(event) => setShareComments(event.target.value)}
                          maxLength={900}
                          rows={4}
                          placeholder="Ej: ideal para renta temporaria, buena orientación, forma de pago sugerida..."
                          className="w-full resize-none rounded-lg border border-ink/15 bg-white/35 px-4 py-3 text-sm leading-relaxed text-ink placeholder:text-ink/35 outline-none transition-colors focus:border-accent focus:bg-white/55"
                        />
                        <p className="mt-2 text-xs text-ink/45">
                          Se agrega al mensaje y también a la ficha PDF.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => shareUnitByWhatsApp(activeUnit)}
                          className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-500 bg-emerald-500 px-5 py-3 text-sm font-semibold text-ink transition-colors hover:bg-emerald-400 hover:border-emerald-400"
                        >
                          <MessageCircle className="h-4 w-4" />
                          Enviar link PDF por WhatsApp
                        </button>
                        <button
                          type="button"
                          onClick={() => shareUnitByMail(activeUnit)}
                          className="inline-flex items-center justify-center gap-2 rounded-full border border-ink/20 bg-white/30 px-5 py-3 text-sm font-medium text-ink transition-colors hover:bg-ink hover:text-bone"
                        >
                          <Mail className="h-4 w-4" />
                          Enviar PDF por mail
                        </button>
                      </div>
                      <a
                        href={getUnitPdfPath(activeUnit)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-accent/60 bg-accent/10 px-5 py-3 text-sm font-semibold text-accent transition-colors hover:bg-accent hover:text-ink sm:w-auto"
                      >
                        <FileText className="h-4 w-4" />
                        Abrir ficha PDF
                      </a>
                      <a
                        href="/#contacto"
                        className="btn-primary inline-flex w-full justify-center sm:w-auto"
                      >
                        Consultar por esta unidad
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
