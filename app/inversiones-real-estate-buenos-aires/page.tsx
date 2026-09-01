import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight, MapPin, TrendingUp } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { getDevelopments } from "@/lib/developments-db";
import { getListingVisibilityFilter } from "@/lib/listing-access";
import { absoluteUrl, SEO_KEYWORDS, SITE_NAME, TARGET_NEIGHBORHOODS } from "@/lib/seo";
import { formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Inversiones en Real Estate en Buenos Aires | Barrera Brokers",
  description:
    "Asesoramiento para invertir en real estate en Buenos Aires: desarrollos en pozo, departamentos para invertir, financiacion en cuotas y oportunidades en Recoleta, Palermo, Belgrano, Nunez y Puerto Madero.",
  keywords: [
    ...SEO_KEYWORDS,
    "inversiones en real estate Buenos Aires",
    "invertir en real estate Buenos Aires",
    "real estate Buenos Aires inversion",
    "departamentos para invertir Buenos Aires",
    "comprar departamento para invertir Buenos Aires",
  ],
  alternates: {
    canonical: absoluteUrl("/inversiones-real-estate-buenos-aires"),
  },
  openGraph: {
    title: "Inversiones en Real Estate en Buenos Aires | Barrera Brokers",
    description:
      "Seleccionamos desarrollos y departamentos para invertir en zonas de alta demanda de Buenos Aires.",
    url: absoluteUrl("/inversiones-real-estate-buenos-aires"),
    siteName: SITE_NAME,
    locale: "es_AR",
    type: "website",
  },
};

export default async function InversionesRealEstateBuenosAiresPage() {
  const visibility = await getListingVisibilityFilter();
  const developments = await getDevelopments({ visibility });
  const featured = developments.slice(0, 6);
  const pageUrl = absoluteUrl("/inversiones-real-estate-buenos-aires");

  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Inversiones en Real Estate en Buenos Aires",
    description:
      "Guia de oportunidades para invertir en real estate, desarrollos en pozo y departamentos en Buenos Aires.",
    url: pageUrl,
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: absoluteUrl("/"),
    },
    about: [
      "inversiones en real estate Buenos Aires",
      "departamentos para invertir",
      "desarrollos en pozo",
      "inversion inmobiliaria",
      ...TARGET_NEIGHBORHOODS,
    ],
    mainEntity: {
      "@type": "ItemList",
      itemListElement: featured.map((dev, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absoluteUrl(`/desarrollos/${dev.slug}`),
        name: dev.name,
      })),
    },
  };

  return (
    <div className="min-h-screen bg-bone text-ink">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <Header />
      <main>
        <section className="bg-ink px-5 pb-20 pt-32 text-bone md:pb-28 md:pt-44">
          <div className="container-custom">
            <p className="text-[11px] uppercase tracking-[0.24em] text-accent">
              Inversiones en real estate
            </p>
            <h1 className="mt-6 max-w-5xl font-display text-5xl font-light leading-[0.95] tracking-[-0.04em] md:text-7xl lg:text-8xl">
              Invertir en real estate en Buenos Aires con estrategia.
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-relaxed text-bone/70">
              En Barrera Brokers seleccionamos desarrollos en pozo y departamentos
              para invertir en Buenos Aires, con foco en ubicacion, demanda real,
              financiacion, potencial de renta y salida de reventa.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link href="/#desarrollos" className="btn-primary">
                Ver desarrollos
              </Link>
              <Link href="/#contacto" className="btn-outline-dark">
                Hablar con un asesor
              </Link>
            </div>
          </div>
        </section>

        <section className="border-b border-ink/10 bg-bone py-16 md:py-24">
          <div className="container-custom grid gap-10 lg:grid-cols-[0.9fr_1.4fr]">
            <div>
              <p className="text-[10px] uppercase tracking-[0.24em] text-accent-700">
                Por que Buenos Aires
              </p>
              <h2 className="mt-4 font-display text-4xl font-light leading-tight md:text-5xl">
                Zonas consolidadas, demanda constante y entrada financiada.
              </h2>
            </div>
            <div className="space-y-5 text-ink/72">
              <p>
                Buenos Aires combina demanda residencial, alquiler temporario,
                universidades, oficinas, turismo y barrios con liquidez historica.
                Para un inversor, eso permite analizar departamentos no solo por
                precio, sino por ubicacion, absorcion, renta esperada y potencial
                de valorizacion.
              </p>
              <p>
                Nuestro enfoque prioriza proyectos con anticipo, cuotas durante
                obra y una estrategia clara: conservar para renta pasiva o vender
                al final de obra con una ganancia estimada segun mercado, etapa
                del proyecto y ubicacion.
              </p>
              <div className="grid gap-3 pt-4 sm:grid-cols-2">
                {[
                  "Desarrollos en pozo",
                  "Departamentos para invertir",
                  "Financiacion en cuotas",
                  "Renta temporaria",
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-ink/10 bg-white/50 p-4 text-sm">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-bone py-16 md:py-24">
          <div className="container-custom">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-accent-700">
                  Oportunidades actuales
                </p>
                <h2 className="mt-4 font-display text-4xl font-light md:text-5xl">
                  Desarrollos para evaluar hoy.
                </h2>
              </div>
              <Link
                href="/desarrollos"
                className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-ink/70 hover:text-ink"
              >
                Ver catalogo completo
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {featured.map((dev) => {
                const priceFrom = dev.minPriceAvailable ?? dev.priceFrom;
                return (
                  <Link
                    key={dev.id}
                    href={`/desarrollos/${dev.slug}`}
                    className="group rounded-[28px] border border-ink/10 bg-white/55 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-ink/25 hover:bg-white"
                  >
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-ink/45">
                      <MapPin className="h-3.5 w-3.5" />
                      {dev.location}
                    </div>
                    <h3 className="mt-4 font-display text-3xl font-light leading-none tracking-[-0.03em]">
                      {dev.name}
                    </h3>
                    <div className="mt-6 flex items-center justify-between border-t border-ink/10 pt-4 text-sm">
                      <span className="inline-flex items-center gap-2 text-ink/55">
                        <TrendingUp className="h-4 w-4" />
                        Desde
                      </span>
                      <span className="font-display text-xl text-accent-700">
                        {priceFrom ? formatPrice(priceFrom) : "Consultar"}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
