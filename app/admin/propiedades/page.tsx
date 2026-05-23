import Link from "next/link";
import Image from "next/image";
import { Plus, Building2 } from "lucide-react";
import { getProperties } from "@/lib/db";
import { formatPrice } from "@/lib/utils";
import { PropertyActions } from "@/components/admin/property-actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PropertiesAdminPage() {
  const properties = await getProperties();

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="heading-serif text-3xl text-charcoal-900 mb-2">
            Propiedades
          </h1>
          <p className="text-charcoal-500">
            Gestiona todas las propiedades del catalogo
          </p>
        </div>
        <Link
          href="/admin/propiedades/nueva"
          className="flex items-center space-x-2 btn-primary"
        >
          <Plus className="h-5 w-5" />
          <span>Nueva Propiedad</span>
        </Link>
      </div>

      {/* Properties Grid */}
      <div className="grid grid-cols-1 gap-6">
        {properties.map((property) => (
          <div
            key={property.id}
            className="bg-white border border-charcoal-100 overflow-hidden hover:shadow-md transition-shadow"
          >
            <div className="md:flex">
              <div className="md:w-64 h-48 md:h-auto relative bg-charcoal-100">
                {property.images && property.images.length > 0 ? (
                  <Image
                    src={property.images[0]}
                    alt={property.title}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-charcoal-400">
                    <Building2 className="h-12 w-12" />
                  </div>
                )}
              </div>

              <div className="flex-1 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="inline-block px-3 py-1 text-xs label-tracking bg-gold-100 text-gold-700 capitalize">
                        {property.category}
                      </span>
                      <span
                        className={`inline-block px-3 py-1 text-xs label-tracking capitalize ${
                          property.status === "disponible"
                            ? "bg-green-100 text-green-700"
                            : property.status === "reservada"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-charcoal-200 text-charcoal-700"
                        }`}
                      >
                        {property.status}
                      </span>
                    </div>
                    <h3 className="heading-serif text-xl text-charcoal-900 mb-2">
                      {property.title}
                    </h3>
                    <p className="text-charcoal-600 mb-2">{property.location}</p>
                    <p className="heading-serif text-2xl text-gold-600">
                      {formatPrice(property.price)}
                    </p>
                  </div>

                  <PropertyActions
                    propertyId={property.id}
                    propertyTitle={property.title}
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-charcoal-600">
                  {property.bedrooms ? (
                    <div>
                      <span className="text-charcoal-400">Dormitorios:</span>
                      <span className="ml-1 font-semibold">
                        {property.bedrooms}
                      </span>
                    </div>
                  ) : null}
                  {property.bathrooms ? (
                    <div>
                      <span className="text-charcoal-400">Banos:</span>
                      <span className="ml-1 font-semibold">
                        {property.bathrooms}
                      </span>
                    </div>
                  ) : null}
                  <div>
                    <span className="text-charcoal-400">Area:</span>
                    <span className="ml-1 font-semibold">{property.area}m2</span>
                  </div>
                  <div>
                    <span className="text-charcoal-400">Fecha:</span>
                    <span className="ml-1 font-semibold">
                      {new Date(property.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {properties.length === 0 && (
        <div className="text-center py-12 bg-white border border-charcoal-100">
          <Building2 className="h-12 w-12 text-charcoal-400 mx-auto mb-4" />
          <h3 className="heading-serif text-lg text-charcoal-900 mb-2">
            No hay propiedades
          </h3>
          <p className="text-charcoal-500 mb-4">
            Comienza agregando tu primera propiedad al catalogo
          </p>
          <Link
            href="/admin/propiedades/nueva"
            className="inline-flex items-center space-x-2 btn-primary"
          >
            <Plus className="h-5 w-5" />
            <span>Nueva Propiedad</span>
          </Link>
        </div>
      )}
    </div>
  );
}
