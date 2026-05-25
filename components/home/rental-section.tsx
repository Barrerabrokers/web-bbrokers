"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Key,
  Sparkles,
  Clock,
  ShieldCheck,
  Users,
  Banknote,
  CheckCircle2,
} from "lucide-react";

/**
 * Rental Section — Airbnb-style temporary rental management
 * 24/7 service, check-in/out, cleaning, linens
 */

const services = [
  {
    icon: Key,
    title: "Check-in & Check-out",
    description: "Recepción de huéspedes las 24 horas, entrega de llaves y atención personalizada.",
  },
  {
    icon: Sparkles,
    title: "Limpieza profesional",
    description: "Limpieza profunda entre estadías, con productos premium y protocolos sanitarios.",
  },
  {
    icon: Clock,
    title: "Atención 24/7",
    description: "Soporte continuo para huéspedes y propietarios. Resolvemos cualquier incidencia.",
  },
  {
    icon: ShieldCheck,
    title: "Ropa blanca",
    description: "Sábanas, toallas y amenities de calidad hotelera incluidos en cada reserva.",
  },
  {
    icon: Users,
    title: "Gestión de reservas",
    description: "Publicamos en Airbnb, Booking y otras plataformas. Maximizamos tu ocupación.",
  },
  {
    icon: Banknote,
    title: "Cobro garantizado",
    description: "Nos encargamos de cobrar, gestionar garantías y transferir tu renta puntualmente.",
  },
];



export function RentalSection() {
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
      id="renta"
      className="relative section-pad bg-ink text-bone overflow-hidden"
    >
      {/* Accent glow */}
      <div
        aria-hidden="true"
        className="absolute top-1/2 right-0 w-[40vw] h-[40vw] max-w-[600px] -translate-y-1/2 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center right, rgba(214,184,92,0.1) 0%, transparent 60%)",
        }}
      />

      <div className="container-custom relative z-10">
        <div className="grid grid-cols-12 gap-6 lg:gap-12 items-center">
          {/* Image */}
          <div
            className={`col-span-12 lg:col-span-6 order-2 lg:order-1 transition-all duration-1000 ${
              isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-12"
            }`}
            style={{ transitionDelay: "200ms" }}
          >


            <div className="relative">
              <div className="relative aspect-[4/5] overflow-hidden rounded-lg">
                <Image
                  src="https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=90"
                  alt="Departamento de renta temporaria"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/50 via-transparent to-transparent" />
              </div>

              {/* Floating card */}
              <div className="absolute -bottom-6 -right-6 md:right-6 bg-accent text-ink p-6 rounded-lg shadow-2xl max-w-[260px]">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-full bg-ink/10 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-ink" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-ink/60">
                      Atención
                    </p>
                    <p className="font-display font-light text-2xl text-ink">24/7</p>
                  </div>
                </div>
                <p className="text-sm text-ink/75">
                  Gestionamos todo para que vos solo cobres la renta.
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="col-span-12 lg:col-span-5 lg:col-start-8 order-1 lg:order-2">
            <div
              className={`transition-all duration-1000 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
            >
              <div className="flex items-baseline gap-3 mb-4">
                <span className="font-display italic font-light text-xl text-accent">
                  03
                </span>
                <p className="text-[11px] uppercase tracking-widest text-accent">
                  Renta temporaria
                </p>
              </div>



              <h2
                className={`font-display font-light text-[32px] md:text-[48px] lg:text-[56px] tracking-[-0.025em] leading-[1.05] text-bone mb-6 transition-all duration-1000 ${
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                }`}
                style={{ transitionDelay: "100ms" }}
              >
                Generá <span className="italic">renta pasiva</span> sin
                complicaciones.
              </h2>

              <p
                className={`text-bone/70 text-base md:text-lg leading-relaxed mb-8 transition-all duration-1000 ${
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                }`}
                style={{ transitionDelay: "200ms" }}
              >
                Si decidís mantener tu unidad después de finalizado el proyecto,
                nosotros nos encargamos de la administración completa tipo Airbnb.
                Check-in, check-out, limpieza, ropa blanca y atención al huésped
                las 24 horas.
              </p>
            </div>

            {/* Services grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {services.map((service, idx) => (
                <div
                  key={service.title}
                  className={`flex items-start gap-3 p-4 border border-bone/15 rounded-lg hover:border-accent/40 transition-all duration-500 ${
                    isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                  }`}
                  style={{ transitionDelay: `${300 + idx * 80}ms` }}
                >
                  <service.icon className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-display font-light text-base text-bone mb-1">
                      {service.title}
                    </h4>
                    <p className="text-xs text-bone/60 leading-relaxed">
                      {service.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>



            {/* CTA */}
            <div
              className={`transition-all duration-1000 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
              style={{ transitionDelay: "700ms" }}
            >
              <Link href="#contacto" className="btn-primary">
                Consultar sobre renta
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
