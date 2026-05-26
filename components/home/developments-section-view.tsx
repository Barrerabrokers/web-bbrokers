"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, MapPin, Calendar, TrendingUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Development, DEVELOPMENT_STATUS_LABELS } from "@/types";
import { formatPrice } from "@/lib/utils";

interface Props {
  highlighted?: Development;
  others: Development[];
}

export function DevelopmentsSectionView({ highlighted, others }: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const noContent = !highlighted && others.length === 0;


  return (
    <section
      ref={sectionRef}
      id="desarrollos"
      className="relative section-pad bg-ink text-bone"
    >
      <div
        aria-hidden="true"
        className="absolute bottom-0 left-0 w-[40vw] h-[40vw] max-w-[600px] max-h-[600px] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at bottom left, rgba(21,20,21,0.12) 0%, transparent 60%)",
        }}
      />

      <div className="container-custom relative z-10">
        {/* Section header */}
        <div className="grid grid-cols-12 gap-6 mb-16 md:mb-24">
          <div className="col-span-12 md:col-span-1">
            <p
              className={`font-display italic font-light text-xl md:text-2xl text-accent transition-all duration-1000 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              01
            </p>
          </div>

          <div className="col-span-12 md:col-span-7 md:col-start-3">
            <p
              className={`text-[11px] uppercase tracking-widest text-accent mb-4 transition-all duration-1000 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
              style={{ transitionDelay: "100ms" }}
            >
              Desarrollos en curso
            </p>
            <h2
              className={`font-display font-light text-[36px] md:text-[56px] lg:text-[72px] tracking-[-0.025em] leading-[1.02] text-bone transition-all duration-1000 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: "200ms" }}
            >
              Proyectos con <span className="italic">alta rentabilidad</span> en
              las mejores zonas.
            </h2>
          </div>

          <div className="col-span-12 md:col-span-3 md:col-start-10 flex items-end">
            <p
              className={`text-bone/60 text-base leading-relaxed transition-all duration-1000 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
              }`}
              style={{ transitionDelay: "300ms" }}
            >
              Ingresá en etapa de pozo o construcción. Financiación flexible con
              anticipo del 35% y saldo en cuotas.
            </p>
          </div>
        </div>

        {noContent && (
          <div className="border-t border-bone/15 py-16 text-center">
            <p className="text-bone/60 text-lg">
              Pronto vamos a publicar nuestros desarrollos. Volvé en unos días.
            </p>
          </div>
        )}


        {/* Highlighted */}
        {highlighted && (() => {
          const dev = highlighted;
          const primaryImage =
            dev.images.find((i) => i.isPrimary)?.url || dev.images[0]?.url;
          const priceFrom = dev.minPriceAvailable ?? dev.priceFrom;

          return (
            <div
              className={`mb-16 transition-all duration-1000 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
              }`}
              style={{ transitionDelay: "400ms" }}
            >
              <Link href={`/desarrollos/${dev.slug}`} className="group block">
                <div className="grid grid-cols-12 gap-6">
                  <div className="col-span-12 lg:col-span-8">
                    <div className="relative aspect-[16/10] overflow-hidden bg-ink-600">
                      {primaryImage && (
                        <Image
                          src={primaryImage}
                          alt={dev.name}
                          fill
                          className="object-cover transition-transform duration-[2000ms] group-hover:scale-105"
                          style={{ transitionTimingFunction: "var(--f-cubic)" }}
                          sizes="(max-width: 1024px) 100vw, 66vw"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-transparent to-transparent" />
                      <div className="absolute top-4 left-4 flex items-center gap-2">
                        <span className="px-3 py-1.5 bg-accent text-ink text-[10px] uppercase tracking-widest font-medium rounded-full">
                          {DEVELOPMENT_STATUS_LABELS[dev.status]}
                        </span>
                        <span className="px-3 py-1.5 bg-bone/10 backdrop-blur-sm text-bone text-[10px] uppercase tracking-widest rounded-full border border-bone/20">
                          Destacado
                        </span>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-6">
                        <div className="flex items-end justify-between">
                          <div>
                            <h3 className="font-display font-light text-3xl md:text-4xl lg:text-5xl text-bone tracking-tight group-hover:italic transition-all duration-700">
                              {dev.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-2 text-bone/60">
                              <MapPin className="h-4 w-4" />
                              <span className="text-sm">{dev.location}</span>
                            </div>
                          </div>
                          <div className="h-12 w-12 rounded-full bg-accent flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-500">
                            <ArrowUpRight className="h-5 w-5 text-ink" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>


                  <div className="col-span-12 lg:col-span-4 flex flex-col justify-between">
                    <div className="space-y-6">
                      <div className="border-b border-bone/15 pb-6">
                        <p className="text-[10px] uppercase tracking-widest text-bone/50 mb-2">
                          Retorno estimado
                        </p>
                        <div className="font-display font-light text-5xl md:text-6xl text-accent tracking-tight">
                          30-40%
                        </div>
                      </div>

                      {priceFrom && (
                        <div className="border-b border-bone/15 pb-6">
                          <p className="text-[10px] uppercase tracking-widest text-bone/50 mb-2">
                            Desde
                          </p>
                          <div className="font-display font-light text-3xl text-bone tracking-tight">
                            {formatPrice(priceFrom)}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        {dev.completionDate && (
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-bone/50 mb-1">
                              Entrega
                            </p>
                            <div className="flex items-center gap-2 text-bone">
                              <Calendar className="h-4 w-4 text-accent" />
                              <span>{dev.completionDate}</span>
                            </div>
                          </div>
                        )}
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-bone/50 mb-1">
                            Unidades
                          </p>
                          <span className="text-bone">
                            {dev.unitsCount || 0} dptos
                          </span>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[10px] uppercase tracking-widest text-bone/50 mb-2">
                          <span>Avance de obra</span>
                          <span>{dev.progress}%</span>
                        </div>
                        <div className="h-1 bg-bone/15 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent rounded-full transition-all duration-1000"
                            style={{ width: `${dev.progress}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-8">
                      <span className="btn-outline-light w-full justify-center">
                        Ver proyecto completo
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          );
        })()}


        {/* Other developments grid */}
        {others.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-bone/15 pt-16">
            {others.map((dev, idx) => {
              const primaryImage =
                dev.images.find((i) => i.isPrimary)?.url ||
                dev.images[0]?.url;
              const priceFrom = dev.minPriceAvailable ?? dev.priceFrom;

              return (
                <Link
                  key={dev.id}
                  href={`/desarrollos/${dev.slug}`}
                  className={`group block transition-all duration-1000 ${
                    isVisible
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-12"
                  }`}
                  style={{ transitionDelay: `${500 + idx * 100}ms` }}
                >
                  <div className="relative aspect-[4/5] overflow-hidden bg-ink-600 mb-5">
                    {primaryImage && (
                      <Image
                        src={primaryImage}
                        alt={dev.name}
                        fill
                        className="object-cover transition-transform duration-[1500ms] group-hover:scale-105"
                        style={{
                          transitionTimingFunction: "var(--f-cubic)",
                        }}
                        sizes="(max-width: 768px) 100vw, 33vw"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent" />

                    <div className="absolute top-3 left-3">
                      <span className="px-2.5 py-1 bg-accent text-ink text-[9px] uppercase tracking-widest font-medium rounded-full">
                        {DEVELOPMENT_STATUS_LABELS[dev.status]}
                      </span>
                    </div>

                    {dev.availableUnits !== undefined && dev.availableUnits > 0 && (
                      <div className="absolute top-3 right-3">
                        <span className="flex items-center gap-1 px-2.5 py-1 bg-bone/10 backdrop-blur-sm text-bone text-[10px] uppercase tracking-widest rounded-full border border-bone/20">
                          <TrendingUp className="h-3 w-3" />
                          {dev.availableUnits} dispo
                        </span>
                      </div>
                    )}

                    <div className="absolute bottom-3 right-3 h-10 w-10 rounded-full bg-accent flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-500">
                      <ArrowUpRight className="h-4 w-4 text-ink" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-bone/50 text-[10px] uppercase tracking-widest">
                      <MapPin className="h-3 w-3" />
                      {dev.location}
                    </div>
                    <h3 className="font-display font-light text-2xl text-bone tracking-tight group-hover:italic transition-all duration-500">
                      {dev.name}
                    </h3>
                    <div className="flex items-baseline justify-between pt-3 border-t border-bone/15">
                      <span className="font-display text-lg text-accent">
                        {priceFrom ? formatPrice(priceFrom) : "—"}
                      </span>
                      {dev.completionDate && (
                        <span className="text-[10px] uppercase tracking-widest text-bone/50">
                          Entrega {dev.completionDate}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* CTA */}
        {!noContent && (
          <div className="text-center mt-16 pt-12 border-t border-bone/15">
            <Link href="/desarrollos" className="btn-outline-light">
              Ver todos los desarrollos
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
