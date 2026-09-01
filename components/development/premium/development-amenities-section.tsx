import { Check, Sparkles } from "lucide-react";
import type { DevelopmentDetailModel } from "@/lib/development-detail-view-model";

interface DevelopmentAmenitiesSectionProps {
  model: DevelopmentDetailModel;
}

export function DevelopmentAmenitiesSection({ model }: DevelopmentAmenitiesSectionProps) {
  const { highlights } = model;

  if (!highlights.length) return null;

  return (
    <section id="amenities" className="bg-[#070707] px-5 py-20 text-[#f8f5ef] md:px-10 md:py-28 lg:px-14">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-14 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]" data-dev-reveal>
          <h2 className="font-display text-[clamp(3rem,7vw,7rem)] font-light leading-[0.9] tracking-[-0.04em]">
            Diferenciales que sostienen el valor.
          </h2>
          <p className="max-w-2xl self-end text-lg leading-relaxed text-white/70">
            Amenities, características y atributos cargados para entender la experiencia de uso y la salida comercial.
          </p>
        </div>

        <div className="grid border-t border-white/18 md:grid-cols-2 lg:grid-cols-5" data-dev-reveal>
          {highlights.map((item, index) => (
            <div
              key={`${item}-${index}`}
              className="min-h-[230px] border-b border-white/18 py-7 md:border-r md:px-6 lg:last:border-r-0"
            >
              <div className="mb-12 flex items-center justify-between">
                <span className="font-display text-3xl font-light text-[#d8c4af]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {index === 0 ? (
                  <Sparkles className="h-5 w-5 text-[#d8c4af]" />
                ) : (
                  <Check className="h-5 w-5 text-[#d8c4af]" />
                )}
              </div>
              <p className="text-base leading-relaxed text-white/78">{item}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
