import Link from "next/link";
import Image from "next/image";
import { MapPin, Bed, Bath, Square } from "lucide-react";
import { Property } from "@/types";
import { formatPrice } from "@/lib/utils";

export function PropertyCard({ property }: { property: Property }) {
  return (
    <Link
      href={`/propiedades/${property.id}`}
      className="group bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300"
    >
      <div className="relative h-64 overflow-hidden">
        <Image
          src={property.images[0]}
          alt={property.title}
          fill
          className="object-cover group-hover:scale-110 transition-transform duration-300"
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
  );
}
