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

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Inversiones en Real Estate en Buenos Aires",
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
    slogan: "Invertí en desarrollos desde el inicio.",
    priceRange: "$$$",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Av Santa Fe y Libertad",
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
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/propiedades?search={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "¿Cómo invertir en real estate en Buenos Aires?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Barrera Brokers selecciona desarrollos en pozo y departamentos en zonas de alta demanda de Buenos Aires, con análisis de precio, financiación, renta estimada y potencial de reventa.",
        },
      },
      {
        "@type": "Question",
        name: "¿Qué zonas son recomendadas para invertir en departamentos?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Recoleta, Palermo, Belgrano, Nuñez y Puerto Madero concentran demanda residencial, turística y de renta temporaria, por eso son zonas clave para evaluar inversiones inmobiliarias.",
        },
      },
      {
        "@type": "Question",
        name: "¿Se puede financiar un departamento en pozo?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Sí. Muchos desarrollos permiten ingresar con anticipo y financiar el saldo en cuotas durante la obra, según el proyecto y la etapa de construcción.",
        },
      },
    ],
  };
  const homeSchema = [organizationSchema, websiteSchema, faqSchema];

  return (
    <div className="min-h-screen bg-ink">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(homeSchema),
        }}
      />
      <Header />
      <main>
        <HeroSection videos={siteSettings.heroVideos} />
        
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
