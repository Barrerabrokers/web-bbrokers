import type { Metadata } from "next";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import {
  BuenosAiresDevelopments,
  CityDevelopment,
} from "@/components/city/buenos-aires-developments";
import { getDevelopments } from "@/lib/developments-db";
import { getListingVisibilityFilter } from "@/lib/listing-access";
import { getDevelopmentVideo } from "@/lib/development-media";
import { absoluteUrl, SEO_KEYWORDS, SITE_NAME, truncateDescription } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Mapa de desarrollos e inversiones en Buenos Aires",
  description:
    "Mapa de desarrollos inmobiliarios e inversiones en real estate por zona: Recoleta, Palermo, Belgrano, Nuñez, Puerto Madero y Buenos Aires.",
  keywords: [
    ...SEO_KEYWORDS,
    "desarrollos por zona",
    "mapa desarrollos Buenos Aires",
    "mapa inversiones real estate Buenos Aires",
    "departamentos en Buenos Aires",
    "inversión inmobiliaria Buenos Aires",
  ],
  alternates: {
    canonical: absoluteUrl("/ciudad-de-buenos-aires"),
  },
};

export default async function CiudadDeBuenosAiresPage() {
  const visibility = await getListingVisibilityFilter();
  const developments = await getDevelopments({ visibility });
  const cityDevelopments: CityDevelopment[] = developments.map((dev) => ({
    id: dev.id,
    name: dev.name,
    slug: dev.slug,
    description: dev.description,
    shortDescription: dev.shortDescription,
    location: dev.location,
    address: dev.address,
    status: dev.status,
    progress: dev.progress,
    completionDate: dev.completionDate,
    priceFrom: dev.priceFrom,
    minPriceAvailable: dev.minPriceAvailable,
    availableUnits: dev.availableUnits,
    unitsCount: dev.unitsCount,
    amenities: dev.amenities || [],
    features: dev.features || [],
    image:
      dev.images.find((image) => image.isPrimary)?.url ||
      dev.images[0]?.url,
    video: getDevelopmentVideo(dev.name, dev.videoUrl, dev.videoIsPrimary),
  }));
  const mapSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Mapa de desarrollos e inversiones en Buenos Aires",
    description:
      "Mapa de desarrollos inmobiliarios, departamentos para invertir y oportunidades de real estate por zona en Buenos Aires.",
    url: absoluteUrl("/ciudad-de-buenos-aires"),
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: absoluteUrl("/"),
    },
    about: [
      "inversiones en real estate",
      "desarrollos inmobiliarios en Buenos Aires",
      "departamentos para invertir",
      "Recoleta",
      "Palermo",
      "Belgrano",
      "Nuñez",
      "Puerto Madero",
    ],
    mainEntity: {
      "@type": "ItemList",
      itemListElement: cityDevelopments.map((dev, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absoluteUrl(`/desarrollos/${dev.slug}`),
        item: {
          "@type": "Product",
          name: dev.name,
          description: truncateDescription(dev.shortDescription || dev.description, 180),
          image: dev.image,
          category: "Desarrollo inmobiliario",
          areaServed: dev.location,
          address: {
            "@type": "PostalAddress",
            streetAddress: dev.address,
            addressLocality: dev.location,
            addressRegion: "Buenos Aires",
            addressCountry: "AR",
          },
        },
      })),
    },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Inicio",
          item: absoluteUrl("/"),
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Mapa",
          item: absoluteUrl("/ciudad-de-buenos-aires"),
        },
      ],
    },
  };

  return (
    <div className="min-h-screen bg-[#F1EADE]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(mapSchema),
        }}
      />
      <Header />
      <main>
        <BuenosAiresDevelopments developments={cityDevelopments} />
      </main>
      <Footer />
    </div>
  );
}
