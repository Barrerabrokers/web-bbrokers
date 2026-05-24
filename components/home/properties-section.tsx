import Link from "next/link";
import Image from "next/image";
import { Bed, Bath, Square, ArrowUpRight } from "lucide-react";
import { getProperties } from "@/lib/db";
import { formatPrice } from "@/lib/utils";

export async function PropertiesSection() {
  const properties = await getProperties({ status: "disponible" });
  const featured = properties.slice(0, 6);

  return (
    <section
      id="propiedades"
      className="relative py-24 md:py-32 lg:py-40 bg-white"
    >
      <div className="container-custom">
        {/* Section header - luxury centered */}
        <div className="text-center max-w-3xl mx-auto mb-16 md:mb-20">
          <span className="eyebrow mb-6">Featured Listings</span>
          <h2 className="lp-h2 mt-6 mb-6">
            Propiedades <span className="italic">destacadas</span>
          </h2>
          <p className="text-ink/65 text-base md:text-lg leading-relaxed">
            Una seleccion curada de las propiedades mas exclusivas en venta y
            alquiler en Buenos Aires.
          </p>
        </div>

        {featured.length === 0 ? (
          <div className="text-center py-16 border-t border-ink/10">
            <p className="text-ink/60 text-lg">
              Pronto vas a encontrar nuestras propiedades destacadas aqui.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
            {featured.map((property) => (
              <Link
                key={property.id}
                href={`/propiedades/${property.id}`}
                className="group block"
              >
                <div className="relative aspect-[4/5] mb-5 overflow-hidden bg-cream-200">
                  <Image
                    src={property.images[0]}
                    alt={property.title}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                  <div className="absolute top-5 left-5">
                    <span className="text-[10px] uppercase tracking-widest text-white bg-ink/40 backdrop-blur-sm px-3 py-1.5 rounded-full">
                      {property.category}
                    </span>
                  </div>
                  <div className="absolute top-5 right-5 h-10 w-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                    <ArrowUpRight className="h-4 w-4 text-ink" />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-widest text-accent">
                    {property.location}
                  </p>

                  <h3 className="font-display font-normal text-2xl md:text-[28px] leading-[1.1] tracking-[-0.01em] text-ink line-clamp-2 pt-1">
                    {property.title}
                  </h3>

                  <div className="flex items-baseline justify-between gap-3 pt-3 border-t border-ink/10">
                    <span className="font-display text-xl text-ink">
                      {formatPrice(property.price)}
                    </span>
                    <div className="flex items-center gap-3 text-[11px] text-ink/55">
                      {property.bedrooms ? (
                        <span className="inline-flex items-center gap-1">
                          <Bed className="h-3 w-3" />
                          {property.bedrooms}
                        </span>
                      ) : null}
                      {property.bathrooms ? (
                        <span className="inline-flex items-center gap-1">
                          <Bath className="h-3 w-3" />
                          {property.bathrooms}
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-1">
                        <Square className="h-3 w-3" />
                        {property.area}m2
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* CTA bottom */}
        <div className="text-center mt-16 md:mt-20">
          <Link href="/propiedades" className="btn-outline">
            Ver todas las propiedades
          </Link>
        </div>
      </div>
    </section>
  );
}
