"use client";

import { useEffect, useRef, useState } from "react";
import { 
  Wallet, 
  TrendingUp, 
  Home, 
  Building2, 
  ArrowRight,
  CheckCircle2 
} from "lucide-react";
import Link from "next/link";

/**
 * Investment Model Section — Explains the business model
 * 35% down payment, installments, 30-40% return, rental option
 */

const steps = [
  {
    no: "01",
    icon: Wallet,
    title: "Ingresá con el 35%",
    description:
      "Reservá tu unidad con un anticipo inicial del 35% del valor. Asegurás precio de pozo y comenzás a capitalizar desde el día uno.",
    highlight: "Anticipo inicial",
    value: "35%",
  },
  {
    no: "02",
    icon: Building2,
    title: "Financiá el saldo",
    description:
      "El 65% restante lo pagás en cuotas durante la construcción. Planes flexibles adaptados a tu capacidad de ahorro.",
    highlight: "Saldo en cuotas",
    value: "65%",
  },
  {
    no: "03",
    icon: TrendingUp,
    title: "Revendé con ganancia",
    description:
      "Una vez finalizado el proyecto, vendé tu unidad en el mercado. La diferencia entre precio de pozo y valor terminado genera retornos del 30-40%.",
    highlight: "Retorno estimado",
    value: "30-40%",
  },
  {
    no: "04",
    icon: Home,
    title: "O generá renta pasiva",
    description:
      "Si preferís mantener la propiedad, nosotros la administramos como alquiler temporario tipo Airbnb. Vos cobrás, nosotros nos encargamos de todo.",
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
      id="modelo"
      className="relative section-pad bg-bone text-ink overflow-hidden"
    >
      {/* Background accents */}
      <div className="absolute inset-0 bg-grain opacity-40 pointer-events-none" />
      <div
        aria-hidden="true"
        className="absolute top-0 right-0 w-[50vw] h-[50vw] max-w-[700px] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at top right, rgba(214,184,92,0.15) 0%, transparent 60%)",
        }}
      />

      <div className="container-custom relative z-10">
        {/* Section header */}
        <div className="grid grid-cols-12 gap-6 mb-16 md:mb-24">
          <div className="col-span-12 md:col-span-1">
            <p
              className={`font-display italic font-light text-xl md:text-2xl text-ink/40 transition-all duration-1000 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              02
            </p>
          </div>



          <div className="col-span-12 md:col-span-7 md:col-start-3">
            <p
              className={`text-[11px] uppercase tracking-widest text-accent mb-4 transition-all duration-1000 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
              style={{ transitionDelay: "100ms" }}
            >
              Modelo de inversión
            </p>
            <h2
              className={`font-display font-light text-[36px] md:text-[56px] lg:text-[72px] tracking-[-0.025em] leading-[1.02] text-ink transition-all duration-1000 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: "200ms" }}
            >
              Cómo funciona la{" "}
              <span className="italic">inversión</span> en desarrollos.
            </h2>
          </div>

          <div className="col-span-12 md:col-span-3 md:col-start-10 flex items-end">
            <p
              className={`text-ink/65 text-base leading-relaxed transition-all duration-1000 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
              }`}
              style={{ transitionDelay: "300ms" }}
            >
              Un proceso simple y transparente. Desde el anticipo hasta la renta
              o reventa, te acompañamos en cada paso.
            </p>
          </div>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          {steps.map((step, idx) => (
            <div
              key={step.no}
              className={`group relative p-6 md:p-8 border border-ink/15 rounded-lg hover:border-accent/50 transition-all duration-700 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
              }`}
              style={{ transitionDelay: `${400 + idx * 100}ms` }}
            >


              {/* Step number */}
              <div className="flex items-center justify-between mb-6">
                <span className="font-display italic font-light text-xl text-accent">
                  {step.no}
                </span>
                <step.icon className="h-6 w-6 text-ink/40 group-hover:text-accent transition-colors duration-500" />
              </div>

              {/* Value highlight */}
              <div className="mb-4">
                <p className="text-[10px] uppercase tracking-widest text-ink/50 mb-1">
                  {step.highlight}
                </p>
                <div className="font-display font-light text-4xl md:text-5xl text-ink tracking-tight">
                  {step.value}
                </div>
              </div>

              {/* Content */}
              <h3 className="font-display font-light text-xl text-ink mb-3 tracking-tight group-hover:italic transition-all duration-500">
                {step.title}
              </h3>
              <p className="text-sm text-ink/65 leading-relaxed">
                {step.description}
              </p>

              {/* Arrow connector (hidden on mobile and last item) */}
              {idx < steps.length - 1 && (
                <div className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                  <ArrowRight className="h-5 w-5 text-accent" />
                </div>
              )}
            </div>
          ))}
        </div>



        {/* Benefits + CTA */}
        <div
          className={`grid grid-cols-12 gap-6 pt-16 border-t border-ink/15 transition-all duration-1000 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
          style={{ transitionDelay: "800ms" }}
        >
          <div className="col-span-12 lg:col-span-6">
            <h3 className="font-display font-light text-2xl md:text-3xl text-ink mb-8 tracking-tight">
              Todo lo que incluye <span className="italic">invertir</span> con
              nosotros.
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {benefits.map((benefit, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-accent flex-shrink-0" />
                  <span className="text-ink/75">{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="col-span-12 lg:col-span-5 lg:col-start-8">
            <div className="bg-ink text-bone p-8 md:p-10 rounded-lg">
              <p className="text-[11px] uppercase tracking-widest text-accent mb-4">
                Comenzá ahora
              </p>
              <h4 className="font-display font-light text-2xl md:text-3xl text-bone mb-4 tracking-tight">
                ¿Querés saber más sobre oportunidades de inversión?
              </h4>
              <p className="text-bone/70 text-sm mb-6 leading-relaxed">
                Agendá una llamada con nuestro equipo. Te explicamos las opciones
                disponibles, los planes de financiación y respondemos todas tus
                consultas.
              </p>
              <Link href="#contacto" className="btn-primary w-full justify-center">
                Agendar consulta
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
