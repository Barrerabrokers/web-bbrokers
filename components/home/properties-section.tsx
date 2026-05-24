import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Bed, Bath, Square } from "lucide-react";
import { getProperties } from "@/lib/db";
import { formatPrice } from "@/lib/utils";

export async function PropertiesSection() {
  const properties = await getProperties({ status: "disponible" });
  const featured = properties.slice(0, 6);

  return (
    <section
      id="propiedades"
      className="relative section-pad bg-gray-950 overflow-hidden"
    >
      <div className="absolute inset-0 -z-10 bg-glow-accent-bottom" />

      <div className="container-custom">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-14 gap-8">
          <div className="max-w-2xl">
            <span className="eyebrow mb-5">Propiedades destacadas</span>
            <h2 className="mt-5 text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tightest leading-[1.05]">
              <span className="text-gradient">Una seleccion</span>{" "}
              <span className="text-gradient-accent">curada para vos.</span>
            </h2>
          </div>
          <Link
            href="/propiedades"
            className="btn-outline whitespace-nowrap self-start md:self-end"
          >
            Ver catalogo completo
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {featured.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-gray-400">
              Pronto vas a encontrar nuestras propiedades destacadas aqui.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {featured.map((property) => (
              <Link
                key={property.id}
                href={`/propiedades/${property.id}`}
                className="group card-hover overflow-hidden flex flex-col"
              >
                {/* Image */}
                <div className="relative h-64 overflow-hidden">
                  <Image
                    src={property.images[0]}
                    alt={property.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                  {/* Subtle dark overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-950/70 via-transparent to-transparent" />

                  {/* Category pill */}
                  <div className="absolute top-3 left-3">
                    <span className="pill bg-gray-950/70 backdrop-blur-md capitalize">
                      {property.category}
                    </span>
                  </div>

                  {/* Price badge */}
                  <div className="absolute bottom-3 left-3">
                    <span className="text-lg font-semibold tracking-tight text-white drop-shadow-lg">
                      {formatPrice(property.price)}
                    </span>
                  </div>
                </div>

                {/* Body */}
                <div className="p-5 flex flex-col gap-3 flex-1">
                  <div>
                    <h3 className="text-base font-semibold tracking-tight text-gray-50 group-hover:text-white line-clamp-2">
                      {property.title}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500 tracking-tight line-clamp-1">
                      {property.location}
                    </p>
                  </div>

                  {/* Features */}
                  <div className="flex items-center gap-4 mt-auto pt-3 border-t border-gray-800 text-xs text-gray-400">
                    {property.bedrooms ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Bed className="h-3.5 w-3.5" />
                        {property.bedrooms}
                      </span>
                    ) : null}
                    {property.bathrooms ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Bath className="h-3.5 w-3.5" />
                        {property.bathrooms}
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
