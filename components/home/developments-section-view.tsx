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
      { threshold: 0.05 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const allDevs = highlighted
    ? [highlighted, ...others]
    : others;

  const noContent = allDevs.length === 0;

  return (
    <section
      ref={sectionRef}
      id="desarrollos"
      className="relative section-pad bg-ink text-bone overflow-hidden"
    >
      {/* Subtle background grain */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="container-custom relative z-10">
        {/* Section header — minimal editorial */}
        <div className="mb-20 md:mb-32">
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 md:col-span-8">
              <p
                className={`text-[11px] uppercase tracking-[0.2em] text-accent mb-5 transition-all duration-1000 ease-out-expo ${
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
              >
                Desarrollos en curso
              </p>
              <h2
                className={`font-display font-light text-[clamp(2.5rem,6vw,5rem)] tracking-[-0.03em] leading-[1] text-bone transition-all duration-[1400ms] ease-out-expo ${
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
                }`}
                style={{ transitionDelay: "150ms" }}
              >
                Proyectos con{" "}
                <span className="italic">alta rentabilidad</span>
                <br className="hidden md:block" /> en las mejores zonas.
              </h2>
            </div>
            <div className="col-span-12 md:col-span-3 md:col-start-10 flex items-end">
              <p
                className={`text-bone/50 text-sm leading-relaxed transition-all duration-1000 ease-out-expo ${
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                }`}
                style={{ transitionDelay: "300ms" }}
              >
                Ingresá en etapa de pozo o construcción. Financiación flexible
                con anticipo del 35%.
              </p>
            </div>
          </div>
        </div>

        {noContent && (
          <div className="border-t border-bone/15 py-16 text-center">
            <p className="text-bone/60 text-lg">
              Pronto vamos a publicar nuestros desarrollos.
            </p>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════
            STAGGERED ASYMMETRIC GRID — Obsidian Assembly style
            ═══════════════════════════════════════════════════ */}
        {allDevs.length > 0 && (
          <div className="grid grid-cols-12 gap-x-5 gap-y-16 md:gap-y-24">
            {allDevs.map((dev, idx) => {
              const primaryImage =
                dev.images.find((i) => i.isPrimary)?.url || dev.images[0]?.url;
              const priceFrom = dev.minPriceAvailable ?? dev.priceFrom;
              const isHighlighted = highlighted && dev.id === highlighted.id;

              // Asymmetric positioning: alternate between left/right & different sizes
              const layouts = [
                // First: large, spans left
                "col-span-12 md:col-span-7 md:col-start-1",
                // Second: medium, offset right with top margin
                "col-span-12 md:col-span-5 md:col-start-8 md:mt-32",
                // Third: medium, left with offset
                "col-span-12 md:col-span-6 md:col-start-2 md:-mt-12",
                // Fourth: small, far right
                "col-span-12 md:col-span-5 md:col-start-7 md:mt-20",
              ];

              const aspectRatios = [
                "aspect-[4/5]",
                "aspect-[3/4]",
                "aspect-[16/11]",
                "aspect-[3/4]",
              ];

              const layout = layouts[idx % layouts.length];
              const aspect = aspectRatios[idx % aspectRatios.length];

              return (
                <div
                  key={dev.id}
                  className={`${layout} transition-all duration-[1400ms] ease-out-expo ${
                    isVisible
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-20"
                  }`}
                  style={{ transitionDelay: `${400 + idx * 200}ms` }}
                >
                  <Link
                    href={`/desarrollos/${dev.slug}`}
                    className="group block"
                  >
                    {/* Image */}
                    <div
                      className={`relative ${aspect} overflow-hidden bg-ink-800 mb-6`}
                    >
                      {primaryImage && (
                        <Image
                          src={primaryImage}
                          alt={dev.name}
                          fill
                          className="object-cover transition-transform duration-[2000ms] ease-out-expo group-hover:scale-[1.04]"
                          sizes="(max-width: 768px) 100vw, 50vw"
                        />
                      )}
                      {/* Overlay on hover */}
                      <div className="absolute inset-0 bg-ink/0 group-hover:bg-ink/20 transition-colors duration-700" />

                      {/* Status badge */}
                      <div className="absolute top-4 left-4">
                        <span className="px-3 py-1.5 bg-accent text-ink text-[9px] uppercase tracking-[0.15em] font-medium rounded-full">
                          {DEVELOPMENT_STATUS_LABELS[dev.status]}
                        </span>
                      </div>

                      {/* Arrow on hover */}
                      <div className="absolute bottom-5 right-5 h-11 w-11 rounded-full bg-bone flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-3 group-hover:translate-y-0 transition-all duration-500 ease-out-expo">
                        <ArrowUpRight className="h-5 w-5 text-ink" />
                      </div>

                      {/* Bottom gradient */}
                      <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-ink/60 via-transparent to-transparent pointer-events-none" />
                    </div>

                    {/* Content */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-bone/40 text-[10px] uppercase tracking-[0.2em]">
                        <MapPin className="h-3 w-3" />
                        <span>{dev.location}</span>
                        {dev.completionDate && (
                          <>
                            <span className="text-bone/20">·</span>
                            <span>Entrega {dev.completionDate}</span>
                          </>
                        )}
                      </div>

                      <h3 className="font-display font-light text-[clamp(1.5rem,3vw,2.5rem)] text-bone tracking-[-0.02em] leading-[1.1] group-hover:italic transition-all duration-500">
                        {dev.name}
                      </h3>

                      {dev.shortDescription && (
                        <p className="text-bone/50 text-sm leading-relaxed line-clamp-2 max-w-md">
                          {dev.shortDescription}
                        </p>
                      )}

                      <div className="flex items-center gap-6 pt-4">
                        {priceFrom && (
                          <div>
                            <p className="text-[9px] uppercase tracking-[0.2em] text-bone/40 mb-0.5">
                              Desde
                            </p>
                            <span className="font-display text-lg text-accent">
                              {formatPrice(priceFrom)}
                            </span>
                          </div>
                        )}
                        {dev.progress > 0 && (
                          <div>
                            <p className="text-[9px] uppercase tracking-[0.2em] text-bone/40 mb-0.5">
                              Avance
                            </p>
                            <span className="font-display text-lg text-bone">
                              {dev.progress}%
                            </span>
                          </div>
                        )}
                        {dev.availableUnits !== undefined && dev.availableUnits > 0 && (
                          <div>
                            <p className="text-[9px] uppercase tracking-[0.2em] text-bone/40 mb-0.5">
                              Disponibles
                            </p>
                            <span className="font-display text-lg text-bone">
                              {dev.availableUnits}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        )}

        {/* CTA */}
        {!noContent && (
          <div
            className={`text-center mt-24 md:mt-32 transition-all duration-1000 ease-out-expo ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
            style={{ transitionDelay: `${400 + allDevs.length * 200 + 200}ms` }}
          >
            <Link
              href="/desarrollos"
              className="inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-bone/70 hover:text-accent transition-colors duration-300 group"
            >
              <span>Ver todos los desarrollos</span>
              <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
