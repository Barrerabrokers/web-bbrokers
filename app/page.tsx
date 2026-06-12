import { HeroSection } from "@/components/home/hero-section";
import { DevelopmentsSection } from "@/components/home/developments-section";
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
  TARGET_NEIGHBORHOODS,
} from "@/lib/seo";
import { SOCIAL_SAME_AS } from "@/lib/social-links";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Comprar departamentos e invertir en Buenos Aires",
  description: DEFAULT_SEO_DESCRIPTION,
  keywords: SEO_KEYWORDS,
  alternates: {
    canonical: SITE_URL,
  },
};

export default function HomePage() {
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name: SITE_NAME,
    url: SITE_URL,
    areaServed: [
      "Buenos Aires",
      "Recoleta",
      "Palermo",
      "Belgrano",
      "Nunez",
      "Puerto Madero",
    ],
    knowsAbout: [
      "comprar departamento",
      "inversion inmobiliaria",
      "desarrollos en pozo",
      "departamentos en Buenos Aires",
    ],
    sameAs: SOCIAL_SAME_AS,
  };

  return (
    <div className="min-h-screen bg-ink">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationSchema),
        }}
      />
      <Header />
      <main>
        {/* Hero - Dark cinematic with video */}
        <HeroSection />
        
        {/* Desarrollos - Main investment projects */}
        <DevelopmentsSection />
        
        {/* Modelo de Inversión - How it works */}
        <InvestmentModelSection />
        
        {/* Rentals - Available rentals */}
        <RentalsSection />
        
        {/* Estadísticas - Key numbers */}
        <StatsSection />

        <section className="bg-bone text-ink py-20 md:py-28 border-y border-ink/10">
          <div className="container-custom">
            <div className="grid grid-cols-12 gap-8 md:gap-12">
              <div className="col-span-12 lg:col-span-5">
                <p className="text-[11px] uppercase tracking-widest text-accent-700 mb-4">
                  Invertir en Buenos Aires
                </p>
                <h2 className="font-display font-light text-3xl md:text-5xl tracking-[-0.02em] leading-tight text-ink">
                  Comprar departamentos en zonas de alta demanda.
                </h2>
              </div>
              <div className="col-span-12 lg:col-span-7">
                <div className="space-y-5 text-ink/75 leading-relaxed">
                  <p>
                    En Barrera Brokers asesoramos a compradores e inversores que
                    buscan departamentos, desarrollos en pozo y oportunidades
                    inmobiliarias en Buenos Aires, con foco en ubicaciones de
                    alta demanda como Recoleta, Palermo, Belgrano y Nunez.
                  </p>
                  <p>
                    Nuestro trabajo combina seleccion de proyectos, analisis de
                    precios, financiacion, potencial de renta y reventa para que
                    cada inversion inmobiliaria tenga una estrategia clara desde
                    el primer contacto.
                  </p>
                </div>
                <div className="mt-8 flex flex-wrap gap-2">
                  {TARGET_NEIGHBORHOODS.map((neighborhood) => (
                    <span
                      key={neighborhood}
                      className="rounded-full border border-ink/15 bg-bone-50 px-4 py-2 text-xs uppercase tracking-widest text-ink/70"
                    >
                      Departamentos en {neighborhood}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
        
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
