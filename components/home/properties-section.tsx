import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { getProperties } from "@/lib/db";
import { formatPrice } from "@/lib/utils";
import { Reveal } from "@/components/ui/reveal";

export async function PropertiesSection() {
  const properties = await getProperties({ status: "disponible" });
  const featured = properties.slice(0, 6);

  return (
    <section
      id="propiedades"
      className="relative section-pad bg-bone text-ink border-t border-ink/15"
    >
      <div className="container-custom">
        {/* Section header */}
        <div className="grid grid-cols-12 gap-6 mb-16 md:mb-24">
          <div className="col-span-12 md:col-span-1">
            <Reveal variant="fade-up" duration={900}>
              <p className="font-display italic font-light text-xl md:text-2xl text-ink/40">
                01
              </p>
            </Reveal>
          </div>

          <div className="col-span-12 md:col-span-6 lg:col-span-6 md:col-start-3">
            <Reveal variant="fade-up" delay={100} duration={1000}>
              <p className="text-[11px] uppercase tracking-widest text-accent-700 mb-4">
                Propiedades
              </p>
            </Reveal>
            <Reveal variant="clip-up" delay={200} duration={1500}>
              <h2 className="font-display font-light text-[40px] md:text-[64px] lg:text-[80px] tracking-[-0.025em] leading-[1.02] text-ink">
                Una seleccion de propiedades{" "}
                <span className="italic">disponibles</span> en Buenos Aires.
              </h2>
            </Reveal>
          </div>

          <div className="col-span-12 md:col-span-3 md:col-start-10 flex items-end">
            <Reveal variant="fade-up" delay={400} duration={1200}>
              <p className="text-ink/65 text-base leading-relaxed">
                Departamentos, casas y desarrollos en venta y alquiler.
                Cada propiedad presentada con sus datos clave y galeria
                completa.
              </p>
            </Reveal>
          </div>
        </div>

        {featured.length === 0 ? (
          <div className="py-20 text-center border-t border-ink/15">
            <p className="text-ink/55 text-lg">
              Pronto vas a encontrar nuestras propiedades destacadas aqui.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-16">
            {featured.map((property, idx) => (
              <Reveal
                key={property.id}
                variant="fade-up"
                delay={idx * 100}
                duration={1300}
              >
                <Link
                  href={`/propiedades/${property.id}`}
                  className="group block"
                >
                  <div className="relative aspect-[4/5] mb-5 overflow-hidden bg-cream-200">
                    <Image
                      src={property.images[0]}
                      alt={property.title}
                      fill
                      className="object-cover transition-transform duration-1500 group-hover:scale-[1.05]"
                      style={{ transitionTimingFunction: "var(--f-cubic)" }}
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                    <div className="absolute top-3 left-3 flex items-center gap-2.5 text-bone">
                      <span className="font-display italic font-light text-2xl">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <div className="absolute top-3 right-3 h-9 w-9 rounded-full bg-accent flex items-center justify-center opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all duration-900">
                      <ArrowUpRight className="h-4 w-4 text-ink" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-widest text-ink/50">
                      {property.location} &middot; {property.category}
                    </p>

                    <h3 className="font-display font-light text-2xl md:text-3xl leading-[1.05] tracking-[-0.01em] text-ink line-clamp-2 pt-1 group-hover:italic transition-all duration-900">
                      {property.title}
                    </h3>

                    <div className="flex items-baseline justify-between gap-3 pt-3 border-t border-ink/15">
                      <span className="font-display text-xl text-ink">
                        {formatPrice(property.price)}
                      </span>
                      <span className="text-[11px] uppercase tracking-widest text-ink/55">
                        {property.area}m2
                      </span>
                    </div>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        )}

        {/* CTA bottom */}
        <div className="text-center mt-16 md:mt-24 pt-12 border-t border-ink/15">
          <Link href="/propiedades" className="btn-outline">
            Ver catalogo completo
          </Link>
        </div>
      </div>
    </section>
  );
}
