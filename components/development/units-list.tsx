"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { X, Bed, Bath, Maximize2, Compass, ChevronRight } from "lucide-react";
import { Unit } from "@/types";
import { formatPrice } from "@/lib/utils";

interface Props {
  units: Unit[];
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

export function UnitsList({ units }: Props) {
  const [filter, setFilter] = useState<string>("todos");
  const [activeUnit, setActiveUnit] = useState<Unit | null>(null);

  const bedroomsAvailable = useMemo(() => {
    const set = new Set(units.map((u) => u.bedrooms));
    return Array.from(set).sort();
  }, [units]);

  const filteredUnits = useMemo(() => {
    if (filter === "todos") return units;
    return units.filter((u) => u.bedrooms === parseInt(filter));
  }, [units, filter]);

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
              onClick={() => setActiveUnit(unit)}
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
                  <span className="font-display text-xl text-accent">
                    {isAvailable ? formatPrice(unit.price) : "—"}
                  </span>
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
          className="fixed inset-0 z-[100] bg-ink/95 overflow-y-auto"
          onClick={() => setActiveUnit(null)}
        >
          <div
            className="min-h-screen flex items-start justify-center p-4 md:p-12"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-ink border border-bone/15 rounded-lg max-w-5xl w-full overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-bone/15">
                <div>
                  <h3 className="font-display font-light text-3xl text-bone">
                    Unidad {activeUnit.unitNumber}
                  </h3>
                  <p className="text-bone/60 text-sm mt-1">
                    {bedroomsLabel(activeUnit.bedrooms)} ·{" "}
                    {activeUnit.bathrooms} baño
                    {activeUnit.bathrooms > 1 ? "s" : ""} · {activeUnit.area}m²
                  </p>
                </div>
                <button
                  onClick={() => setActiveUnit(null)}
                  className="h-10 w-10 rounded-full bg-bone/10 hover:bg-accent flex items-center justify-center text-bone hover:text-ink transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Images grid */}
              {activeUnit.images.length > 0 && (
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeUnit.images.map((img, idx) => (
                    <div
                      key={img.id || idx}
                      className="relative aspect-[4/3] bg-ink-600 rounded overflow-hidden"
                    >
                      <Image
                        src={img.url}
                        alt={`${activeUnit.unitNumber} - ${img.type}`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 50vw"
                      />
                      {img.type === "plano" && (
                        <span className="absolute top-2 left-2 px-2 py-1 bg-accent text-ink text-[9px] uppercase tracking-widest font-medium rounded">
                          Plano
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Info */}
              <div className="p-5 space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-5 border-b border-bone/15">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-bone/50">
                      Precio
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

                {activeUnit.features.length > 0 && (
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {activeUnit.features.map((f) => (
                      <li
                        key={f}
                        className="text-bone/75 text-sm flex items-start gap-2"
                      >
                        <span className="text-accent">•</span> {f}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="pt-5 border-t border-bone/15">
                  <a href="/#contacto" className="btn-primary inline-flex">
                    Consultar por esta unidad
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
