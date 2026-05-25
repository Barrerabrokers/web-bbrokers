import Link from "next/link";

/**
 * Hero — Editorial minimalist style
 *
 * Layout: tagline label arriba, headline manifesto serif italic light en
 * el centro, body + CTAs al fondo. Sobre fondo bone con grain + glow
 * accent sutil. Sin video, sin imagen — composicion tipografica pura.
 */
export function HeroSection() {
  return (
    <section
      id="inicio"
      className="relative min-h-screen flex flex-col bg-bone text-ink overflow-hidden"
    >
      {/* Subtle paper grain */}
      <div className="absolute inset-0 bg-grain pointer-events-none opacity-60" />

      {/* Accent corner glow */}
      <div
        aria-hidden="true"
        className="absolute top-0 right-0 w-[40vw] h-[40vw] max-w-[600px] max-h-[600px] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at top right, rgba(214,184,92,0.18) 0%, transparent 70%)",
        }}
      />

      {/* Top label line */}
      <div className="relative z-10 container-custom pt-24 md:pt-32">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-widest text-ink/65">
          <span>Desarrollos</span>
          <span>Buenos Aires &middot; Est. 2000</span>
        </div>
      </div>

      {/* Manifest content */}
      <div className="relative z-10 container-custom flex-1 flex items-center py-16 md:py-20">
        <div className="grid grid-cols-12 gap-6 w-full">
          <div className="col-span-12 md:col-span-11 lg:col-span-10 lg:col-start-2 animate-fade-in-up">
            <p className="font-display font-light text-ink text-[44px] sm:text-[64px] md:text-[80px] lg:text-[100px] xl:text-[120px] leading-[1.02] tracking-[-0.025em]">
              <span className="block">
                Desarrollos en la <span className="italic">ciudad</span>
              </span>
              <span className="block">
                de Buenos Aires.
              </span>
            </p>

            <p className="mt-12 md:mt-16 max-w-2xl text-ink/75 text-lg md:text-xl leading-relaxed">
              Hace mas de dos decadas trabajamos en venta, alquiler,
              inversion y desarrollos inmobiliarios. Acompanamos cada
              decision patrimonial con un equipo dedicado, conocimiento del
              mercado local y atencion al detalle.
            </p>
          </div>
        </div>
      </div>

      {/* Footer block: CTAs */}
      <div className="relative z-10 container-custom pb-12 md:pb-16">
        <div className="grid grid-cols-12 gap-6 pt-10 border-t border-ink/15">
          <div className="col-span-12 md:col-span-6 lg:col-span-5">
            <p className="text-ink/60 text-sm leading-relaxed max-w-md">
              Una seleccion de propiedades, servicios de tasacion,
              asesoramiento de inversion y gestion de alquileres en CABA y
              alrededores.
            </p>
          </div>

          <div className="col-span-12 md:col-span-5 md:col-start-8 flex flex-col md:items-end gap-4">
            <div className="flex flex-wrap gap-3">
              <Link href="#propiedades" className="btn-primary">
                Ver propiedades
              </Link>
              <Link href="#contacto" className="btn-outline">
                Hablemos
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
