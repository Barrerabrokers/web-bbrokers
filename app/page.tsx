import { serializeJsonLd } from "@/lib/seo-structured-data";
import { localizePublicMetadata } from "@/lib/i18n/metadata";
import { AlphaFeaturedSection } from "@/components/home/alpha-featured-section";
import { HeroSection } from "@/components/home/hero-section";
import { DevelopmentsSection } from "@/components/home/developments-section";
import { FinishedDevelopmentsSection } from "@/components/home/finished-developments-section";
import { CityMapSection } from "@/components/home/city-map-section";
import { PressSection } from "@/components/home/press-section";
import { InvestmentModelSection } from "@/components/home/investment-model-section";
import { RentalsSection } from "@/components/home/rentals-section";
import { StatsSection } from "@/components/home/stats-section";
import { PropertiesSection } from "@/components/home/properties-section";
import { AboutSection } from "@/components/home/about-section";
import { ContactSection } from "@/components/home/contact-section";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import type { Metadata } from "next";
import {
  DEFAULT_SEO_DESCRIPTION,
  SEO_KEYWORDS,
  SITE_NAME,
  SITE_URL,
} from "@/lib/seo";
import { getFullSiteSettings } from "@/lib/db";
import { SOCIAL_SAME_AS } from "@/lib/social-links";

export const revalidate = 300;

const spanishMetadata: Metadata = {
  title: "Barrera Brokers | Desarrollos e inversiones en Buenos Aires",
  description:
    "Invertí en real estate en Buenos Aires con Barrera Brokers: desarrollos en pozo, departamentos para invertir, financiación en cuotas y oportunidades en Recoleta, Palermo, Belgrano, Nuñez y Puerto Madero.",
  keywords: [
    ...SEO_KEYWORDS,
    "inversiones real estate Argentina",
    "real estate investment Buenos Aires",
    "comprar departamento para invertir",
    "desarrollos premium Buenos Aires",
  ],
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: "Barrera Brokers | Inversiones en Real Estate en Buenos Aires",
    description:
      "Desarrollos en pozo, departamentos para invertir y oportunidades de real estate en las mejores zonas de Buenos Aires.",
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "es_AR",
    type: "website",
  },
};

export async function generateMetadata(): Promise<Metadata> { return localizePublicMetadata(spanishMetadata); }

export default async function HomePage() {
  const siteSettings = await getFullSiteSettings();
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    logo: siteSettings.logoUrl.startsWith("http") ? siteSettings.logoUrl : `${SITE_URL}${siteSettings.logoUrl}`,
    image: siteSettings.logoUrl.startsWith("http") ? siteSettings.logoUrl : `${SITE_URL}${siteSettings.logoUrl}`,
    description: DEFAULT_SEO_DESCRIPTION,
    slogan: "Invertí en tu próximo departamento en Buenos Aires.",
    priceRange: "$$$",
    telephone: siteSettings.phone,
    email: siteSettings.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: siteSettings.addressStreet,
      addressLocality: "Ciudad de Buenos Aires",
      addressRegion: "Buenos Aires",
      addressCountry: "AR",
    },
    areaServed: [
      { "@type": "City", name: "Buenos Aires" },
      { "@type": "Place", name: "Recoleta" },
      { "@type": "Place", name: "Palermo" },
      { "@type": "Place", name: "Belgrano" },
      { "@type": "Place", name: "Nuñez" },
      { "@type": "Place", name: "Puerto Madero" },
    ],
    knowsAbout: [
      "inversiones en real estate",
      "real estate Buenos Aires",
      "comprar departamento",
      "inversión inmobiliaria",
      "desarrollos en pozo",
      "departamentos en Buenos Aires",
      "renta temporaria",
      "alquiler Airbnb",
    ],
    makesOffer: [
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Asesoramiento en inversiones en real estate",
          serviceType: "Real estate investment advisory",
          areaServed: "Buenos Aires",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Comercialización de desarrollos en pozo",
          serviceType: "New development sales",
          areaServed: "Buenos Aires",
        },
      },
    ],
    sameAs: SOCIAL_SAME_AS,
  };
  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: SITE_URL,
    publisher: { "@id": `${SITE_URL}/#organization` },
    inLanguage: "es-AR",
  };
  const homeSchema = [organizationSchema, websiteSchema];

  return (
    <div className="min-h-screen bg-ink">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(homeSchema),
        }}
      />
      <Header />
      <main>
        <HeroSection videos={siteSettings.heroVideos} />
        <AlphaFeaturedSection />
        
        {/* Desarrollos - Main investment projects */}
        <DevelopmentsSection />

        {/* Desarrollos Terminados - Track record */}
        <FinishedDevelopmentsSection />

        {/* Mapa - Interactive city investment map */}
        <CityMapSection />

        {/* Prensa - Media mentions */}
        <PressSection />
        
        {/* Modelo de Inversión - How it works */}
        <InvestmentModelSection />
        
        {/* Rentals - Available rentals */}
        <RentalsSection />
        
        {/* Estadísticas - Key numbers */}
        <StatsSection settings={siteSettings} />

        {/* Propiedades - Available properties */}
        <PropertiesSection />
        
        {/* About - Company info */}
        <AboutSection />
        
        {/* Contacto - Contact form */}
        <ContactSection />
      </main>
      <Footer />
    </div>
  );
}
