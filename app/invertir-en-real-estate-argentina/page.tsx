import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { absoluteUrl, SEO_KEYWORDS, SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Invertir en Real Estate en Argentina | Barrera Brokers",
  description:
    "Guia para invertir en real estate en Argentina desde Buenos Aires: desarrollos en pozo, departamentos para invertir, renta temporaria y estrategia de reventa.",
  keywords: [
    ...SEO_KEYWORDS,
    "invertir en real estate Argentina",
    "inversion real estate Argentina",
    "inversiones inmobiliarias Argentina",
    "departamentos para invertir Argentina",
    "real estate Argentina",
  ],
  alternates: {
    canonical: absoluteUrl("/invertir-en-real-estate-argentina"),
  },
  openGraph: {
    title: "Invertir en Real Estate en Argentina | Barrera Brokers",
    description:
      "Estrategias para invertir en real estate argentino con foco en Buenos Aires, desarrollos en pozo y renta.",
    url: absoluteUrl("/invertir-en-real-estate-argentina"),
    siteName: SITE_NAME,
    locale: "es_AR",
    type: "article",
  },
};

export default function InvertirEnRealEstateArgentinaPage() {
  const pageUrl = absoluteUrl("/invertir-en-real-estate-argentina");
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Invertir en Real Estate en Argentina",
    description:
      "Guia para evaluar inversiones inmobiliarias, departamentos y desarrollos en pozo en Argentina.",
    url: pageUrl,
    author: {
      "@type": "Organization",
      name: SITE_NAME,
      url: absoluteUrl("/"),
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: absoluteUrl("/"),
    },
    mainEntityOfPage: pageUrl,
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
              Real estate Argentina
            </p>
            <h1 className="mt-6 max-w-5xl font-display text-5xl font-light leading-[0.95] tracking-[-0.04em] md:text-7xl lg:text-8xl">
              Como invertir en real estate en Argentina.
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-relaxed text-bone/70">
              La inversion inmobiliaria en Argentina requiere mirar ubicacion,
              moneda, etapa de obra, financiacion, renta esperada y liquidez de
              salida. En Barrera Brokers concentramos esa lectura en oportunidades
              de Buenos Aires con demanda real.
            </p>
          </div>
        </section>

        <section className="bg-bone py-16 md:py-24">
          <div className="container-custom grid gap-10 lg:grid-cols-[0.9fr_1.4fr]">
            <div>
              <p className="text-[10px] uppercase tracking-[0.24em] text-accent-700">
                Criterios de inversion
              </p>
              <h2 className="mt-4 font-display text-4xl font-light leading-tight md:text-5xl">
                No se trata solo de comprar barato, sino de entrar bien.
              </h2>
            </div>
            <div className="space-y-6 text-ink/72">
              <p>
                Para invertir en real estate en Argentina, el punto de partida es
                definir la estrategia: comprar en pozo, comprar terminado para
                renta, conservar como reserva de valor o revender al finalizar la
                obra. Cada camino tiene tiempos, riesgos y retornos distintos.
              </p>
              <p>
                Buenos Aires sigue siendo uno de los mercados mas relevantes para
                evaluar departamentos de inversion por su escala, demanda de
                alquiler, turismo, universidades, corredores premium y liquidez
                comparada frente a otras plazas.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  ["Ubicacion", "Barrios con demanda comprobable y salida comercial."],
                  ["Financiacion", "Ingreso con anticipo y cuotas durante la obra."],
                  ["Renta", "Potencial de alquiler tradicional o temporario."],
                  ["Reventa", "Analisis de valor futuro al finalizar el desarrollo."],
                ].map(([title, text]) => (
                  <div key={title} className="rounded-[24px] border border-ink/10 bg-white/55 p-5">
                    <h3 className="font-display text-2xl font-light">{title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-ink/60">{text}</p>
                  </div>
                ))}
              </div>
              <div className="pt-4">
                <Link
                  href="/inversiones-real-estate-buenos-aires"
                  className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-[11px] uppercase tracking-[0.2em] text-bone"
                >
                  Ver inversiones en Buenos Aires
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
