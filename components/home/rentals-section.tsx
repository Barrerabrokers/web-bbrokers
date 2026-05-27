import { getProperties } from "@/lib/db";
import { formatPrice } from "@/lib/utils";
import { InteractiveShowcaseSection, ShowcaseItem } from "./interactive-showcase-section";

export async function RentalsSection() {
  const properties = await getProperties({ category: "rentals" });

  // If no rentals, try all properties as fallback
  const items: ShowcaseItem[] = properties.slice(0, 8).map((p) => ({
    id: p.id,
    href: `/propiedades/${p.id}`,
    title: p.title,
    location: p.location,
    image: p.images[0] || undefined,
    statusLabel: "Alquiler",
    priceLabel: p.price ? formatPrice(p.price) : undefined,
    extraStats: [
      ...(p.area ? [{ label: "Superficie", value: `${p.area}m²` }] : []),
      ...(p.bedrooms ? [{ label: "Ambientes", value: `${p.bedrooms}` }] : []),
    ],
  }));

  return (
    <InteractiveShowcaseSection
      items={items}
      sectionId="rentals"
      eyebrow="Rentals"
      heading={
        <>
          Propiedades en <span className="italic">alquiler</span> para
          inversores y residentes.
        </>
      }
      description="Alquileres temporarios y permanentes en las mejores ubicaciones. Gestión integral incluida."
      ctaText="Ver todos los alquileres"
      ctaHref="/propiedades?category=rentals"
      gradientColor="rgba(120,82,60,0.06)"
    />
  );
}
