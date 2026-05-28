import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Bed, Bath, Square } from "lucide-react";
import { Property } from "@/types";
import { formatPrice } from "@/lib/utils";

export function PropertyCard({ property }: { property: Property }) {
  return (
    <Link
      href={`/propiedades/${property.id}`}
      className="group block"
    >
      <div className="relative h-[420px] mb-6 overflow-hidden bg-cream-300">
        <Image
          src={property.images[0]}
          alt={property.title}
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        <div className="absolute top-5 left-5 flex items-center gap-3 text-cream-100">
          <span className="text-[10px] uppercase tracking-widest bg-ink/30 backdrop-blur-sm px-2.5 py-1 rounded-full">
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

        {property.description && (
          <p className="text-sm text-ink/65 line-clamp-2 leading-relaxed">
            {property.description}
          </p>
        )}

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
  );
}
