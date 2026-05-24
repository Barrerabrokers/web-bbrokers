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

  const statusStyles: Record<string, string> = {
    disponible: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
    reservada: "bg-amber-500/10 border-amber-500/30 text-amber-300",
    vendida: "bg-gray-500/10 border-ink/25 text-ink/60",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-ink mb-1">
            Propiedades
          </h1>
          <p className="text-sm text-ink/60">
            Gestiona todas las propiedades del catalogo
          </p>
        </div>
        <Link
          href="/admin/propiedades/nueva"
          className="btn-accent text-sm"
        >
          <Plus className="h-4 w-4" />
          Nueva propiedad
        </Link>
      </div>

      {/* Properties List */}
      <div className="space-y-3">
        {properties.map((property) => (
          <div
            key={property.id}
            className="card-hover overflow-hidden md:flex"
          >
            <div className="md:w-56 h-44 md:h-auto relative bg-cream-100 flex-shrink-0">
              {property.images && property.images.length > 0 ? (
                <Image
                  src={property.images[0]}
                  alt={property.title}
                  fill
                  className="object-cover"
                  sizes="224px"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-ink/40">
                  <Building2 className="h-10 w-10" />
                </div>
              )}
            </div>

            <div className="flex-1 p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="pill capitalize">{property.category}</span>
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${
                        statusStyles[property.status] ?? statusStyles.vendida
                      }`}
                    >
                      {property.status}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold tracking-tight text-ink mb-1 truncate">
                    {property.title}
                  </h3>
                  <p className="text-xs text-ink0 mb-2 truncate">
                    {property.location}
                  </p>
                  <p className="text-xl font-semibold tracking-tightest text-gradient-accent">
                    {formatPrice(property.price)}
                  </p>
                </div>

                <PropertyActions
                  propertyId={property.id}
                  propertyTitle={property.title}
                />
              </div>

              <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-ink0 pt-3 border-t border-ink/15">
                {property.bedrooms ? (
                  <span>
                    Dorm:{" "}
                    <span className="text-ink/75 font-medium">
                      {property.bedrooms}
                    </span>
                  </span>
                ) : null}
                {property.bathrooms ? (
                  <span>
                    Banos:{" "}
                    <span className="text-ink/75 font-medium">
                      {property.bathrooms}
                    </span>
                  </span>
                ) : null}
                <span>
                  Area:{" "}
                  <span className="text-ink/75 font-medium">
                    {property.area}m2
                  </span>
                </span>
                <span>
                  Fecha:{" "}
                  <span className="text-ink/75 font-medium">
                    {new Date(property.createdAt).toLocaleDateString()}
                  </span>
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {properties.length === 0 && (
        <div className="card p-16 text-center">
          <Building2 className="h-10 w-10 text-ink/40 mx-auto mb-4" />
          <h3 className="text-base font-semibold tracking-tight text-ink mb-1">
            No hay propiedades
          </h3>
          <p className="text-sm text-ink/60 mb-5">
            Comenza agregando tu primera propiedad al catalogo.
          </p>
          <Link
            href="/admin/propiedades/nueva"
            className="btn-accent text-sm"
          >
            <Plus className="h-4 w-4" />
            Nueva propiedad
          </Link>
        </div>
      )}
    </div>
  );
}
