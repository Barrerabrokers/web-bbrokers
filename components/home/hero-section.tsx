import Link from "next/link";
import { ArrowDown } from "lucide-react";

export function HeroSection() {
  return (
    <section
      id="inicio"
      className="relative min-h-screen flex flex-col bg-cream-100 pt-24"
    >
      {/* Top label bar (Studio X style) */}
      <div className="container-custom pt-10 md:pt-16">
        <div className="flex items-baseline justify-between flex-wrap gap-4 pb-8 border-b border-ink/15">
          <span className="text-[11px] uppercase tracking-widest text-ink/60">
            (Real Estate)
          </span>
          <span className="text-[11px] uppercase tracking-widest text-ink/50">
            Buenos Aires &middot; Est. 2000
          </span>
        </div>
      </div>

      {/* Manifest content */}
      <div className="container-custom flex-1 flex items-center py-16 md:py-24">
        <div className="grid grid-cols-12 gap-6 w-full">
          <div className="col-span-12 lg:col-span-10 lg:col-start-1">
            <h1 className="font-display font-light text-ink leading-[0.92] tracking-[-0.025em] text-[44px] sm:text-[64px] md:text-[88px] lg:text-[120px] xl:text-[148px]">
              Disenamos el camino hacia la propiedad{" "}
              <span className="italic font-light">indicada,</span>{" "}
              acompanando cada decision patrimonial.
            </h1>
          </div>
        </div>
      </div>

      {/* Footer block: subtitle + CTAs */}
      <div className="container-custom pb-12">
        <div className="grid grid-cols-12 gap-6 pt-10 border-t border-ink/15">
          <div className="col-span-12 md:col-span-6 lg:col-span-5">
            <p className="text-ink/70 text-base md:text-lg leading-relaxed max-w-md">
              Mas de 20 anos acompanando a quienes buscan invertir, habitar y
              rentabilizar las propiedades mas exclusivas de Buenos Aires
              &mdash; desde primeras inversiones hasta carteras complejas.
            </p>
          </div>

          <div className="col-span-12 md:col-span-6 lg:col-start-9 lg:col-span-4 flex flex-col md:items-end gap-4 justify-between">
            <div className="flex flex-wrap gap-3">
              <Link href="#propiedades" className="btn-primary">
                Ver propiedades
              </Link>
              <Link
                href="#contacto"
                className="btn-outline"
              >
                Hablemos
              </Link>
            </div>

            <a
              href="#propiedades"
              className="inline-flex items-center gap-2 text-[10px] uppercase tracking-widest text-ink/50 hover:text-ink transition-colors"
            >
              Scroll
              <ArrowDown className="h-3.5 w-3.5 animate-bounce" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
