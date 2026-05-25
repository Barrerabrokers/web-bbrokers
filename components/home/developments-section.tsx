"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, MapPin, Calendar, TrendingUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Desarrollos Section — Featured development projects
 * Focus on investment opportunity with financing details
 */

const developments = [
  {
    id: 1,
    name: "Torre Palermo Green",
    location: "Palermo, Buenos Aires",
    image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&q=90",
    status: "En construcción",
    completion: "Q4 2026",
    units: 48,
    returnRate: "35%",
    priceFrom: "USD 95.000",
    progress: 45,
    highlight: true,
  },
  {
    id: 2,
    name: "Belgrano Studios",
    location: "Belgrano, Buenos Aires",
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&q=90",
    status: "Pre-venta",
    completion: "Q2 2027",
    units: 32,
    returnRate: "38%",
    priceFrom: "USD 78.000",
    progress: 15,
    highlight: false,
  },
  {
    id: 3,
    name: "Núñez Residence",
    location: "Núñez, Buenos Aires",
    image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=90",
    status: "En construcción",
    completion: "Q1 2026",
    units: 24,
    returnRate: "32%",
    priceFrom: "USD 120.000",
    progress: 70,
    highlight: false,
  },
  {
    id: 4,
    name: "Recoleta Premium",
    location: "Recoleta, Buenos Aires",
    image: "https://images.unsplash.com/photo-1567496898669-ee935f5f647a?w=1200&q=90",
    status: "Pre-venta",
    completion: "Q3 2027",
    units: 18,
    returnRate: "40%",
    priceFrom: "USD 180.000",
    progress: 5,
    highlight: false,
  },
];

export function DevelopmentsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="desarrollos"
      className="relative section-pad bg-ink text-bone"
    >
      {/* Background accent */}
      <div
        aria-hidden="true"
        className="absolute bottom-0 left-0 w-[40vw] h-[40vw] max-w-[600px] max-h-[600px] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at bottom left, rgba(214,184,92,0.08) 0%, transparent 60%)",
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

        {/* Featured development */}
        {developments
          .filter((d) => d.highlight)
          .map((dev) => (
            <div
              key={dev.id}
              className={`mb-16 transition-all duration-1000 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
              }`}
              style={{ transitionDelay: "400ms" }}
            >
              <Link href={`/desarrollos/${dev.id}`} className="group block">
                <div className="grid grid-cols-12 gap-6">
                  <div className="col-span-12 lg:col-span-8">
                    <div className="relative aspect-[16/10] overflow-hidden bg-ink-600">
                      <Image
                        src={dev.image}
                        alt={dev.name}
                        fill
                        className="object-cover transition-transform duration-[2000ms] group-hover:scale-105"
                        style={{ transitionTimingFunction: "var(--f-cubic)" }}
                        sizes="(max-width: 1024px) 100vw, 66vw"
                      />
                      {/* Overlay gradient */}
                      <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-transparent to-transparent" />
                      
                      {/* Status badge */}
                      <div className="absolute top-4 left-4 flex items-center gap-2">
                        <span className="px-3 py-1.5 bg-accent text-ink text-[10px] uppercase tracking-widest font-medium rounded-full">
                          {dev.status}
                        </span>
                        <span className="px-3 py-1.5 bg-bone/10 backdrop-blur-sm text-bone text-[10px] uppercase tracking-widest rounded-full border border-bone/20">
                          Destacado
                        </span>
                      </div>

                      {/* Bottom info */}
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
                          {dev.returnRate}
                        </div>
                      </div>

                      <div className="border-b border-bone/15 pb-6">
                        <p className="text-[10px] uppercase tracking-widest text-bone/50 mb-2">
                          Desde
                        </p>
                        <div className="font-display font-light text-3xl text-bone tracking-tight">
                          {dev.priceFrom}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-bone/50 mb-1">
                            Entrega
                          </p>
                          <div className="flex items-center gap-2 text-bone">
                            <Calendar className="h-4 w-4 text-accent" />
                            <span>{dev.completion}</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-bone/50 mb-1">
                            Unidades
                          </p>
                          <span className="text-bone">{dev.units} dptos</span>
                        </div>
                      </div>

                      {/* Progress bar */}
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
          ))}

        {/* Other developments grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-bone/15 pt-16">
          {developments
            .filter((d) => !d.highlight)
            .map((dev, idx) => (
              <Link
                key={dev.id}
                href={`/desarrollos/${dev.id}`}
                className={`group block transition-all duration-1000 ${
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
                }`}
                style={{ transitionDelay: `${500 + idx * 100}ms` }}
              >
                <div className="relative aspect-[4/5] overflow-hidden bg-ink-600 mb-5">
                  <Image
                    src={dev.image}
                    alt={dev.name}
                    fill
                    className="object-cover transition-transform duration-[1500ms] group-hover:scale-105"
                    style={{ transitionTimingFunction: "var(--f-cubic)" }}
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent" />
                  
                  {/* Status badge */}
                  <div className="absolute top-3 left-3">
                    <span className="px-2.5 py-1 bg-accent text-ink text-[9px] uppercase tracking-widest font-medium rounded-full">
                      {dev.status}
                    </span>
                  </div>

                  {/* Return badge */}
                  <div className="absolute top-3 right-3">
                    <span className="flex items-center gap-1 px-2.5 py-1 bg-bone/10 backdrop-blur-sm text-bone text-[10px] uppercase tracking-widest rounded-full border border-bone/20">
                      <TrendingUp className="h-3 w-3" />
                      {dev.returnRate}
                    </span>
                  </div>

                  {/* Arrow on hover */}
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
                      {dev.priceFrom}
                    </span>
                    <span className="text-[10px] uppercase tracking-widest text-bone/50">
                      Entrega {dev.completion}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-16 pt-12 border-t border-bone/15">
          <Link href="/desarrollos" className="btn-outline-light">
            Ver todos los desarrollos
          </Link>
        </div>
      </div>
    </section>
  );
}
