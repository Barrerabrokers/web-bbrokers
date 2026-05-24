import Link from "next/link";

/**
 * Hero — Obsidian Assembly style
 *
 * Estructura: pequeño label "Coordinates" en topcenter + headline manifesto
 * gigante en serif italic + body manifesto declarativo en serif + CTAs.
 *
 * Sobre fondo bone (warm off-white) con grain texture para sensación
 * editorial. Sin video.
 */
export function HeroSection() {
  return (
    <section
      id="inicio"
      className="relative min-h-screen flex flex-col bg-bone text-ink overflow-hidden"
    >
      {/* Subtle paper grain */}
      <div className="absolute inset-0 bg-grain pointer-events-none opacity-60" />

      {/* Yellow accent corner mark (signature) */}
      <div
        aria-hidden="true"
        className="absolute top-0 right-0 w-[40vw] h-[40vw] max-w-[600px] max-h-[600px] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at top right, rgba(212,185,78,0.18) 0%, transparent 70%)",
        }}
      />

      {/* Top brand line */}
      <div className="relative z-10 container-custom pt-24 md:pt-32">
        <div className="flex items-center justify-between">
          <p className="font-display font-light text-2xl md:text-3xl text-ink tracking-tight">
            Coordinates
          </p>
          <p className="font-display italic font-light text-2xl md:text-3xl text-ink tracking-tight">
            A Private Assembly
          </p>
        </div>
      </div>

      {/* Manifest content */}
      <div className="relative z-10 container-custom flex-1 flex items-center py-16 md:py-20">
        <div className="grid grid-cols-12 gap-6 w-full">
          <div className="col-span-12 md:col-span-10 lg:col-span-9 lg:col-start-2 animate-fade-in-up">
            <p className="font-display font-light text-ink text-[44px] sm:text-[64px] md:text-[80px] lg:text-[100px] xl:text-[120px] leading-[1.02] tracking-[-0.025em]">
              <span className="block">
                Barrera Brokers coordina <span className="italic">propiedades</span>
              </span>
              <span className="block">
                e <span className="italic">inversiones</span> a traves de
              </span>
              <span className="block">Buenos Aires.</span>
            </p>
          </div>
        </div>
      </div>

      {/* Footer block: subtitle + CTAs */}
      <div className="relative z-10 container-custom pb-12 md:pb-16">
        <div className="grid grid-cols-12 gap-6 pt-10 border-t border-ink/15">
          <div className="col-span-12 md:col-span-6 lg:col-span-5">
            <p className="text-ink/75 text-base md:text-lg leading-relaxed max-w-md">
              Una seleccion curada de propiedades, mantenida con discrecion.
              Su presencia es intencional, modelada por la ubicacion mas que
              por la visibilidad. El acceso es considerado, no asumido.
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

        <div className="mt-8 flex items-baseline justify-between text-[10px] uppercase tracking-widest text-ink/55">
          <span>Buenos Aires</span>
          <span>Est. 2000</span>
        </div>
      </div>
    </section>
  );
}
