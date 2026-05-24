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
      className="relative section-pad bg-cream-200 overflow-hidden"
    >
      <div className="container-custom">
        {/* Editorial section header (asymmetric) */}
        <div className="grid grid-cols-12 gap-6 mb-16 md:mb-24">
          <div className="col-span-12 md:col-span-1">
            <span className="number-marker">01.</span>
          </div>
          <div className="col-span-12 md:col-span-7">
            <p className="eyebrow mb-6">Propiedades destacadas</p>
            <h2 className="font-display text-[56px] md:text-[88px] lg:text-[112px] leading-[0.95] tracking-tightest text-ink">
              Una seleccion
              <br />
              <span className="italic-display">curada para vos.</span>
            </h2>
          </div>
          <div className="col-span-12 md:col-span-3 md:col-start-10 flex flex-col justify-end">
            <p className="text-ink/70 leading-relaxed mb-6 text-base md:text-lg">
              Cada propiedad de nuestro catalogo es elegida con atencion al
              detalle, la ubicacion y el potencial de inversion.
            </p>
            <Link
              href="/propiedades"
              className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-ink hover:text-accent transition-colors group self-start"
            >
              <span className="link-underline">Ver catalogo completo</span>
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </div>
        </div>

        {featured.length === 0 ? (
          <div className="border-t border-ink/15 pt-16 text-center">
            <p className="text-ink/60 text-lg">
              Pronto vas a encontrar nuestras propiedades destacadas aqui.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-16">
            {featured.map((property, idx) => (
              <Link
                key={property.id}
                href={`/propiedades/${property.id}`}
                className="group block"
              >
                {/* Image with editorial number caption */}
                <div className="relative h-[420px] mb-6 overflow-hidden bg-cream-300">
                  <Image
                    src={property.images[0]}
                    alt={property.title}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                  <div className="absolute top-5 left-5 flex items-center gap-3 text-cream-100">
                    <span className="font-display text-2xl">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <span className="h-px w-6 bg-cream-100/70" />
                    <span className="text-[10px] uppercase tracking-widest">
                      {property.category}
                    </span>
                  </div>
                  <div className="absolute top-5 right-5">
                    <ArrowUpRight className="h-5 w-5 text-cream-100 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-300" />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className="font-display text-2xl md:text-3xl leading-tight tracking-tight text-ink line-clamp-2 flex-1">
                      {property.title}
                    </h3>
                    <span className="font-display text-xl md:text-2xl text-ink whitespace-nowrap">
                      {formatPrice(property.price)}
                    </span>
                  </div>

                  <p className="text-sm text-ink/55 tracking-tight">
                    {property.location}
                  </p>

                  <div className="flex items-center gap-5 pt-3 border-t border-ink/10 text-xs text-ink/60">
                    {property.bedrooms ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Bed className="h-3.5 w-3.5" />
                        {property.bedrooms} dorm
                      </span>
                    ) : null}
                    {property.bathrooms ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Bath className="h-3.5 w-3.5" />
                        {property.bathrooms} ban
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1.5 ml-auto">
                      <Square className="h-3.5 w-3.5" />
                      {property.area}m2
                    </span>
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
