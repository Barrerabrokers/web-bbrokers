import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";

const services = [
  {
    title: "Sales",
    titleEs: "Ventas",
    description:
      "Asesoramiento integral en compraventa de propiedades en Buenos Aires. Desde primera vivienda hasta inversiones de gran escala.",
    image:
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=90",
    href: "/propiedades?categoria=usados",
  },
  {
    title: "Rentals",
    titleEs: "Alquileres",
    description:
      "Renta temporaria y permanente en las ubicaciones mas cotizadas de la ciudad. Acompanamiento end-to-end al propietario y al inquilino.",
    image:
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=90",
    href: "/propiedades?categoria=rentals",
  },
  {
    title: "Home Valuation",
    titleEs: "Tasaciones",
    description:
      "Valuacion profesional de tu propiedad basada en comparables del mercado, ubicacion y condiciones especificas del activo.",
    image:
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=90",
    href: "/#contacto",
  },
];

export function ServicesSection() {
  return (
    <section
      id="servicios"
      className="relative py-24 md:py-32 lg:py-40 bg-cream-100"
    >
      <div className="container-custom">
        {/* Section header */}
        <div className="text-center max-w-3xl mx-auto mb-16 md:mb-20">
          <span className="eyebrow mb-6">Our Services</span>
          <h2 className="lp-h2 mt-6 mb-6">
            Como podemos <span className="italic">ayudarte</span>
          </h2>
          <p className="text-ink/65 text-base md:text-lg leading-relaxed">
            Especialistas en cada operacion inmobiliaria. Asesoramiento
            integral adaptado a tus objetivos.
          </p>
        </div>

        {/* Services grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {services.map((service) => (
            <Link
              key={service.title}
              href={service.href}
              className="group block bg-white rounded-lg overflow-hidden border border-ink/10 hover:border-accent/50 transition-all duration-300"
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={service.image}
                  alt={service.title}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-ink/40" />
                <div className="absolute top-5 right-5 h-10 w-10 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                  <ArrowUpRight className="h-4 w-4 text-ink" />
                </div>
              </div>

              <div className="p-7 md:p-8">
                <p className="text-[11px] uppercase tracking-widest text-accent mb-3">
                  {service.title}
                </p>
                <h3 className="font-display font-normal text-3xl md:text-4xl text-ink mb-4 leading-tight tracking-[-0.01em]">
                  {service.titleEs}
                </h3>
                <p className="text-ink/65 text-sm leading-relaxed">
                  {service.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
