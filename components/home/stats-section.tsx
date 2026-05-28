"use client";

import { useEffect, useRef, useState } from "react";

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

function AnimatedNumber({ value, suffix, isVisible }: { value: number; suffix: string; isVisible: boolean }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isVisible) return;
    const duration = 2200;
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
    <span
      className="font-display font-light tracking-[-0.04em] leading-none"
      style={{
        fontSize: "clamp(3.5rem, 6vw, 7rem)",
        color: "var(--oa-white)",
      }}
    >
      {count}
      <span style={{ color: "var(--oa-bg-light)" }}>{suffix}</span>
    </span>
  );
}

export function StatsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.2 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="estadisticas"
      className="relative py-24 md:py-32 overflow-hidden"
      style={{ backgroundColor: "var(--oa-brown)" }}
    >
      {/* Grain */}
      <div className="absolute inset-0 bg-grain opacity-30 pointer-events-none" />

      {/* Círculos decorativos */}
      <div
        className="circle-deco"
        style={{
          width: "700px",
          height: "700px",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          borderColor: "rgba(255,255,255,0.05)",
        }}
      />
      <div
        className="circle-deco"
        style={{
          width: "400px",
          height: "400px",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          borderColor: "rgba(255,255,255,0.04)",
        }}
      />

      {/* Líneas verticales */}
      <div className="absolute inset-0 pointer-events-none">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="absolute top-0 h-full w-px"
            style={{
              left: `${i * 25}%`,
              background: `linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)`,
            }}
          />
        ))}
      </div>

      <div className="container-custom relative z-10">
        {/* Header */}
        <div
          className="text-center mb-16 md:mb-20 transition-all duration-1000"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? "translateY(0)" : "translateY(24px)",
          }}
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <span
              className="font-display italic font-light text-xl"
              style={{ color: "rgba(248,245,239,0.3)" }}
            >
              04
            </span>
            <p
              className="label-tracking"
              style={{ color: "rgba(248,245,239,0.4)" }}
            >
              Estadísticas
            </p>
          </div>
          <h2
            className="font-display font-light tracking-[-0.04em] leading-[0.95] mx-auto"
            style={{
              fontSize: "clamp(2rem, 5vw, 5rem)",
              color: "var(--oa-white)",
              maxWidth: "700px",
            }}
          >
            Números que{" "}
            <em className="not-italic" style={{ color: "var(--oa-bg-light)" }}>
              respaldan
            </em>{" "}
            nuestra trayectoria.
          </h2>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0">
          {stats.map((stat, idx) => (
            <div
              key={stat.label}
              className="p-8 transition-all duration-1000"
              style={{
                borderTop: "1px solid rgba(255,255,255,0.1)",
                borderRight: idx < 3 ? "1px solid rgba(255,255,255,0.06)" : "none",
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? "translateY(0)" : "translateY(24px)",
                transitionDelay: `${180 + idx * 140}ms`,
              }}
            >
              <AnimatedNumber value={stat.value} suffix={stat.suffix} isVisible={isVisible} />
              <h3
                className="mt-4 font-display font-light text-xl tracking-tight"
                style={{ color: "var(--oa-white)" }}
              >
                {stat.label}
              </h3>
              <p
                className="mt-2 text-sm leading-relaxed"
                style={{ color: "rgba(248,245,239,0.45)", fontFamily: "var(--font-sans)" }}
              >
                {stat.description}
              </p>
            </div>
          ))}
        </div>

        {/* Quote */}
        <div
          className="mt-16 md:mt-20 pt-12 text-center transition-all duration-1000"
          style={{
            borderTop: "1px solid rgba(255,255,255,0.08)",
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? "translateY(0)" : "translateY(16px)",
            transitionDelay: "780ms",
          }}
        >
          <blockquote
            className="font-display font-light italic leading-relaxed mx-auto"
            style={{
              fontSize: "clamp(1.3rem, 2.5vw, 2rem)",
              color: "rgba(248,245,239,0.7)",
              maxWidth: "700px",
            }}
          >
            &ldquo;Invertir en desarrollos es la forma más inteligente de multiplicar tu
            capital en el mercado inmobiliario.&rdquo;
          </blockquote>
          <cite
            className="block mt-5 label-tracking not-italic"
            style={{ color: "rgba(248,245,239,0.3)" }}
          >
            — Barrera Brokers
          </cite>
        </div>
      </div>
    </section>
  );
}
