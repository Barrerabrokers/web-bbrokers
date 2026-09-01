import { BarChart3, Building2, Calendar, Home, Layers3, Ruler } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import type { DevelopmentDetailModel } from "@/lib/development-detail-view-model";

interface DevelopmentOverviewProps {
  model: DevelopmentDetailModel;
}

export function DevelopmentOverview({ model }: DevelopmentOverviewProps) {
  const { development, descriptionParagraphs, summaryStats, typologies, minArea, maxArea, priceFrom } = model;
  const paragraphs = descriptionParagraphs.length
    ? descriptionParagraphs
    : [development.description];

  return (
    <section id="resumen" className="px-5 py-20 md:px-10 md:py-28 lg:px-14">
      <div className="mx-auto grid max-w-[1500px] gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start" data-dev-reveal>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#3a1d17]/68">
            {development.address} · {development.location}
          </p>
          <h2 className="mt-5 max-w-4xl font-display text-[clamp(3rem,7vw,6.8rem)] font-light leading-[0.92] tracking-[-0.04em]">
            Una presentación clara para decidir inversión.
          </h2>
        </div>

        <div className="space-y-10">
          <div className="grid grid-cols-2 gap-px overflow-hidden border border-[#070707]/12 bg-[#070707]/12 md:grid-cols-3" data-dev-reveal>
            {summaryStats.map((item, index) => {
              const Icon = [Calendar, Building2, Home, BarChart3, Ruler, Layers3][index] || BarChart3;
              return (
                <div key={`${item.label}-${item.value}`} className="bg-[#f8f5ef] p-5 md:p-6">
                  <Icon className="mb-8 h-5 w-5 text-[#3a1d17]" />
                  <p className="text-[10px] uppercase tracking-[0.16em] text-[#070707]/48">
                    {item.label}
                  </p>
                  <p className="mt-2 font-display text-2xl font-light leading-tight tracking-[-0.025em]">
                    {item.label === "Precio desde" && priceFrom ? formatPrice(priceFrom) : item.value}
                  </p>
                  {item.supporting && (
                    <p className="mt-2 text-xs leading-relaxed text-[#070707]/52">{item.supporting}</p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="max-w-[72ch] space-y-5 text-base leading-[1.85] text-[#070707]/74 md:text-lg" data-dev-reveal>
            {paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-2" data-dev-reveal>
            {typologies.length > 0 && (
              <div className="border border-[#070707]/12 bg-[#f8f5ef]/70 p-6">
                <Layers3 className="mb-8 h-5 w-5 text-[#3a1d17]" />
                <p className="text-[10px] uppercase tracking-[0.16em] text-[#070707]/48">Tipologías</p>
                <p className="mt-3 text-lg leading-relaxed text-[#070707]/78">{typologies.join(" · ")}</p>
              </div>
            )}
            {(minArea || maxArea) && (
              <div className="border border-[#070707]/12 bg-[#f8f5ef]/70 p-6">
                <Ruler className="mb-8 h-5 w-5 text-[#3a1d17]" />
                <p className="text-[10px] uppercase tracking-[0.16em] text-[#070707]/48">Superficies</p>
                <p className="mt-3 text-lg leading-relaxed text-[#070707]/78">
                  {minArea === maxArea ? `${minArea} m²` : `${minArea} a ${maxArea} m²`}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
