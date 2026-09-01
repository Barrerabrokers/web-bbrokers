import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import type { Metadata } from "next";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { RestorePageScroll } from "@/components/restore-page-scroll";
import { DevelopmentMotion } from "@/components/development/premium/development-motion";
import { DevelopmentHero } from "@/components/development/premium/development-hero";
import { DevelopmentNavigation } from "@/components/development/premium/development-navigation";
import { DevelopmentOverview } from "@/components/development/premium/development-overview";
import { DevelopmentGallerySection } from "@/components/development/premium/development-gallery-section";
import { DevelopmentLocationSection } from "@/components/development/premium/development-location-section";
import { DevelopmentAmenitiesSection } from "@/components/development/premium/development-amenities-section";
import { DevelopmentFinancingSection } from "@/components/development/premium/development-financing-section";
import { DevelopmentUnitsSection } from "@/components/development/premium/development-units-section";
import { DevelopmentContactSection } from "@/components/development/premium/development-contact-section";
import { DevelopmentMobileActions } from "@/components/development/premium/development-mobile-actions";
import { getDevelopmentBySlug } from "@/lib/developments-db";
import { authOptions } from "@/lib/auth";
import { absoluteUrl, SITE_NAME, truncateDescription } from "@/lib/seo";
import { getDevelopmentVideo } from "@/lib/development-media";
import { createShareToken, hasValidShareToken, withShareParam } from "@/lib/share-token";
import { buildDevelopmentDetailModel } from "@/lib/development-detail-view-model";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const development = await getDevelopmentBySlug(params.slug);
  if (!development || development.visibility === "agents") {
    return {
      title: "Desarrollo no encontrado",
      robots: { index: false, follow: false },
    };
  }

  const primaryImage =
    development.images.find((image) => image.isPrimary)?.url ||
    development.images[0]?.url;
  const description = truncateDescription(
    development.shortDescription || development.description
  );
  const url = absoluteUrl(`/desarrollos/${development.slug}`);

  return {
    title: `${development.name} en ${development.location} | Inversión inmobiliaria`,
    description,
    keywords: [
      development.name,
      development.location,
      development.address,
      `departamentos en ${development.location}`,
      `comprar departamento en ${development.location}`,
      `inversion inmobiliaria en ${development.location}`,
      "desarrollo en pozo",
      "Barrera Brokers",
    ],
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: `${development.name} en ${development.location}`,
      description,
      url,
      siteName: SITE_NAME,
      locale: "es_AR",
      type: "article",
      images: primaryImage ? [{ url: primaryImage, alt: development.name }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `${development.name} en ${development.location}`,
      description,
      images: primaryImage ? [primaryImage] : undefined,
    },
  };
}

export default async function DevelopmentDetailPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams?: { share?: string };
}) {
  const session = await getServerSession(authOptions);
  const development = await getDevelopmentBySlug(params.slug);
  const shareToken = development
    ? createShareToken("development", development.id)
    : undefined;
  const hasSharedAccess =
    development?.visibility === "agents" &&
    hasValidShareToken(searchParams?.share, "development", development.id);

  if (!development || (development.visibility === "agents" && !session && !hasSharedAccess)) {
    notFound();
  }

  const coverVideo = getDevelopmentVideo(
    development.name,
    development.videoUrl,
    development.videoIsPrimary
  );
  const model = buildDevelopmentDetailModel({
    development,
    coverVideo,
    sessionCanSeePrices: Boolean(session),
  });
  const sharedPath = withShareParam(
    `/desarrollos/${development.slug}`,
    development.visibility === "agents" ? shareToken : undefined
  );
  const sharedPdfPath = withShareParam(
    `/api/developments/${development.id}/ficha`,
    development.visibility === "agents" ? shareToken : undefined
  );
  const pageUrl = absoluteUrl(sharedPath);
  const pdfUrl = absoluteUrl(sharedPdfPath);
  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "ApartmentComplex",
      name: development.name,
      description: truncateDescription(
        development.shortDescription || development.description,
        240
      ),
      image: model.primaryImage,
      url: pageUrl,
      address: {
        "@type": "PostalAddress",
        streetAddress: development.address,
        addressLocality: development.location,
        addressRegion: "Buenos Aires",
        addressCountry: "AR",
      },
      amenityFeature: development.amenities.map((amenity) => ({
        "@type": "LocationFeatureSpecification",
        name: amenity,
      })),
      offers: model.priceFrom
        ? {
            "@type": "AggregateOffer",
            priceCurrency: development.currency || "USD",
            lowPrice: model.priceFrom,
            availability: "https://schema.org/InStock",
            url: pageUrl,
          }
        : undefined,
    },
    {
      "@context": "https://schema.org",
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
          name: "Desarrollos",
          item: absoluteUrl("/desarrollos"),
        },
        {
          "@type": "ListItem",
          position: 3,
          name: development.name,
          item: pageUrl,
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-[#efe6d8] text-[#070707]">
      <RestorePageScroll />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(schema),
        }}
      />
      <Header />

      <DevelopmentMotion>
        <main>
          <DevelopmentHero model={model} />
          <DevelopmentNavigation />
          <DevelopmentOverview model={model} />
          <DevelopmentGallerySection model={model} />
          <DevelopmentLocationSection model={model} />
          <DevelopmentAmenitiesSection model={model} />
          <DevelopmentFinancingSection model={model} />
          <DevelopmentUnitsSection
            model={model}
            shareToken={development.visibility === "agents" ? shareToken : undefined}
          />
          <DevelopmentContactSection model={model} pageUrl={pageUrl} pdfUrl={pdfUrl} />
        </main>
      </DevelopmentMotion>

      <DevelopmentMobileActions
        developmentName={development.name}
        locationLabel={model.locationLabel}
      />
      <Footer />
    </div>
  );
}
