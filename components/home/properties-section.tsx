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
      className="relative py-20 md:py-28 lg:py-36 bg-cream-100 border-t border-ink/15"
    >
      <div className="container-custom">
        {/* Editorial header (Studio X style with parens label) */}
        <div className="flex items-baseline justify-between flex-wrap gap-6 pb-12 border-b border-ink/15 mb-16 md:mb-20">
          <div className="flex items-baseline gap-6 md:gap-10">
            <span className="font-display italic font-light text-3xl md:text-4xl text-ink/40">
              (01)
            </span>
            <h2 className="font-display font-light text-4xl md:text-6xl lg:text-7xl tracking-[-0.025em] leading-[1] text-ink">
              <span className="italic">Featured</span> Propiedades
            </h2>
          </div>
          <Link
            href="/propiedades"
            className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-ink hover:text-accent transition-colors group whitespace-nowrap"
          >
            <span className="link-underline">Ver todas</span>
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>

        {featured.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-ink/60 text-lg">
              Pronto vas a encontrar nuestras propiedades destacadas aqui.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-14">
            {featured.map((property, idx) => (
              <Link
                key={property.id}
                href={`/propiedades/${property.id}`}
                className="group block"
              >
                {/* Image */}
                <div className="relative aspect-[4/5] mb-5 overflow-hidden bg-cream-300">
                  <Image
                    src={property.images[0]}
                    alt={property.title}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                  <div className="absolute top-4 left-4">
                    <span className="text-[10px] uppercase tracking-widest text-cream-100 bg-ink/30 backdrop-blur-sm px-2.5 py-1">
                      ({String(idx + 1).padStart(2, "0")})
                    </span>
                  </div>
                  <div className="absolute top-4 right-4">
                    <ArrowUpRight className="h-5 w-5 text-cream-100 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-300" />
                  </div>
                </div>

                {/* Caption block */}
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-3 pb-2 border-b border-ink/15">
                    <span className="text-[10px] uppercase tracking-widest text-ink/50">
                      {property.category}
                    </span>
                    <span className="text-[10px] uppercase tracking-widest text-ink/50 tabular-nums">
                      {property.area}m2
                    </span>
                  </div>

                  <h3 className="font-display font-light text-2xl md:text-3xl leading-[1.05] tracking-[-0.02em] text-ink line-clamp-2">
                    {property.title}
                  </h3>

                  <div className="flex items-baseline justify-between gap-3 pt-1">
                    <p className="text-sm text-ink/55">
                      {property.location}
                    </p>
                    <span className="font-display text-lg md:text-xl text-ink whitespace-nowrap">
                      {formatPrice(property.price)}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 pt-2 text-[11px] uppercase tracking-widest text-ink/55">
                    {property.bedrooms ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Bed className="h-3 w-3" />
                        {property.bedrooms} dorm
                      </span>
                    ) : null}
                    {property.bathrooms ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Bath className="h-3 w-3" />
                        {property.bathrooms} ban
                      </span>
                    ) : null}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
