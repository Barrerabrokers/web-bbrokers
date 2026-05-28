import { getProperties } from "@/lib/db";
import { formatPrice } from "@/lib/utils";
import { InteractiveShowcaseSection, ShowcaseItem } from "./interactive-showcase-section";

export async function RentalsSection() {
  let properties: Awaited<ReturnType<typeof getProperties>> = [];
  try {
    properties = await getProperties({ category: "rentals" });
  } catch {
    // DB no disponible
  }

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
      sectionId="renta"
      eyebrow="Renta temporaria"
      heading={
        <>
          Propiedades en{" "}
          <em className="not-italic" style={{ color: "var(--oa-brown)" }}>
            alquiler
          </em>{" "}
          para inversores y residentes.
        </>
      }
      description="Alquileres temporarios y permanentes en las mejores ubicaciones. Gestión integral incluida."
      ctaText="Ver todos los alquileres"
      ctaHref="/propiedades?category=rentals"
    />
  );
}
