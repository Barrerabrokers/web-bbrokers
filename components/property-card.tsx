import Link from "next/link";
import Image from "next/image";
import { MapPin, Bed, Bath, Square } from "lucide-react";
import { Property } from "@/types";
import { formatPrice } from "@/lib/utils";

export function PropertyCard({ property }: { property: Property }) {
  return (
    <Link
      href={`/propiedades/${property.id}`}
      className="group card-hover overflow-hidden flex flex-col"
    >
      <div className="relative h-64 overflow-hidden">
        <Image
          src={property.images[0]}
          alt={property.title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950/80 via-transparent to-transparent" />

        {/* Category pill */}
        <div className="absolute top-3 left-3">
          <span className="pill bg-gray-950/70 backdrop-blur-md capitalize">
            {property.category}
          </span>
        </div>

        {/* Price */}
        <div className="absolute bottom-3 left-3">
          <span className="text-lg font-semibold tracking-tight text-white drop-shadow-lg">
            {formatPrice(property.price)}
          </span>
        </div>
      </div>

      <div className="p-5 flex flex-col gap-3 flex-1">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-gray-50 group-hover:text-white line-clamp-2">
            {property.title}
          </h3>
          <p className="mt-1 inline-flex items-center gap-1 text-sm text-gray-500 tracking-tight line-clamp-1">
            <MapPin className="h-3.5 w-3.5" />
            {property.location}
          </p>
        </div>

        {property.description && (
          <p className="text-sm text-gray-400 line-clamp-2 leading-relaxed tracking-tight">
            {property.description}
          </p>
        )}

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
  );
}
