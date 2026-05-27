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
    <div className="min-h-screen bg-ink">
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
