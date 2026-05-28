"use client";

import { useEffect, useRef, useState } from "react";
import { Wallet, TrendingUp, Home, Building2, ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";

const steps = [
  {
    no: "01",
    icon: Wallet,
    title: "Ingresá con el 35%",
    description: "Reservá tu unidad con un anticipo inicial del 35% del valor. Asegurás precio de pozo y comenzás a capitalizar desde el día uno.",
    highlight: "Anticipo inicial",
    value: "35%",
  },
  {
    no: "02",
    icon: Building2,
    title: "Financiá el saldo",
    description: "El 65% restante lo pagás en cuotas durante la construcción. Planes flexibles adaptados a tu capacidad de ahorro.",
    highlight: "Saldo en cuotas",
    value: "65%",
  },
  {
    no: "03",
    icon: TrendingUp,
    title: "Revendé con ganancia",
    description: "Una vez finalizado el proyecto, vendé tu unidad en el mercado. La diferencia genera retornos del 30–40%.",
    highlight: "Retorno estimado",
    value: "30–40%",
  },
  {
    no: "04",
    icon: Home,
    title: "O generá renta pasiva",
    description: "Si preferís mantener la propiedad, nosotros la administramos como alquiler temporario. Vos cobrás, nosotros nos encargamos.",
    highlight: "Renta mensual",
    value: "24/7",
  },
];

const benefits = [
  "Precio de pozo garantizado",
  "Asesoramiento legal incluido",
  "Seguimiento de obra en tiempo real",
  "Sin comisiones ocultas",
  "Gestión de reventa o alquiler",
  "Soporte post-entrega",
];

export function InvestmentModelSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="modelo"
      className="relative section-pad overflow-hidden"
      style={{ backgroundColor: "var(--oa-white)" }}
    >
      {/* Grain */}
      <div className="absolute inset-0 bg-grain opacity-50 pointer-events-none" />

      {/* Círculo decorativo esquina */}
      <div
        className="circle-deco"
        style={{
          width: "500px",
          height: "500px",
          top: "-120px",
          right: "-120px",
          borderColor: "rgba(58,29,23,0.06)",
        }}
      />

      <div className="container-custom relative z-10">
        {/* ── HEADER ── */}
        <div className="grid grid-cols-12 gap-6 mb-16 md:mb-24">
          <div className="col-span-12 md:col-span-1">
            <p
              className="font-display italic font-light text-xl md:text-2xl"
              style={{ color: "rgba(7,7,7,0.2)" }}
            >
              02
            </p>
          </div>
          <div className="col-span-12 md:col-span-7 md:col-start-3">
            <p
              className="label-tracking mb-4 transition-all duration-700"
              style={{
                color: "var(--oa-brown)",
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? "translateY(0)" : "translateY(12px)",
              }}
            >
              Modelo de inversión
            </p>
            <h2
              className="font-display font-light leading-[1] tracking-[-0.04em] transition-all duration-1000"
              style={{
                fontSize: "clamp(2.2rem, 5vw, 5rem)",
                color: "var(--oa-black)",
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? "translateY(0)" : "translateY(20px)",
                transitionDelay: "120ms",
              }}
            >
              Cómo funciona la{" "}
              <em className="not-italic" style={{ color: "var(--oa-brown)" }}>
                inversión
              </em>{" "}
              en desarrollos.
            </h2>
          </div>
          <div className="col-span-12 md:col-span-3 md:col-start-10 flex items-end">
            <p
              className="text-sm leading-relaxed transition-all duration-800"
              style={{
                color: "rgba(7,7,7,0.55)",
                fontFamily: "var(--font-sans)",
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? "translateY(0)" : "translateY(12px)",
                transitionDelay: "200ms",
              }}
            >
              Un proceso simple y transparente. Desde el anticipo hasta la renta
              o reventa, te acompañamos en cada paso.
            </p>
          </div>
        </div>

        {/* ── STEPS GRID ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-20">
          {steps.map((step, idx) => (
            <div
              key={step.no}
              className="group relative p-7 transition-all duration-700"
              style={{
                backgroundColor: "var(--oa-bg-cream)",
                borderRadius: "18px",
                border: "1px solid rgba(7,7,7,0.07)",
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? "translateY(0) rotate(0deg)" : "translateY(24px)",
                transitionDelay: `${300 + idx * 100}ms`,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "translateY(-4px) rotate(-0.5deg) scale(1.02)";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 20px 60px rgba(7,7,7,0.08)";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(58,29,23,0.18)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "translateY(0) rotate(0deg) scale(1)";
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(7,7,7,0.07)";
              }}
            >
              {/* Step number + icon */}
              <div className="flex items-center justify-between mb-6">
                <span
                  className="font-display italic font-light text-xl"
                  style={{ color: "var(--oa-brown)", opacity: 0.6 }}
                >
                  {step.no}
                </span>
                <step.icon
                  className="h-5 w-5 transition-colors duration-500"
                  style={{ color: "rgba(7,7,7,0.3)" }}
                />
              </div>

              {/* Value */}
              <div className="mb-4">
                <p
                  className="text-[9px] uppercase tracking-[0.18em] mb-1"
                  style={{ color: "rgba(7,7,7,0.4)", fontFamily: "var(--font-sans)" }}
                >
                  {step.highlight}
                </p>
                <div
                  className="font-display font-light leading-none tracking-[-0.03em]"
                  style={{ fontSize: "clamp(2rem, 4vw, 3rem)", color: "var(--oa-black)" }}
                >
                  {step.value}
                </div>
              </div>

              {/* Title + description */}
              <h3
                className="font-display font-light text-xl mb-2 tracking-tight transition-all duration-500 group-hover:italic"
                style={{ color: "var(--oa-black)" }}
              >
                {step.title}
              </h3>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "rgba(7,7,7,0.55)", fontFamily: "var(--font-sans)" }}
              >
                {step.description}
              </p>

              {/* Conector */}
              {idx < steps.length - 1 && (
                <div className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                  <ArrowRight className="h-4 w-4" style={{ color: "var(--oa-brown)", opacity: 0.4 }} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── BENEFITS + CTA ── */}
        <div
          className="grid grid-cols-12 gap-6 pt-16 transition-all duration-1000"
          style={{
            borderTop: "1px solid rgba(7,7,7,0.08)",
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? "translateY(0)" : "translateY(20px)",
            transitionDelay: "800ms",
          }}
        >
          <div className="col-span-12 lg:col-span-6">
            <h3
              className="font-display font-light leading-tight mb-8 tracking-[-0.025em]"
              style={{ fontSize: "clamp(1.6rem, 3vw, 2.4rem)", color: "var(--oa-black)" }}
            >
              Todo lo que incluye{" "}
              <em className="not-italic" style={{ color: "var(--oa-brown)" }}>
                invertir
              </em>{" "}
              con nosotros.
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {benefits.map((benefit, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: "var(--oa-brown)" }}
                  />
                  <span
                    className="text-sm"
                    style={{ color: "rgba(7,7,7,0.65)", fontFamily: "var(--font-sans)" }}
                  >
                    {benefit}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="col-span-12 lg:col-span-5 lg:col-start-8">
            <div
              className="p-8 md:p-10"
              style={{
                backgroundColor: "var(--oa-brown)",
                borderRadius: "18px",
              }}
            >
              <p
                className="label-tracking mb-4"
                style={{ color: "rgba(248,245,239,0.5)" }}
              >
                Comenzá ahora
              </p>
              <h4
                className="font-display font-light mb-4 tracking-tight leading-tight"
                style={{
                  fontSize: "clamp(1.4rem, 2.5vw, 2rem)",
                  color: "var(--oa-white)",
                }}
              >
                ¿Querés conocer las oportunidades disponibles?
              </h4>
              <p
                className="text-sm mb-7 leading-relaxed"
                style={{ color: "rgba(248,245,239,0.6)", fontFamily: "var(--font-sans)" }}
              >
                Agendá una llamada con nuestro equipo. Te explicamos las opciones,
                planes de financiación y respondemos todas tus consultas.
              </p>
              <Link
                href="#contacto"
                className="w-full justify-center inline-flex items-center gap-2 px-7 py-3.5 pr-10 rounded-full text-[10px] uppercase tracking-[0.18em] font-medium relative transition-all duration-500"
                style={{
                  background: "var(--oa-white)",
                  color: "var(--oa-black)",
                  border: "1px solid rgba(248,245,239,0.15)",
                  fontFamily: "var(--font-sans)",
                }}
              >
                Agendar consulta
                <span
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
                  style={{ background: "var(--oa-brown)" }}
                />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
