import Link from "next/link";
import { MapPin, Bed, Bath, Square, ArrowRight } from "lucide-react";
import { getProperties } from "@/lib/db";
import { formatPrice } from "@/lib/utils";

export async function PropertiesSection() {
  const properties = await getProperties({ status: "disponible" });
  const featured = properties.slice(0, 6);

  return (
    <section id="propiedades" className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-primary-600 font-semibold mb-2 block">
            Propiedades Destacadas
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Encuentra tu próximo hogar
          </h2>
          <p className="text-lg text-gray-600">
            Explora nuestra selección curada de las mejores propiedades disponibles.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {featured.map((property) => (
            <Link
              key={property.id}
              href={`/propiedades/${property.id}`}
              className="group bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300"
            >
              <div className="relative h-64 overflow-hidden">
                <img
                  src={property.images[0]}
                  alt={property.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                />
                <div className="absolute top-4 left-4">
                  <span className="bg-primary-600 text-white px-3 py-1 rounded-full text-sm font-semibold capitalize">
                    {property.category}
                  </span>
                </div>
                <div className="absolute top-4 right-4">
                  <span className="bg-white/95 backdrop-blur-sm text-gray-900 px-3 py-1 rounded-full text-sm font-bold">
                    {formatPrice(property.price)}
                  </span>
                </div>
              </div>

              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-primary-600 transition-colors">
                  {property.title}
                </h3>
                
                <div className="flex items-center text-gray-600 mb-4">
                  <MapPin className="h-4 w-4 mr-1" />
                  <span className="text-sm">{property.location}</span>
                </div>

                <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                  {property.description}
                </p>

                <div className="flex items-center justify-between text-sm text-gray-600 pt-4 border-t">
                  {property.bedrooms && (
                    <div className="flex items-center">
                      <Bed className="h-4 w-4 mr-1" />
                      <span>{property.bedrooms}</span>
                    </div>
                  )}
                  {property.bathrooms && (
                    <div className="flex items-center">
                      <Bath className="h-4 w-4 mr-1" />
                      <span>{property.bathrooms}</span>
                    </div>
                  )}
                  <div className="flex items-center">
                    <Square className="h-4 w-4 mr-1" />
                    <span>{property.area}m²</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="text-center">
          <Link
            href="/propiedades"
            className="inline-flex items-center space-x-2 bg-primary-600 text-white px-8 py-4 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
          >
            <span>Ver Todas las Propiedades</span>
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
