import { getProperties } from "@/lib/db";
import { getListingVisibilityFilter } from "@/lib/listing-access";
import { formatPrice } from "@/lib/utils";
import { InteractiveShowcaseSection, ShowcaseItem } from "./interactive-showcase-section";

const BARENTALS_URL = "https://barentals.com.ar/#propiedades";

const barentalsItems: ShowcaseItem[] = [
  {
    id: "barentals-palermo-2-ambientes",
    href: BARENTALS_URL,
    title: "Departamento 2 ambientes luminoso",
    location: "Palermo",
    image: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80",
    statusLabel: "Alquiler",
    priceLabel: "USD 650 por mes",
    extraStats: [
      { label: "Ambientes", value: "2" },
      { label: "Superficie", value: "55 m²" },
    ],
  },
  {
    id: "barentals-belgrano-3-ambientes",
    href: BARENTALS_URL,
    title: "3 ambientes con cochera incluida",
    location: "Belgrano",
    image: "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1200&q=80",
    statusLabel: "Alquiler",
    priceLabel: "USD 950 por mes",
    extraStats: [
      { label: "Ambientes", value: "3" },
      { label: "Superficie", value: "80 m²" },
    ],
  },
  {
    id: "barentals-nunez-monoambiente",
    href: BARENTALS_URL,
    title: "Monoambiente moderno a estrenar",
    location: "Nunez",
    image: "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=1200&q=80",
    statusLabel: "Alquiler",
    priceLabel: "USD 480 por mes",
    extraStats: [
      { label: "Ambientes", value: "1" },
      { label: "Superficie", value: "32 m²" },
    ],
  },
  {
    id: "barentals-recoleta-studio",
    href: BARENTALS_URL,
    title: "Studio premium con balcón",
    location: "Recoleta",
    image: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=1200&q=80",
    statusLabel: "Alquiler turístico",
    priceLabel: "USD 85 por noche",
    extraStats: [
      { label: "Ambientes", value: "1" },
      { label: "Superficie", value: "38 m²" },
    ],
  },
  {
    id: "barentals-puerto-madero-suite",
    href: BARENTALS_URL,
    title: "Suite de lujo frente al río",
    location: "Puerto Madero",
    image: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=1200&q=80",
    statusLabel: "Alquiler turístico",
    priceLabel: "USD 160 por noche",
    extraStats: [
      { label: "Ambientes", value: "2" },
      { label: "Superficie", value: "70 m²" },
    ],
  },
  {
    id: "barentals-palermo-temporario",
    href: BARENTALS_URL,
    title: "2 ambientes amoblado con amenities",
    location: "Palermo",
    image: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1200&q=80",
    statusLabel: "Alquiler turístico",
    priceLabel: "USD 95 por noche",
    extraStats: [
      { label: "Ambientes", value: "2" },
      { label: "Superficie", value: "52 m²" },
    ],
  },
];

export async function RentalsSection() {
  const visibility = await getListingVisibilityFilter();
  const properties = await getProperties({
    category: "rentals",
    visibility,
  });

  const localItems: ShowcaseItem[] = properties.slice(0, 8).map((p) => ({
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
  const items = localItems.length > 0 ? localItems : barentalsItems;

  return (
    <InteractiveShowcaseSection
      items={items}
      sectionId="rentals"
      eyebrow="Rentals"
      heading={
        <>
          Alquileres temporarios y tradicionales con{" "}
          <span className="italic">BA Rentals</span>.
        </>
      }
      description="Nuestra plataforma de alquileres temporarios por Airbnb y alquileres tradicionales en Buenos Aires, con administración integral para propietarios e inquilinos."
      ctaText="Ver propiedades en Barentals"
      ctaHref={BARENTALS_URL}
      gradientColor="rgba(120,82,60,0.06)"
    />
  );
}
