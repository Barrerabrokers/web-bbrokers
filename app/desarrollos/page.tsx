import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, MapPin, TrendingUp } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { getDevelopments } from "@/lib/developments-db";
import { DEVELOPMENT_STATUS_LABELS } from "@/types";
import { formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DesarrollosPage() {
  const developments = await getDevelopments();

  return (
    <div className="min-h-screen bg-ink">
      <Header />

      <main>
        {/* Hero */}
        <section className="relative bg-ink text-bone pt-32 pb-16 md:pt-40 md:pb-24 overflow-hidden">
          <div className="absolute inset-0 bg-grain opacity-20 pointer-events-none" />
          <div
            aria-hidden
            className="absolute top-0 right-0 w-[40vw] h-[40vw] max-w-[600px] pointer-events-none"
            style={{
              background:
            "radial-gradient(ellipse at top right, rgba(107,74,53,0.22) 0%, transparent 60%)",
            }}
          />

          <div className="container-custom relative z-10">
            <p className="text-[11px] uppercase tracking-widest text-accent mb-4">
              Catálogo
            </p>
            <h1 className="font-display font-light text-[44px] md:text-[80px] lg:text-[100px] tracking-[-0.025em] leading-[0.96] text-bone max-w-5xl">
              Todos nuestros{" "}
              <span className="italic">desarrollos</span>.
            </h1>
            <p className="mt-8 max-w-2xl text-bone/70 text-lg leading-relaxed">
              {developments.length} proyecto
              {developments.length !== 1 ? "s" : ""} en Buenos Aires con
              financiación flexible y retornos del 30-40%.
            </p>
          </div>
        </section>


        {/* Grid */}
        <section className="bg-ink text-bone pb-24 md:pb-32">
          <div className="container-custom">
            {developments.length === 0 ? (
              <div className="border-t border-bone/15 py-20 text-center">
                <p className="text-bone/60 text-lg">
                  Pronto vas a encontrar nuestros desarrollos disponibles aquí.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-12 border-t border-bone/15 pt-12">
                {developments.map((dev, idx) => {
                  const primaryImage =
                    dev.images.find((i) => i.isPrimary)?.url ||
                    dev.images[0]?.url;
                  const priceFrom =
                    dev.minPriceAvailable ?? dev.priceFrom;

                  return (
                    <Link
                      key={dev.id}
                      href={`/desarrollos/${dev.slug}`}
                      className="group block"
                    >
                      <div className="relative aspect-[4/5] mb-5 overflow-hidden bg-ink-600">
                        {primaryImage && (
                          <Image
                            src={primaryImage}
                            alt={dev.name}
                            fill
                            className="object-cover transition-transform duration-[1500ms] group-hover:scale-[1.05]"
                            style={{
                              transitionTimingFunction: "var(--f-cubic)",
                            }}
                            sizes="(max-width: 768px) 100vw, 33vw"
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent" />

                        <div className="absolute top-3 left-3 flex items-center gap-2.5 text-bone">
                          <span className="font-display italic font-light text-2xl">
                            {String(idx + 1).padStart(2, "0")}
                          </span>
                        </div>

                        <div className="absolute top-3 right-3 flex flex-col items-end gap-2">
                          <span className="px-2.5 py-1 bg-accent text-ink text-[9px] uppercase tracking-widest font-medium rounded-full">
                            {DEVELOPMENT_STATUS_LABELS[dev.status]}
                          </span>
                          {dev.availableUnits !== undefined &&
                            dev.availableUnits > 0 && (
                              <span className="flex items-center gap-1 px-2.5 py-1 bg-bone/10 backdrop-blur-sm text-bone text-[10px] uppercase tracking-widest rounded-full border border-bone/20">
                                <TrendingUp className="h-3 w-3" />
                                {dev.availableUnits} disponibles
                              </span>
                            )}
                        </div>

                        <div className="absolute bottom-3 right-3 h-10 w-10 rounded-full bg-accent flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-500">
                          <ArrowUpRight className="h-4 w-4 text-ink" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-bone/50 text-[10px] uppercase tracking-widest">
                          <MapPin className="h-3 w-3" />
                          {dev.location}
                        </div>

                        <h3 className="font-display font-light text-2xl text-bone tracking-tight group-hover:italic transition-all duration-500 line-clamp-2">
                          {dev.name}
                        </h3>

                        <div className="flex items-baseline justify-between pt-3 border-t border-bone/15">
                          <span className="font-display text-lg text-accent">
                            {priceFrom ? `Desde ${formatPrice(priceFrom)}` : "—"}
                          </span>
                          {dev.completionDate && (
                            <span className="text-[10px] uppercase tracking-widest text-bone/50">
                              {dev.completionDate}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
