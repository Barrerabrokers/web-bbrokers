import Link from "next/link";
import Image from "next/image";
import { getProperties } from "@/lib/db";
import { formatPrice } from "@/lib/utils";

export async function PropertiesSection() {
  const properties = await getProperties({ status: "disponible" });
  const featured = properties.slice(0, 6);

  return (
    <section id="propiedades" className="py-24 md:py-32 bg-charcoal-50">
      <div className="container-custom">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-20 gap-8">
          <div className="max-w-2xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-px w-12 bg-gold-600" />
              <span className="label-tracking text-gold-600">
                Propiedades Destacadas
              </span>
            </div>
            <h2 className="heading-serif text-4xl md:text-5xl lg:text-6xl text-charcoal-900">
              Una selección
              <br />
              <span className="italic">curada para ti</span>
            </h2>
          </div>
          <Link
            href="/propiedades"
            className="btn-outline whitespace-nowrap self-start md:self-end"
          >
            Ver Catálogo Completo
          </Link>
        </div>

        {/* Properties Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-12">
          {featured.map((property) => (
            <Link
              key={property.id}
              href={`/propiedades/${property.id}`}
              className="group cursor-pointer"
            >
              {/* Image */}
              <div className="relative h-[400px] overflow-hidden mb-6">
                <Image
                  src={property.images[0]}
                  alt={property.title}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-500" />
                
                {/* Category badge */}
                <div className="absolute top-6 left-6">
                  <span className="bg-white/95 backdrop-blur-sm px-4 py-2 label-tracking text-charcoal-900">
                    {property.category}
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="heading-serif text-2xl text-charcoal-900 group-hover:text-gold-600 transition-colors leading-tight">
                    {property.title}
                  </h3>
                </div>
                
                <p className="label-tracking text-charcoal-500">
                  {property.location}
                </p>

                <div className="flex items-center justify-between pt-4 border-t border-charcoal-200">
                  <div className="flex gap-6 text-sm text-charcoal-600">
                    {property.bedrooms && (
                      <span>{property.bedrooms} dorm.</span>
                    )}
                    {property.bathrooms && (
                      <span>{property.bathrooms} baños</span>
                    )}
                    <span>{property.area}m²</span>
                  </div>
                  <span className="heading-serif text-xl text-charcoal-900">
                    {formatPrice(property.price)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
