import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Calendar, Building2, Check, FileText } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { getDevelopmentBySlug } from "@/lib/developments-db";
import { DEVELOPMENT_STATUS_LABELS } from "@/types";
import { formatPrice } from "@/lib/utils";
import { UnitsList } from "@/components/development/units-list";
import { DevelopmentGallery } from "@/components/development/development-gallery";
import { Reveal } from "@/components/ui/reveal";
import type { Metadata } from "next";
import { absoluteUrl, SITE_NAME, truncateDescription } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const development = await getDevelopmentBySlug(params.slug);
  if (!development) {
    return {
      title: "Desarrollo no encontrado",
      robots: { index: false, follow: false },
    };
  }

  const primaryImage =
    development.images.find((i) => i.isPrimary)?.url ||
    development.images[0]?.url;
  const description = truncateDescription(
    development.shortDescription || development.description
  );
  const url = absoluteUrl(`/desarrollos/${development.slug}`);

  return {
    title: `${development.name} en ${development.location} | Departamentos en pozo`,
    description,
    keywords: [
      development.name,
      development.location,
      development.address,
      `departamentos en ${development.location}`,
      `comprar departamento en ${development.location}`,
      `inversion inmobiliaria en ${development.location}`,
      "desarrollo en pozo",
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
}: {
  params: { slug: string };
}) {
  const development = await getDevelopmentBySlug(params.slug);
  if (!development) notFound();

  const primaryImage =
    development.images.find((i) => i.isPrimary)?.url ||
    development.images[0]?.url;

  const priceFrom = development.minPriceAvailable ?? development.priceFrom;
  const pageUrl = absoluteUrl(`/desarrollos/${development.slug}`);
  const primaryImageUrl = primaryImage || undefined;
  const developmentSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: development.name,
    description: truncateDescription(
      development.shortDescription || development.description,
      240
    ),
    image: primaryImageUrl,
    url: pageUrl,
    brand: {
      "@type": "Organization",
      name: SITE_NAME,
    },
    category: "Desarrollo inmobiliario",
    areaServed: development.location,
    address: {
      "@type": "PostalAddress",
      streetAddress: development.address,
      addressLocality: development.location,
      addressRegion: "Buenos Aires",
      addressCountry: "AR",
    },
    offers: priceFrom
      ? {
          "@type": "AggregateOffer",
          priceCurrency: development.currency || "USD",
          lowPrice: priceFrom,
          availability: "https://schema.org/InStock",
          url: pageUrl,
        }
      : undefined,
  };

  return (
    <div className="min-h-screen bg-ink">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(developmentSchema),
        }}
      />
      <Header />

      <main>
        {/* Hero with primary image */}
        <section className="relative bg-ink text-bone pt-20 md:pt-24">
          <div className="relative min-h-[500px] h-[68vh] max-h-[720px] overflow-hidden bg-ink-600">
            {primaryImage && (
              <Image
                src={primaryImage}
                alt={development.name}
                fill
                priority
                className="object-cover"
                sizes="100vw"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-ink/30 via-ink/55 to-ink/90" />
            <div className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/55 to-ink/20" />

            <div className="absolute inset-0 z-10 flex flex-col justify-end pb-8 md:pb-12">
              <div className="container-custom">
                <div className="max-w-4xl rounded-lg border border-[#F1EADE]/20 bg-[#151415]/70 p-5 shadow-2xl backdrop-blur-md md:p-8">
                  <Reveal variant="fade-up" duration={1000}>
                    <Link
                      href="/desarrollos"
                      className="inline-flex items-center gap-2 text-[#F1EADE]/75 hover:text-[#F1EADE] text-[11px] uppercase tracking-widest mb-5"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Todos los desarrollos
                    </Link>
                  </Reveal>

                  <Reveal variant="fade-up" delay={150} duration={1200}>
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                      <span className="px-3 py-1.5 bg-accent text-ink text-[10px] uppercase tracking-widest font-medium rounded-full">
                        {DEVELOPMENT_STATUS_LABELS[development.status]}
                      </span>
                      {development.availableUnits !== undefined && (
                        <span className="px-3 py-1.5 bg-[#F1EADE]/10 text-[#F1EADE] text-[10px] uppercase tracking-widest rounded-full border border-[#F1EADE]/20">
                          {development.availableUnits} unidades disponibles
                        </span>
                      )}
                    </div>
                  </Reveal>

                  <Reveal variant="clip-up" delay={300} duration={1600}>
                    <h1 className="font-display font-light text-[38px] md:text-[68px] lg:text-[88px] tracking-[-0.03em] leading-[0.92] text-[#F1EADE] drop-shadow-sm">
                      {development.name}
                    </h1>
                  </Reveal>

                  <Reveal variant="fade-up" delay={500} duration={1200}>
                    <div className="flex items-center gap-2 mt-5 text-[#F1EADE]/80">
                      <MapPin className="h-4 w-4 flex-shrink-0 text-accent" />
                      <span className="text-sm md:text-base">
                        {development.address} · {development.location}
                      </span>
                    </div>
                  </Reveal>
                </div>
              </div>
            </div>
          </div>
        </section>


        {/* Stats strip */}
        <section className="bg-ink text-bone border-y border-bone/15">
          <div className="container-custom py-6 md:py-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="rounded-lg border border-bone/10 bg-bone/5 p-5">
                <p className="text-[10px] uppercase tracking-widest text-bone/50 mb-1">
                  Desde
                </p>
                <div className="font-display font-light text-2xl md:text-3xl text-accent">
                  {priceFrom ? formatPrice(priceFrom) : "—"}
                </div>
              </div>
              <div className="rounded-lg border border-bone/10 bg-bone/5 p-5">
                <p className="text-[10px] uppercase tracking-widest text-bone/50 mb-1">
                  Avance de obra
                </p>
                <div className="font-display font-light text-2xl md:text-3xl text-bone">
                  {development.progress}%
                </div>
              </div>
              <div className="rounded-lg border border-bone/10 bg-bone/5 p-5">
                <p className="text-[10px] uppercase tracking-widest text-bone/50 mb-1">
                  Entrega
                </p>
                <div className="font-display font-light text-2xl md:text-3xl text-bone flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-accent" />
                  {development.completionDate || "—"}
                </div>
              </div>
              <div className="rounded-lg border border-bone/10 bg-bone/5 p-5">
                <p className="text-[10px] uppercase tracking-widest text-bone/50 mb-1">
                  Unidades
                </p>
                <div className="font-display font-light text-2xl md:text-3xl text-bone flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-accent" />
                  {development.unitsCount || 0}
                </div>
              </div>
              {development.brochureUrl && (
                <div className="rounded-lg border border-bone/10 bg-bone/5 p-5 sm:col-span-2 lg:col-span-1">
                  <p className="text-[10px] uppercase tracking-widest text-bone/50 mb-1">
                    Brochure
                  </p>
                  <Link
                    href={`/desarrollos/${development.slug}/brochure`}
                    className="font-display font-light text-xl md:text-2xl text-accent hover:text-accent-300 flex items-center gap-2 transition-colors"
                  >
                    <FileText className="h-5 w-5" />
                    Ver PDF
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Description + Amenities */}
        <section className="bg-bone text-ink py-20 md:py-28">
          <div className="container-custom">
            <div className="grid grid-cols-12 gap-6 md:gap-12">
              <div className="col-span-12 lg:col-span-7">
                <Reveal variant="fade-up" duration={1100}>
                  <p className="text-[11px] uppercase tracking-widest text-accent-700 mb-4">
                    El proyecto
                  </p>
                </Reveal>
                <Reveal variant="clip-up" delay={150} duration={1500}>
                  <h2 className="font-display font-light text-3xl md:text-5xl tracking-[-0.02em] leading-tight text-ink mb-8">
                    {development.shortDescription || "Conocé el desarrollo"}
                  </h2>
                </Reveal>
                <Reveal variant="fade-up" delay={350} duration={1200}>
                  <div className="prose prose-lg max-w-none text-ink/75 leading-relaxed whitespace-pre-line">
                    {development.description}
                  </div>
                </Reveal>

                {development.features.length > 0 && (
                  <div className="mt-10 pt-8 border-t border-ink/15">
                    <h3 className="font-display font-light text-2xl text-ink mb-5">
                      Características
                    </h3>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {development.features.map((f) => (
                        <li
                          key={f}
                          className="flex items-start gap-2 text-ink/75"
                        >
                          <Check className="h-4 w-4 text-accent-700 mt-1 flex-shrink-0" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>


              <div className="col-span-12 lg:col-span-5">
                {development.amenities.length > 0 && (
                  <div className="bg-bone-50 border border-ink/15 rounded-lg p-8 sticky top-28">
                    <p className="text-[11px] uppercase tracking-widest text-accent-700 mb-4">
                      Amenities
                    </p>
                    <h3 className="font-display font-light text-2xl text-ink mb-6">
                      Servicios y espacios comunes
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {development.amenities.map((a) => (
                        <span
                          key={a}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bone border border-ink/15 rounded-full text-xs uppercase tracking-widest text-ink"
                        >
                          <Check className="h-3 w-3 text-accent-700" />
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Gallery */}
        {development.images.length > 1 && (
          <section className="bg-bone text-ink pb-20 md:pb-28 border-t border-ink/15 pt-20">
            <div className="container-custom">
              <p className="text-[11px] uppercase tracking-widest text-accent-700 mb-4">
                Galería
              </p>
              <h2 className="font-display font-light text-3xl md:text-5xl tracking-[-0.02em] leading-tight text-ink mb-10">
                Imágenes del <span className="italic">desarrollo</span>
              </h2>
              <DevelopmentGallery images={development.images} />
            </div>
          </section>
        )}

        {/* Units */}
        <section
          id="unidades"
          className="bg-ink text-bone py-20 md:py-28 border-t border-bone/15"
        >
          <div className="container-custom">
            <p className="text-[11px] uppercase tracking-widest text-accent mb-4">
              Unidades disponibles
            </p>
            <h2 className="font-display font-light text-3xl md:text-5xl tracking-[-0.02em] leading-tight text-bone mb-10">
              Encontrá tu <span className="italic">unidad ideal</span>
            </h2>

            <UnitsList
              units={development.units || []}
              developmentFeatures={development.features}
              developmentName={development.name}
              developmentLocation={`${development.address} · ${development.location}`}
            />
          </div>
        </section>

        {/* CTA */}
        <section className="bg-accent text-ink py-20 md:py-24">
          <div className="container-custom text-center">
            <h2 className="font-display font-light text-3xl md:text-5xl tracking-[-0.02em] text-ink mb-6">
              ¿Te interesa <span className="italic">{development.name}</span>?
            </h2>
            <p className="text-ink/75 text-base md:text-lg max-w-xl mx-auto mb-8">
              Contactanos para conocer disponibilidad, planes de financiación y
              coordinar una visita al show room.
            </p>
            <Link href="/#contacto" className="btn-primary inline-flex">
              Hablemos
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
