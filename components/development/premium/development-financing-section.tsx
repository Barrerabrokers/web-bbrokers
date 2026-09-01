import { Calculator, FileSpreadsheet, FileText, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { formatPrice } from "@/lib/utils";
import type { DevelopmentDetailModel } from "@/lib/development-detail-view-model";

interface DevelopmentFinancingSectionProps {
  model: DevelopmentDetailModel;
}

export function DevelopmentFinancingSection({ model }: DevelopmentFinancingSectionProps) {
  const { development, priceFrom, units, brochureHref, priceListHref } = model;
  const unitWithPlan = units.find(
    (unit) => unit.downPayment || unit.installmentCount || unit.installmentValue
  );
  const hasDocuments = Boolean(brochureHref || priceListHref);

  return (
    <section id="financiacion" className="border-y border-[#070707]/10 bg-[#d8c4af] px-5 py-16 md:px-10 md:py-24 lg:px-14">
      <div className="mx-auto grid max-w-[1500px] gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
        <div data-dev-reveal>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#3a1d17]/68">
            Propuesta comercial
          </p>
          <h2 className="mt-4 font-display text-[clamp(3rem,6vw,6rem)] font-light leading-[0.92] tracking-[-0.04em]">
            Financiación presentada con claridad.
          </h2>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-[#070707]/68 md:text-lg">
            Los valores se muestran a partir de la información cargada en las unidades. Las condiciones pueden variar según disponibilidad.
          </p>
        </div>

        <div className="grid gap-px overflow-hidden border border-[#070707]/12 bg-[#070707]/12 md:grid-cols-3" data-dev-reveal>
          <div className="bg-[#f8f5ef] p-6">
            <Calculator className="mb-10 h-5 w-5 text-[#3a1d17]" />
            <p className="text-[10px] uppercase tracking-[0.16em] text-[#070707]/48">
              Precio desde
            </p>
            <p className="mt-2 font-display text-3xl font-light">
              {priceFrom ? formatPrice(priceFrom) : "Consultar"}
            </p>
          </div>
          <div className="bg-[#f8f5ef] p-6">
            <p className="mb-10 text-[10px] uppercase tracking-[0.16em] text-[#070707]/48">
              Anticipo
            </p>
            <p className="font-display text-3xl font-light">
              {unitWithPlan?.downPayment ? formatPrice(unitWithPlan.downPayment) : "Consultar"}
            </p>
          </div>
          <div className="bg-[#f8f5ef] p-6">
            <p className="mb-10 text-[10px] uppercase tracking-[0.16em] text-[#070707]/48">
              Cuotas
            </p>
            <p className="font-display text-3xl font-light">
              {unitWithPlan?.installmentCount && unitWithPlan.installmentValue
                ? `${unitWithPlan.installmentCount} x ${formatPrice(unitWithPlan.installmentValue)}`
                : "Consultar"}
            </p>
          </div>
        </div>

        {hasDocuments && (
          <div className="lg:col-start-2" data-dev-reveal>
            <div className="flex flex-wrap gap-3">
              {brochureHref && (
                <Link
                  href={brochureHref}
                  className="inline-flex min-h-12 items-center gap-2 rounded-full border border-[#070707]/18 bg-[#f8f5ef] px-5 text-sm font-medium transition-colors hover:border-[#070707]/40"
                >
                  <FileText className="h-4 w-4" />
                  Brochure
                </Link>
              )}
              {priceListHref && (
                <a
                  href={priceListHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#070707] px-5 text-sm font-medium text-[#f8f5ef] transition-colors hover:bg-[#3a1d17]"
                >
                  <LockKeyhole className="h-4 w-4" />
                  <FileSpreadsheet className="h-4 w-4" />
                  Lista de precios
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
