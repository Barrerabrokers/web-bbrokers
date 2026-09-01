import { UnitsList } from "@/components/development/units-list";
import type { DevelopmentDetailModel } from "@/lib/development-detail-view-model";

interface DevelopmentUnitsSectionProps {
  model: DevelopmentDetailModel;
  shareToken?: string;
}

export function DevelopmentUnitsSection({ model, shareToken }: DevelopmentUnitsSectionProps) {
  const { development, units } = model;

  return (
    <section id="unidades" className="bg-[#0d0d0d] px-5 py-20 text-[#f8f5ef] md:px-10 md:py-28 lg:px-14">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-10 grid gap-6 lg:grid-cols-[0.9fr_0.8fr] lg:items-end" data-dev-reveal>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#d8c4af]">
              Tipologías y unidades
            </p>
            <h2 className="mt-3 max-w-4xl font-display text-[clamp(3rem,7vw,7rem)] font-light leading-[0.9] tracking-[-0.04em] text-white">
              Elegí la unidad que mejor se adapta a tu inversión.
            </h2>
          </div>
        </div>

        <div data-dev-reveal>
          <UnitsList
            units={units}
            developmentFeatures={development.features}
            developmentName={development.name}
            developmentLocation={`${development.address} · ${development.location}`}
            developmentSlug={development.slug}
            shareToken={development.visibility === "agents" ? shareToken : undefined}
          />
        </div>
      </div>
    </section>
  );
}
