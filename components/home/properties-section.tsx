import { getProperties } from "@/lib/db";
import { formatPrice } from "@/lib/utils";
import { InteractiveShowcaseSection, ShowcaseItem } from "./interactive-showcase-section";

export async function PropertiesSection() {
  let properties: Awaited<ReturnType<typeof getProperties>> = [];
  try {
    properties = await getProperties({ status: "disponible" });
  } catch {
    // DB no disponible
  }

  const items: ShowcaseItem[] = properties.slice(0, 8).map((p) => ({
    id: p.id,
    href: `/propiedades/${p.id}`,
    title: p.title,
    location: p.location,
    image: p.images[0] || undefined,
    statusLabel:
      p.category === "rentals"
        ? "Alquiler"
        : p.category === "desarrollo"
        ? "En desarrollo"
        : "En venta",
    priceLabel: p.price ? formatPrice(p.price) : undefined,
    extraStats: [
      ...(p.area ? [{ label: "Superficie", value: `${p.area}m²` }] : []),
      ...(p.bedrooms ? [{ label: "Ambientes", value: `${p.bedrooms}` }] : []),
    ],
  }));

  return (
    <InteractiveShowcaseSection
      items={items}
      sectionId="propiedades"
      eyebrow="Propiedades"
      heading={
        <>
          Una selección de propiedades{" "}
          <em className="not-italic" style={{ color: "var(--oa-brown)" }}>
            disponibles
          </em>{" "}
          en Buenos Aires.
        </>
      }
      description="Departamentos, casas y desarrollos en venta y alquiler. Cada propiedad con datos clave y galería completa."
      ctaText="Ver catálogo completo"
      ctaHref="/propiedades"
    />
  );
}
