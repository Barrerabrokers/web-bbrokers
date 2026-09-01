import { ArrowRight, MapPin, Navigation } from "lucide-react";
import type { DevelopmentDetailModel } from "@/lib/development-detail-view-model";

interface DevelopmentLocationSectionProps {
  model: DevelopmentDetailModel;
}

export function DevelopmentLocationSection({ model }: DevelopmentLocationSectionProps) {
  const { development, mapEmbedUrl, mapExternalUrl } = model;

  return (
    <section id="ubicacion" className="px-5 pb-20 md:px-10 md:pb-28 lg:px-14">
      <div className="mx-auto grid max-w-[1500px] gap-8 lg:grid-cols-[0.86fr_1.14fr] lg:items-stretch">
        <div className="flex flex-col justify-between border border-[#070707]/12 bg-[#f8f5ef]/72 p-6 md:p-8" data-dev-reveal>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#3a1d17]/68">
              Ubicación
            </p>
            <h2 className="mt-4 font-display text-[clamp(3rem,6vw,6.3rem)] font-light leading-[0.9] tracking-[-0.04em]">
              {development.location} como decisión.
            </h2>
          </div>

          <div className="mt-10 space-y-5">
            <div className="flex gap-3 border-t border-[#070707]/12 pt-5">
              <MapPin className="mt-1 h-5 w-5 shrink-0 text-[#3a1d17]" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#070707]/45">
                  Dirección
                </p>
                <p className="mt-1 text-lg text-[#070707]/78">{development.address}</p>
                <p className="text-sm text-[#070707]/52">
                  {development.location} · Ciudad de Buenos Aires
                </p>
              </div>
            </div>
            <a
              href={mapExternalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#070707] px-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#f8f5ef] transition-transform hover:-translate-y-0.5"
            >
              Ver ubicación en Google Maps
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div className="relative min-h-[420px] overflow-hidden border border-[#070707]/12 bg-[#d8c4af] md:min-h-[560px]" data-dev-reveal>
          <iframe
            title={`Mapa de ubicación de ${development.name}`}
            src={mapEmbedUrl}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="absolute inset-0 h-full w-full"
          />
          <div className="pointer-events-none absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-[#f8f5ef]/92 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#070707] shadow-sm">
            <Navigation className="h-3.5 w-3.5" />
            Plano urbano
          </div>
        </div>
      </div>
    </section>
  );
}
