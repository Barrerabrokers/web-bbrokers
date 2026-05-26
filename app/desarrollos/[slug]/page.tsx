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
import { ParallaxImage } from "@/components/ui/parallax-image";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

  return (
    <div className="min-h-screen bg-ink">
      <Header />

      <main>
        {/* Hero with primary image */}
        <section className="relative bg-ink text-bone pt-24">
          <div className="relative h-[60vh] md:h-[75vh] overflow-hidden">
            {primaryImage && (
              <ParallaxImage
                src={primaryImage}
                alt={development.name}
                fill
                priority
                speed={-80}
                wrapperClassName="absolute inset-0"
                className="object-cover"
                sizes="100vw"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-ink/40 via-ink/20 to-ink" />

            <div className="absolute inset-0 flex flex-col justify-end pb-12 md:pb-20">
              <div className="container-custom">
                <Reveal variant="fade-up" duration={1000}>
                  <Link
                    href="/desarrollos"
                    className="inline-flex items-center gap-2 text-bone/70 hover:text-accent text-[11px] uppercase tracking-widest mb-6"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Todos los desarrollos
                  </Link>
                </Reveal>

                <Reveal variant="fade-up" delay={150} duration={1200}>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="px-3 py-1.5 bg-accent text-ink text-[10px] uppercase tracking-widest font-medium rounded-full">
                      {DEVELOPMENT_STATUS_LABELS[development.status]}
                    </span>
                    {development.availableUnits !== undefined && (
                      <span className="px-3 py-1.5 bg-bone/10 backdrop-blur-sm text-bone text-[10px] uppercase tracking-widest rounded-full border border-bone/20">
                        {development.availableUnits} unidades disponibles
                      </span>
                    )}
                  </div>
                </Reveal>

                <Reveal variant="clip-up" delay={300} duration={1600}>
                  <h1 className="font-display font-light text-[40px] md:text-[72px] lg:text-[96px] tracking-[-0.03em] leading-[0.95] text-bone max-w-5xl">
                    {development.name}
                  </h1>
                </Reveal>

                <Reveal variant="fade-up" delay={500} duration={1200}>
                  <div className="flex items-center gap-2 mt-5 text-bone/70">
                    <MapPin className="h-4 w-4" />
                    <span className="text-base">
                      {development.address} · {development.location}
                    </span>
                  </div>
                </Reveal>
              </div>
            </div>
          </div>
        </section>


        {/* Stats strip */}
        <section className="bg-ink text-bone border-y border-bone/15">
          <div className="container-custom py-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-bone/50 mb-1">
                  Desde
                </p>
                <div className="font-display font-light text-2xl md:text-3xl text-accent">
                  {priceFrom ? formatPrice(priceFrom) : "—"}
                </div>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-bone/50 mb-1">
                  Avance de obra
                </p>
                <div className="font-display font-light text-2xl md:text-3xl text-bone">
                  {development.progress}%
                </div>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-bone/50 mb-1">
                  Entrega
                </p>
                <div className="font-display font-light text-2xl md:text-3xl text-bone flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-accent" />
                  {development.completionDate || "—"}
                </div>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-bone/50 mb-1">
                  Unidades
                </p>
                <div className="font-display font-light text-2xl md:text-3xl text-bone flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-accent" />
                  {development.unitsCount || 0}
                </div>
              </div>
              {development.brochureUrl && (
                <div>
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

            <UnitsList units={development.units || []} />
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
