import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { getProperties } from "@/lib/db";
import { getListingVisibilityFilter } from "@/lib/listing-access";
import { PropertyCard } from "@/components/property-card";
import { PROPERTY_CATEGORIES } from "@/types";
import type { Metadata } from "next";
import { absoluteUrl, SEO_KEYWORDS, SITE_NAME, truncateDescription } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Departamentos para invertir y propiedades en Buenos Aires",
  description:
    "Buscá departamentos para invertir y propiedades en venta en Buenos Aires: Recoleta, Palermo, Belgrano, Nuñez, Puerto Madero y zonas de alta demanda.",
  keywords: [
    ...SEO_KEYWORDS,
    "propiedades en venta",
    "departamentos en venta",
    "departamentos para invertir en Buenos Aires",
    "comprar departamento en Recoleta",
    "comprar departamento en Palermo",
  ],
  alternates: {
    canonical: absoluteUrl("/propiedades"),
  },
};

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: { categoria?: string };
}) {
  const category = searchParams.categoria;
  const visibility = await getListingVisibilityFilter();
  const properties = await getProperties({
    ...(category ? { category } : {}),
    visibility,
  });

  const activeCategory = category
    ? PROPERTY_CATEGORIES.find((c) => c.value === category)
    : null;
  const pageUrl = category
    ? absoluteUrl(`/propiedades?categoria=${category}`)
    : absoluteUrl("/propiedades");
  const propertyListSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: activeCategory
      ? `${activeCategory.label} en Buenos Aires`
      : "Departamentos para invertir y propiedades en Buenos Aires",
    description: activeCategory
      ? activeCategory.description
      : "Catálogo de departamentos para invertir, propiedades en venta y oportunidades inmobiliarias en Buenos Aires.",
    url: pageUrl,
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: absoluteUrl("/"),
    },
    about: [
      "inversiones en real estate",
      "departamentos para invertir",
      "propiedades en venta en Buenos Aires",
      "real estate Buenos Aires",
    ],
    mainEntity: {
      "@type": "ItemList",
      itemListElement: properties.map((property, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absoluteUrl(`/propiedades/${property.id}`),
        item: {
          "@type": "Apartment",
          name: property.title,
          description: truncateDescription(property.description, 180),
          image: property.images[0],
          address: {
            "@type": "PostalAddress",
            streetAddress: property.address,
            addressLocality: property.location,
            addressRegion: "Buenos Aires",
            addressCountry: "AR",
          },
          offers: {
            "@type": "Offer",
            priceCurrency: property.currency || "USD",
            price: property.price,
            availability:
              property.status === "disponible"
                ? "https://schema.org/InStock"
                : "https://schema.org/SoldOut",
            url: absoluteUrl(`/propiedades/${property.id}`),
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
          name: "Propiedades",
          item: absoluteUrl("/propiedades"),
        },
      ],
    },
  };

  return (
    <div className="min-h-screen bg-cream-200">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(propertyListSchema),
        }}
      />
      <Header />

      <main className="pt-32 pb-32">
        <div className="container-custom">
          {/* Editorial header */}
          <div className="grid grid-cols-12 gap-6 mb-16 md:mb-20">
            <div className="col-span-12 md:col-span-1">
              <span className="number-marker">/00</span>
            </div>
            <div className="col-span-12 md:col-span-8">
              <p className="eyebrow mb-6">Catalogo</p>
              <h1 className="font-display font-light text-[48px] md:text-[96px] lg:text-[120px] leading-[0.95] tracking-[-0.025em] text-ink">
                {activeCategory ? (
                  <>
                    Propiedades
                    <br />
                    <span className="italic">
                      {activeCategory.label.toLowerCase()}.
                    </span>
                  </>
                ) : (
                  <>
                    Todas las
                    <br />
                    <span className="italic">propiedades.</span>
                  </>
                )}
              </h1>
            </div>
            <div className="col-span-12 md:col-span-3 md:col-start-10 flex items-end">
              <p className="text-ink/70 leading-relaxed text-base">
                {activeCategory
                  ? activeCategory.description
                  : "Explora nuestro catalogo completo de propiedades disponibles, curado con cuidado por nuestro equipo."}
              </p>
            </div>
          </div>

          {/* Filters as horizontal text links */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-16 pb-6 border-b border-ink/15">
            <span className="text-[10px] uppercase tracking-widest text-ink/50">
              Filtrar
            </span>
            <a
              href="/propiedades"
              className={`text-sm tracking-tight transition-colors ${
                !category
                  ? "text-ink font-medium underline underline-offset-4"
                  : "text-ink/60 hover:text-ink"
              }`}
            >
              Todas
            </a>
            {PROPERTY_CATEGORIES.map((cat) => (
              <a
                key={cat.value}
                href={`/propiedades?categoria=${cat.value}`}
                className={`text-sm tracking-tight transition-colors ${
                  category === cat.value
                    ? "text-ink font-medium underline underline-offset-4"
                    : "text-ink/60 hover:text-ink"
                }`}
              >
                {cat.label}
              </a>
            ))}
            <span className="ml-auto text-xs text-ink/50 tabular-nums">
              {properties.length} {properties.length === 1 ? "propiedad" : "propiedades"}
            </span>
          </div>

          {/* Properties Grid */}
          {properties.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-16">
              {properties.map((property) => (
                <PropertyCard key={property.id} property={property} />
              ))}
            </div>
          ) : (
            <div className="border-t border-ink/15 pt-16 text-center">
              <h3 className="font-display font-light text-3xl text-ink mb-2">
                No hay propiedades disponibles
              </h3>
              <p className="text-ink/60">
                Volve pronto para ver nuevas propiedades en esta categoria.
              </p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
