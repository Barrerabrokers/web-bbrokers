import type { Metadata } from "next";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ContactSection } from "@/components/home/contact-section";
import { localizePublicMetadata } from "@/lib/i18n/metadata";
import { absoluteUrl } from "@/lib/seo";
import { serializeJsonLd } from "@/lib/seo-structured-data";
export async function generateMetadata(): Promise<Metadata> {
  return localizePublicMetadata({ title: "Contacto", description: "Contactá a Barrera Brokers para consultar desarrollos, unidades disponibles y condiciones de inversión inmobiliaria en Buenos Aires.", alternates: { canonical: absoluteUrl("/contacto") } });
}
export default function ContactPage() {
  return <div className="bg-ink text-bone"><Header /><main>
    <header className="container-custom pb-10 pt-32 md:pt-40"><h1 className="font-display text-5xl font-light md:text-7xl">Contacto con Barrera Brokers</h1><p className="mt-5 max-w-2xl text-lg leading-relaxed">Consultá por desarrollos en Buenos Aires, unidades disponibles y condiciones de compra con nuestro equipo.</p></header>
    <ContactSection />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd({ "@context": "https://schema.org", "@type": "ContactPage", name: "Contacto con Barrera Brokers", url: absoluteUrl("/contacto"), mainEntity: { "@id": absoluteUrl("/#organization") } }) }} />
  </main><Footer /></div>;
}
