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

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function HomePage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--oa-bg-cream)" }}>
      <Header />
      <main>
        {/* Hero — inmersivo full-screen con video */}
        <HeroSection />

        {/* Desarrollos — showcase interactivo */}
        <DevelopmentsSection />

        {/* Modelo de Inversión — pasos del proceso */}
        <InvestmentModelSection />

        {/* Renta temporaria */}
        <RentalsSection />

        {/* Estadísticas — números clave */}
        <StatsSection />

        {/* Propiedades disponibles */}
        <PropertiesSection />

        {/* Nosotros + Equipo */}
        <AboutSection />

        {/* Contacto */}
        <ContactSection />
      </main>
      <Footer />
    </div>
  );
}
