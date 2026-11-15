import { Suspense } from "react";
import { MetaCatalogEvent } from "@/components/meta-website-tracking";
import { developmentListingSchema, serializeJsonLd } from "@/lib/seo-structured-data";
import { localizePublicMetadata } from "@/lib/i18n/metadata";
import { canReadListing } from "@/lib/listing-visibility-policy";
import { canManageListings } from "@/lib/roles";
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

async function spanishMetadata({
  params: pendingparams,
  searchParams: pendingSearchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ share?: string }>;
}): Promise<Metadata> {
  const params = await pendingparams;
  const development = await getDevelopmentBySlug(params.slug);
  const session = await getServerSession(authOptions);
  const searchParams = await pendingSearchParams;
  const shared = development ? hasValidShareToken(searchParams?.share, "development", development.id) : false;
  if (!development || !canReadListing(development.visibility, session?.user.role, shared)) {
    return {
      title: "Desarrollo no encontrado",
      robots: { index: false, follow: false },
    };
  }

  const primaryImage =
    development.images.find((image) => image.isPrimary)?.url ||
    development.images[0]?.url;
  const description = truncateDescription(
    `${development.name}: departamentos en ${development.location}, Buenos Aires. ${development.address ? `Ubicación: ${development.address}. ` : ""}Consultá unidades, planos, avance de obra y financiación.`,
    160
  );
  const url = absoluteUrl(`/desarrollos/${development.slug}`);

  return {
    ...(development.visibility === "agents" ? { robots: { index: false, follow: false } } : {}),
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

export async function generateMetadata(props: Parameters<typeof spanishMetadata>[0]): Promise<Metadata> { return localizePublicMetadata(await spanishMetadata(props)); }

export default async function DevelopmentDetailPage({
  params: pendingparams,
  searchParams: pendingsearchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ share?: string }>;
}) {
  const params = await pendingparams;
  const searchParams = await pendingsearchParams;
  const session = await getServerSession(authOptions);
  const development = await getDevelopmentBySlug(params.slug);
  const shareToken = development
    ? createShareToken("development", development.id)
    : undefined;
  const hasSharedAccess =
    development?.visibility === "agents" &&
    hasValidShareToken(searchParams?.share, "development", development.id);

  if (!development || !canReadListing(development.visibility, session?.user.role, Boolean(hasSharedAccess))) {
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
    sessionCanSeePrices: canManageListings(session?.user.role),
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
    developmentListingSchema(development, model.primaryImage, model.priceFrom),
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
      {development.visibility === "public" && <Suspense fallback={null}><MetaCatalogEvent name="ViewContent" data={{ content_ids: [development.id], content_type: "home_listing" }} /></Suspense>}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(schema),
        }}
      />
      <Header />

      <DevelopmentMotion>
        <main data-no-translate={development.visibility === "agents" ? "" : undefined}>
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
