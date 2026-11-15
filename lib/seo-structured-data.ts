import { absoluteUrl, SITE_NAME } from "@/lib/seo";
import type { BlogPost } from "@/lib/blog";

/** JSON-LD must remain data even when an editor includes HTML-like text. */
export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: absoluteUrl(item.path) })) };
}

export function blogPostSchema(post: BlogPost) {
  const url = absoluteUrl(`/blog/${post.slug}`);
  return {
    "@context": "https://schema.org", "@type": "BlogPosting", "@id": `${url}#article`, url,
    headline: post.title, description: post.excerpt,
    image: [post.image, ...(post.gallery || [])].filter(Boolean),
    datePublished: post.publishedAt, dateModified: post.updatedAt,
    author: { "@type": post.author === SITE_NAME ? "Organization" : "Person", name: post.author, ...(post.author === SITE_NAME ? { "@id": absoluteUrl("/#organization"), url: absoluteUrl("/#nosotros") } : {}) },
    publisher: { "@type": "RealEstateAgent", "@id": absoluteUrl("/#organization"), name: SITE_NAME, url: absoluteUrl("/") },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    isPartOf: { "@type": "Blog", "@id": absoluteUrl("/blog#publication"), url: absoluteUrl("/blog"), name: "Noticias de real estate en Buenos Aires" },
    inLanguage: "es-AR", isAccessibleForFree: true,
    about: { "@type": "Place", name: "Ciudad de Buenos Aires, Argentina" },
    ...(post.sourceUrl ? { citation: post.sourceUrl } : {}),
  };
}

export function developmentListingSchema(project: {
  name: string; slug: string; location: string; address: string;
  description?: string | null; shortDescription?: string | null;
  currency?: string; availableUnits?: number; amenities?: string[];
}, image?: string, priceFrom?: number | null) {
  const url = absoluteUrl(`/desarrollos/${project.slug}`);
  return {
    "@context": "https://schema.org", "@type": "RealEstateListing", "@id": `${url}#listing`,
    name: project.name, url, image, description: project.shortDescription || project.description || undefined,
    publisher: { "@id": absoluteUrl("/#organization") },
    about: {
      "@type": "ApartmentComplex", "@id": `${url}#building`, name: project.name, image,
      address: { "@type": "PostalAddress", streetAddress: project.address, addressLocality: project.location, addressRegion: "Ciudad de Buenos Aires", addressCountry: "AR" },
      amenityFeature: (project.amenities || []).map(name => ({ "@type": "LocationFeatureSpecification", name })),
      ...(typeof project.availableUnits === "number" ? { numberOfAvailableAccommodationUnits: { "@type": "QuantitativeValue", value: project.availableUnits } } : {}),
    },
    ...(priceFrom && project.availableUnits !== 0 ? { offers: { "@type": "AggregateOffer", lowPrice: priceFrom, priceCurrency: project.currency || "USD", url } } : {}),
  };
}
