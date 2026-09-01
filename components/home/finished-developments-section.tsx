import Link from "next/link";
import { ArrowUpRight, CheckCircle2, MapPin } from "lucide-react";
import { getDevelopments } from "@/lib/developments-db";
import { getListingVisibilityFilter } from "@/lib/listing-access";
import { formatPrice } from "@/lib/utils";
import { DevelopmentCoverMedia } from "@/components/development/development-cover-media";
import { getDevelopmentVideo } from "@/lib/development-media";
import { DEVELOPMENT_STATUS_LABELS } from "@/types";

export async function FinishedDevelopmentsSection() {
  const visibility = await getListingVisibilityFilter();
  const finishedDevelopments = (await getDevelopments({ visibility })).filter(
    (development) =>
      development.status === "finalizado" || development.status === "entregado"
  );
  const finishedWithAvailability = finishedDevelopments.filter(
    (development) => (development.availableUnits ?? 0) > 0
  );
  const deliveredWithoutAvailability = finishedDevelopments.filter(
    (development) => (development.availableUnits ?? 0) <= 0
  );

  if (!finishedDevelopments.length) return null;

  return (
    <section
      id="desarrollos-terminados"
      className="relative overflow-hidden bg-[#efe6d8] px-5 py-20 text-[#151415] md:px-10 md:py-28 lg:px-14"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,0.70),transparent_28%),radial-gradient(circle_at_82%_88%,rgba(122,82,60,0.12),transparent_32%)]" />
      <div className="relative z-10 mx-auto max-w-[1500px]">
        <div className="mb-12 grid gap-6 md:mb-16 lg:grid-cols-[0.85fr_0.65fr] lg:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7a523c]">
              Trayectoria
            </p>
            <h2 className="mt-4 max-w-5xl font-display text-[clamp(3rem,7vw,6.8rem)] font-light leading-[0.92] tracking-[-0.04em]">
              Desarrollos terminados.
            </h2>
          </div>
          <p className="max-w-xl text-base leading-relaxed text-[#151415]/68 md:text-lg">
            Proyectos finalizados separados entre oportunidades todavía disponibles y obras ya
            entregadas sin unidades en venta.
          </p>
        </div>

        <FinishedDevelopmentGroup
          title="Terminados con unidades en venta"
          description="Obras finalizadas que todavía tienen unidades disponibles para comprar."
          developments={finishedWithAvailability}
        />

        <FinishedDevelopmentGroup
          title="Entregados"
          description="Desarrollos ya entregados donde no quedan unidades disponibles para vender."
          developments={deliveredWithoutAvailability}
          className="mt-14"
        />
      </div>
    </section>
  );
}

type FinishedDevelopmentGroupProps = {
  title: string;
  description: string;
  developments: Awaited<ReturnType<typeof getDevelopments>>;
  className?: string;
};

function FinishedDevelopmentGroup({
  title,
  description,
  developments,
  className = "",
}: FinishedDevelopmentGroupProps) {
  if (!developments.length) return null;

  return (
    <div className={className}>
      <div className="mb-6 flex flex-col justify-between gap-3 border-t border-[#151415]/12 pt-6 md:flex-row md:items-end">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7a523c]">
            {developments.length} proyectos
          </p>
          <h3 className="mt-2 font-display text-4xl font-light tracking-[-0.04em] md:text-5xl">
            {title}
          </h3>
        </div>
        <p className="max-w-md text-sm leading-relaxed text-[#151415]/60 md:text-base">
          {description}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {developments.map((development) => {
          const primaryImage =
            development.images.find((image) => image.isPrimary)?.url ||
            development.images[0]?.url;
          const video = getDevelopmentVideo(
            development.name,
            development.videoUrl,
            development.videoIsPrimary
          );
          const priceFrom = development.minPriceAvailable ?? development.priceFrom;

          return (
            <Link
              key={development.id}
              href={`/desarrollos/${development.slug}`}
              className="group grid overflow-hidden border border-[#151415]/12 bg-[#f8f5ef] transition-transform duration-500 hover:-translate-y-1 md:grid-cols-[0.95fr_1.05fr]"
            >
              <div className="relative min-h-[260px] overflow-hidden bg-[#151415] md:min-h-[360px]">
                {(primaryImage || video) && (
                  <DevelopmentCoverMedia
                    name={development.name}
                    image={primaryImage}
                    video={video}
                    className="object-cover transition-transform duration-[1600ms] group-hover:scale-[1.04]"
                    sizes="(max-width: 768px) 100vw, 45vw"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#151415]/45 via-transparent to-transparent" />
                <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-[#f8f5ef]/92 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#151415]">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#7a523c]" />
                  {DEVELOPMENT_STATUS_LABELS[development.status]}
                </div>
              </div>

              <div className="flex min-h-[320px] flex-col justify-between p-6 md:p-8">
                <div>
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[#151415]/48">
                    <MapPin className="h-3.5 w-3.5" />
                    {development.location}
                  </div>
                  <h3 className="mt-5 font-display text-[clamp(2.3rem,4vw,4.5rem)] font-light leading-[0.92] tracking-[-0.04em] text-[#151415]">
                    {development.name}
                  </h3>
                  {development.shortDescription && (
                    <p className="mt-5 max-w-lg text-sm leading-relaxed text-[#151415]/66 md:text-base">
                      {development.shortDescription}
                    </p>
                  )}
                </div>

                <div className="mt-8 flex flex-wrap items-end justify-between gap-5 border-t border-[#151415]/12 pt-5">
                  <div className="flex flex-wrap gap-6">
                    <div>
                      <p className="text-[9px] uppercase tracking-[0.18em] text-[#151415]/45">
                        Disponibles
                      </p>
                      <p className="mt-1 font-display text-xl text-[#151415]">
                        {development.availableUnits ?? 0}
                      </p>
                    </div>
                    {development.completionDate && (
                      <div>
                        <p className="text-[9px] uppercase tracking-[0.18em] text-[#151415]/45">
                          Entrega
                        </p>
                        <p className="mt-1 font-display text-xl text-[#151415]">
                          {development.completionDate}
                        </p>
                      </div>
                    )}
                    {priceFrom && (
                      <div>
                        <p className="text-[9px] uppercase tracking-[0.18em] text-[#151415]/45">
                          Desde
                        </p>
                        <p className="mt-1 font-display text-xl text-[#7a523c]">
                          {formatPrice(priceFrom)}
                        </p>
                      </div>
                    )}
                  </div>
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#151415] text-[#f8f5ef] transition-transform duration-500 group-hover:-translate-y-1 group-hover:translate-x-1">
                    <ArrowUpRight className="h-5 w-5" />
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
