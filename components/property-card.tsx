import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Bed, Bath, Square } from "lucide-react";
import { Property } from "@/types";
import { formatPrice } from "@/lib/utils";

export function PropertyCard({ property }: { property: Property }) {
  return (
    <Link href={`/propiedades/${property.id}`} className="group block">

      {/* ── IMAGEN con rotate e hover scale ── */}
      <div
        className="relative h-[400px] mb-5 overflow-hidden"
        style={{
          backgroundColor: "var(--oa-bg-light)",
          borderRadius: "14px",
        }}
      >
        {property.images[0] && (
          <Image
            src={property.images[0]}
            alt={property.title}
            fill
            className="object-cover transition-all duration-[900ms] group-hover:scale-[1.05]"
            style={{
              transform: "rotate(-0.8deg) scale(1.04)",
              transformOrigin: "center center",
            }}
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        )}

        {/* Hover overlay */}
        <div
          className="absolute inset-0 transition-opacity duration-700 opacity-0 group-hover:opacity-100"
          style={{
            background: "rgba(58,29,23,0.15)",
            borderRadius: "14px",
          }}
        />

        {/* Badge categoría */}
        <div className="absolute top-4 left-4">
          <span
            className="text-[9px] uppercase tracking-[0.18em] px-3 py-1.5 rounded-full"
            style={{
              background: "rgba(239,230,216,0.85)",
              backdropFilter: "blur(12px)",
              color: "var(--oa-brown)",
              fontFamily: "var(--font-sans)",
              border: "1px solid rgba(58,29,23,0.12)",
            }}
          >
            {property.category}
          </span>
        </div>

        {/* Arrow hover */}
        <div className="absolute top-4 right-4">
          <div
            className="h-9 w-9 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-500"
            style={{
              background: "var(--oa-white)",
              border: "1px solid rgba(7,7,7,0.1)",
            }}
          >
            <ArrowUpRight className="h-4 w-4" style={{ color: "var(--oa-black)" }} />
          </div>
        </div>

        {/* Gradient bottom */}
        <div
          className="absolute inset-x-0 bottom-0 h-24 pointer-events-none"
          style={{
            background: "linear-gradient(to top, rgba(184,157,135,0.5) 0%, transparent 100%)",
            borderRadius: "0 0 14px 14px",
          }}
        />
      </div>

      {/* ── CONTENIDO ── */}
      <div className="space-y-2.5 px-0.5">
        <div className="flex items-baseline justify-between gap-4">
          <h3
            className="font-display font-light leading-tight tracking-[-0.025em] flex-1 line-clamp-2 transition-all duration-400 group-hover:italic"
            style={{
              fontSize: "clamp(1.4rem, 2.5vw, 1.9rem)",
              color: "var(--oa-black)",
            }}
          >
            {property.title}
          </h3>
          <span
            className="font-display font-light whitespace-nowrap tracking-[-0.02em]"
            style={{
              fontSize: "clamp(1.1rem, 1.8vw, 1.5rem)",
              color: "var(--oa-brown)",
            }}
          >
            {formatPrice(property.price)}
          </span>
        </div>

        <p
          className="text-sm tracking-tight"
          style={{ color: "rgba(7,7,7,0.45)", fontFamily: "var(--font-sans)" }}
        >
          {property.location}
        </p>

        {property.description && (
          <p
            className="text-sm line-clamp-2 leading-relaxed"
            style={{ color: "rgba(7,7,7,0.55)", fontFamily: "var(--font-sans)" }}
          >
            {property.description}
          </p>
        )}

        <div
          className="flex items-center gap-5 pt-3 text-xs"
          style={{
            borderTop: "1px solid rgba(7,7,7,0.08)",
            color: "rgba(7,7,7,0.45)",
            fontFamily: "var(--font-sans)",
          }}
        >
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
            {property.area}m²
          </span>
        </div>
      </div>
    </Link>
  );
}
