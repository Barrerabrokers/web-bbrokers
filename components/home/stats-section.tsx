"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Stats Section — Animated numbers with scroll trigger
 * Key metrics for investor confidence
 */

const stats = [
  {
    value: 25,
    suffix: "+",
    label: "Años de experiencia",
    description: "Más de dos décadas operando en el mercado inmobiliario de Buenos Aires.",
  },
  {
    value: 500,
    suffix: "+",
    label: "Unidades vendidas",
    description: "Propiedades comercializadas entre desarrollos, departamentos y casas.",
  },
  {
    value: 40,
    suffix: "%",
    label: "Retorno promedio",
    description: "Ganancia típica al revender una unidad comprada en pozo.",
  },
  {
    value: 12,
    suffix: "",
    label: "Desarrollos activos",
    description: "Proyectos en construcción o pre-venta disponibles para inversores.",
  },
];

function AnimatedNumber({ 
  value, 
  suffix, 
  isVisible 
}: { 
  value: number; 
  suffix: string; 
  isVisible: boolean;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isVisible) return;

    const duration = 2000;
    const steps = 60;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [isVisible, value]);

  return (
    <span className="font-display font-light text-6xl md:text-7xl lg:text-8xl text-bone tracking-tight">
      {count}
      <span className="text-accent">{suffix}</span>
    </span>
  );
}



export function StatsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="estadisticas"
      className="relative py-24 md:py-32 bg-ink text-bone overflow-hidden"
    >
      {/* Background pattern */}
      <div className="absolute inset-0 bg-grain opacity-20 pointer-events-none" />
      
      {/* Accent lines */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-accent/20 to-transparent" />
        <div className="absolute top-0 left-2/4 w-px h-full bg-gradient-to-b from-transparent via-accent/10 to-transparent" />
        <div className="absolute top-0 left-3/4 w-px h-full bg-gradient-to-b from-transparent via-accent/20 to-transparent" />
      </div>

      <div className="container-custom relative z-10">
        {/* Header */}
        <div
          className={`text-center mb-16 md:mb-20 transition-all duration-1000 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="font-display italic font-light text-xl text-accent">04</span>
            <p className="text-[11px] uppercase tracking-widest text-accent">
              Estadísticas
            </p>
          </div>
          <h2 className="font-display font-light text-[32px] md:text-[48px] lg:text-[64px] tracking-[-0.025em] leading-[1.05] text-bone max-w-3xl mx-auto">
            Números que <span className="italic">respaldan</span> nuestra trayectoria.
          </h2>
        </div>



        {/* Stats grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-6">
          {stats.map((stat, idx) => (
            <div
              key={stat.label}
              className={`text-center md:text-left p-6 md:p-8 border-t border-bone/15 transition-all duration-1000 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
              }`}
              style={{ transitionDelay: `${200 + idx * 150}ms` }}
            >
              <AnimatedNumber
                value={stat.value}
                suffix={stat.suffix}
                isVisible={isVisible}
              />
              <h3 className="mt-4 font-display font-light text-xl text-bone tracking-tight">
                {stat.label}
              </h3>
              <p className="mt-2 text-sm text-bone/60 leading-relaxed">
                {stat.description}
              </p>
            </div>
          ))}
        </div>

        {/* Bottom quote */}
        <div
          className={`mt-16 md:mt-20 pt-12 border-t border-bone/15 text-center transition-all duration-1000 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
          style={{ transitionDelay: "800ms" }}
        >
          <blockquote className="font-display font-light text-2xl md:text-3xl text-bone/80 italic max-w-3xl mx-auto leading-relaxed">
            &ldquo;Invertir en desarrollos es la forma más inteligente de multiplicar tu
            capital en el mercado inmobiliario.&rdquo;
          </blockquote>
          <cite className="block mt-6 text-[11px] uppercase tracking-widest text-accent not-italic">
            — Barrera Brokers
          </cite>
        </div>
      </div>
    </section>
  );
}
