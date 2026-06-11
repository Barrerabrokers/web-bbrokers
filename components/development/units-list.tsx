"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  X,
  Bed,
  Bath,
  Maximize2,
  Compass,
  ChevronRight,
  Mail,
  MessageCircle,
} from "lucide-react";
import { Unit } from "@/types";
import { formatPrice } from "@/lib/utils";

interface Props {
  units: Unit[];
  developmentFeatures?: string[];
  developmentName?: string;
  developmentLocation?: string;
  developmentUrl?: string;
}

const STATUS_COLORS: Record<string, string> = {
  disponible: "bg-emerald-500/10 border-emerald-500/40 text-emerald-300",
  reservada: "bg-amber-500/10 border-amber-500/40 text-amber-300",
  vendida: "bg-bone/5 border-bone/15 text-bone/40",
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

export function UnitsList({
  units,
  developmentFeatures = [],
  developmentName = "el desarrollo",
  developmentLocation,
  developmentUrl,
}: Props) {
  const [filter, setFilter] = useState<string>("todos");
  const [activeUnit, setActiveUnit] = useState<Unit | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const modalScrollRef = useRef<HTMLDivElement>(null);

  const bedroomsAvailable = useMemo(() => {
    const set = new Set(units.map((u) => u.bedrooms));
    return Array.from(set).sort();
  }, [units]);

  const filteredUnits = useMemo(() => {
    if (filter === "todos") return units;
    return units.filter((u) => u.bedrooms === parseInt(filter));
  }, [units, filter]);

  const activeFeatures =
    activeUnit && activeUnit.features.length > 0
      ? activeUnit.features
      : developmentFeatures;

  useEffect(() => {
    if (!activeUnit) return;
    const scrollY = window.scrollY;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyPosition = document.body.style.position;
    const previousBodyTop = document.body.style.top;
    const previousBodyWidth = document.body.style.width;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.position = previousBodyPosition;
      document.body.style.top = previousBodyTop;
      document.body.style.width = previousBodyWidth;
      document.documentElement.style.overflow = previousHtmlOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [activeUnit]);

  const scrollModal = (deltaY: number) => {
    if (!modalScrollRef.current) return;
    modalScrollRef.current.scrollTop += deltaY;
  };

  const openUnit = (unit: Unit) => {
    setActiveImageIndex(0);
    setActiveUnit(unit);
  };

  const closeUnit = () => {
    setActiveUnit(null);
    setActiveImageIndex(0);
  };

  const getUnitShareUrl = (unit: Unit) => {
    const path = developmentUrl || window.location.pathname;
    const baseUrl = window.location.origin;
    return `${baseUrl}${path}#unidad-${unit.id}`;
  };

  const getAbsoluteUrl = (url: string) => {
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `${window.location.origin}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  const getUnitShareText = (
    unit: Unit,
    {
      includeImageLinks = true,
      includeDevelopmentLink = true,
    }: { includeImageLinks?: boolean; includeDevelopmentLink?: boolean } = {}
  ) => {
    const imageLines =
      includeImageLinks && unit.images.length > 0
        ? [
            "",
            "Imágenes de la unidad:",
            ...unit.images.map((image, index) => {
              const label = image.type
                ? `${image.type} ${index + 1}`
                : `Imagen ${index + 1}`;
              return `${label}: ${getAbsoluteUrl(image.url)}`;
            }),
          ]
        : [];

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
      ...imageLines,
      includeDevelopmentLink ? "" : null,
      includeDevelopmentLink ? `Ver desarrollo: ${getUnitShareUrl(unit)}` : null,
    ];

    return lines.filter(Boolean).join("\n");
  };

  const getWhatsAppShareHref = (unit: Unit) =>
    `https://wa.me/?text=${encodeURIComponent(
      getUnitShareText(unit, {
        includeImageLinks: false,
        includeDevelopmentLink: false,
      })
    )}`;

  const getImageExtension = (mimeType: string) => {
    if (mimeType.includes("png")) return "png";
    if (mimeType.includes("webp")) return "webp";
    return "jpg";
  };

  const shareUnitByWhatsApp = async (unit: Unit) => {
    const shareImage =
      unit.images.find((image) => image.isPrimary) ||
      unit.images[activeImageIndex] ||
      unit.images[0];

    const openWhatsAppFallback = () => {
      window.open(getWhatsAppShareHref(unit), "_blank", "noopener,noreferrer");
    };

    if (!shareImage || !navigator.share) {
      openWhatsAppFallback();
      return;
    }

    try {
      const response = await fetch(getAbsoluteUrl(shareImage.url));
      if (!response.ok) throw new Error("No se pudo cargar la imagen");

      const blob = await response.blob();
      const mimeType = blob.type || "image/jpeg";
      const file = new File(
        [blob],
        `unidad-${unit.unitNumber}.${getImageExtension(mimeType)}`,
        { type: mimeType }
      );
      const shareData: ShareData = {
        title: `Ficha unidad ${unit.unitNumber} - ${developmentName}`,
        text: getUnitShareText(unit, {
          includeImageLinks: false,
          includeDevelopmentLink: false,
        }),
        files: [file],
      };

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share(shareData);
        return;
      }

      openWhatsAppFallback();
    } catch {
      openWhatsAppFallback();
    }
  };

  const getMailShareHref = (unit: Unit) => {
    const subject = `Ficha unidad ${unit.unitNumber} - ${developmentName}`;
    return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
      getUnitShareText(unit)
    )}`;
  };

  if (units.length === 0) {
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
          Todas ({units.length})
        </button>
        {bedroomsAvailable.map((b) => {
          const count = units.filter((u) => u.bedrooms === b).length;
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
              className="group text-left bg-bone/5 border border-bone/15 hover:border-accent/50 rounded-lg overflow-hidden transition-all"
            >
              <div className="relative aspect-[4/3] bg-ink-600">
                {planImg ? (
                  <Image
                    src={planImg}
                    alt={unit.unitNumber}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-bone/30">
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
                  <h3 className="font-display font-light text-2xl text-bone">
                    {unit.unitNumber}
                  </h3>
                  {unit.floor && (
                    <span className="text-[10px] uppercase tracking-widest text-bone/50">
                      Piso {unit.floor}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-3 text-bone/70 text-xs mb-4">
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
                <div className="flex items-center justify-between pt-4 border-t border-bone/15">
                  <div>
                    {isAvailable && hasPaymentPlan(unit) ? (
                      <div className="space-y-1">
                        {unit.downPayment && (
                          <p className="text-[10px] uppercase tracking-widest text-bone/45">
                            Anticipo {formatPrice(unit.downPayment)}
                          </p>
                        )}
                        {unit.installmentCount && unit.installmentValue && (
                          <p className="font-display text-lg text-accent">
                            {unit.installmentCount} cuotas de{" "}
                            {formatPrice(unit.installmentValue)}
                          </p>
                        )}
                        <p className="text-xs text-bone/55">
                          Precio final {formatPrice(unit.price)}
                        </p>
                      </div>
                    ) : (
                      <span className="font-display text-xl text-accent">
                        {isAvailable ? formatPrice(unit.price) : "—"}
                      </span>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-bone/40 group-hover:text-accent transition-colors" />
                </div>
              </div>
            </button>
          );
        })}
      </div>


      {/* Unit Detail Modal */}
      {activeUnit && (
        <div
          className="fixed inset-0 z-[100] bg-ink/95 p-3 md:p-8"
          onClick={closeUnit}
        >
          <div
            className="h-full flex items-center justify-center"
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
              className="bg-ink border border-bone/15 rounded-lg max-w-6xl w-full max-h-full overflow-hidden flex flex-col shadow-2xl"
            >
              <div
                className="flex items-start justify-between gap-4 p-4 md:p-5 border-b border-bone/15 flex-shrink-0"
                onWheel={(e) => {
                  e.stopPropagation();
                  scrollModal(e.deltaY);
                }}
              >
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-widest text-accent mb-1">
                    Detalle de unidad
                  </p>
                  <h3 className="font-display font-light text-2xl md:text-3xl text-bone truncate">
                    Unidad {activeUnit.unitNumber}
                  </h3>
                  <p className="text-bone/60 text-sm mt-1 flex flex-wrap gap-x-2 gap-y-1">
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
                  className="h-10 w-10 rounded-full bg-bone/10 hover:bg-accent flex items-center justify-center text-bone hover:text-ink transition-colors flex-shrink-0"
                  aria-label="Cerrar detalle de unidad"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div
                ref={modalScrollRef}
                className="overflow-y-auto overscroll-contain"
                onWheel={(e) => e.stopPropagation()}
              >
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)] gap-5 p-4 md:p-5">
                  <div className="space-y-3">
                    {activeUnit.images.length > 0 ? (
                      <>
                        <div className="relative aspect-[4/3] lg:aspect-[5/4] bg-ink-600 rounded overflow-hidden border border-bone/10">
                          <Image
                            src={activeUnit.images[activeImageIndex]?.url || activeUnit.images[0].url}
                            alt={`${activeUnit.unitNumber} - ${
                              activeUnit.images[activeImageIndex]?.type || "imagen"
                            }`}
                            fill
                            className="object-contain"
                            sizes="(max-width: 1024px) 100vw, 55vw"
                          />
                          {activeUnit.images[activeImageIndex]?.type === "plano" && (
                            <span className="absolute top-3 left-3 px-2 py-1 bg-accent text-ink text-[9px] uppercase tracking-widest font-medium rounded">
                              Plano
                            </span>
                          )}
                        </div>

                        {activeUnit.images.length > 1 && (
                          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                            {activeUnit.images.map((img, idx) => (
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
                    <div className="rounded border border-bone/10 bg-bone/5 p-4">
                      <p className="text-[10px] uppercase tracking-widest text-bone/50 mb-3">
                        Forma de pago
                      </p>
                      {(activeUnit.downPayment ||
                        activeUnit.installmentCount ||
                        activeUnit.installmentValue) ? (
                        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-4">
                          {activeUnit.downPayment && (
                            <div>
                              <p className="text-[10px] uppercase tracking-widest text-bone/50">
                                Anticipo
                              </p>
                              <p className="font-display text-2xl text-accent mt-1">
                                {formatPrice(activeUnit.downPayment)}
                              </p>
                            </div>
                          )}
                          {activeUnit.installmentCount && (
                            <div>
                              <p className="text-[10px] uppercase tracking-widest text-bone/50">
                                Cantidad de cuotas
                              </p>
                              <p className="font-display text-2xl text-bone mt-1">
                                {activeUnit.installmentCount}
                              </p>
                            </div>
                          )}
                          {activeUnit.installmentValue && (
                            <div>
                              <p className="text-[10px] uppercase tracking-widest text-bone/50">
                                Valor de cuota
                              </p>
                              <p className="font-display text-2xl text-accent mt-1">
                                {formatPrice(activeUnit.installmentValue)}
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-bone/60 text-sm">
                          Consultá por el plan de financiación disponible.
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 pb-5 border-b border-bone/15">
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-bone/50">
                          Precio final
                        </p>
                        <p className="font-display text-2xl text-accent mt-1">
                          {formatPrice(activeUnit.price)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-bone/50">
                          Sup. cubierta
                        </p>
                        <p className="font-display text-2xl text-bone mt-1">
                          {activeUnit.area}m²
                        </p>
                      </div>
                      {activeUnit.balconyArea && (
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-bone/50">
                            Balcón
                          </p>
                          <p className="font-display text-2xl text-bone mt-1">
                            {activeUnit.balconyArea}m²
                          </p>
                        </div>
                      )}
                      {activeUnit.totalArea && (
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-bone/50">
                            Sup. total
                          </p>
                          <p className="font-display text-2xl text-bone mt-1">
                            {activeUnit.totalArea}m²
                          </p>
                        </div>
                      )}
                      {activeUnit.expenses && (
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-bone/50">
                            Expensas
                          </p>
                          <p className="font-display text-lg text-bone mt-1">
                            ${activeUnit.expenses.toLocaleString("es-AR")}
                          </p>
                        </div>
                      )}
                    </div>

                    {activeUnit.description && (
                      <p className="text-bone/75 leading-relaxed">
                        {activeUnit.description}
                      </p>
                    )}

                    {activeFeatures.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-black mb-3">
                          Características
                        </p>
                        <ul className="grid grid-cols-1 gap-2">
                          {activeFeatures.map((f) => (
                            <li
                              key={f}
                              className="text-black text-sm flex items-start gap-2"
                            >
                              <span className="text-accent mt-0.5">•</span>
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="pt-5 border-t border-bone/15 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => shareUnitByWhatsApp(activeUnit)}
                          className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-5 py-3 text-sm font-medium text-emerald-200 transition-colors hover:bg-emerald-500 hover:text-ink"
                        >
                          <MessageCircle className="h-4 w-4" />
                          Enviar ficha por WhatsApp
                        </button>
                        <a
                          href={getMailShareHref(activeUnit)}
                          className="inline-flex items-center justify-center gap-2 rounded-full border border-bone/20 bg-bone/10 px-5 py-3 text-sm font-medium text-bone transition-colors hover:bg-bone hover:text-ink"
                        >
                          <Mail className="h-4 w-4" />
                          Enviar ficha por mail
                        </a>
                      </div>
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
