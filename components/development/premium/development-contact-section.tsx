import { DevelopmentInquiryPanel } from "@/components/development/development-inquiry-panel";
import { ShareListingPdf } from "@/components/share-listing-pdf";
import type { DevelopmentDetailModel } from "@/lib/development-detail-view-model";

interface DevelopmentContactSectionProps {
  model: DevelopmentDetailModel;
  pageUrl: string;
  pdfUrl: string;
}

export function DevelopmentContactSection({ model, pageUrl, pdfUrl }: DevelopmentContactSectionProps) {
  const { development } = model;

  return (
    <section id="contacto-desarrollo" className="px-5 py-20 md:px-10 md:py-28 lg:px-14">
      <div className="mx-auto grid max-w-[1500px] gap-8 lg:grid-cols-[minmax(0,1fr)_440px] lg:items-start">
        <div data-dev-reveal>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#3a1d17]/68">
            Consulta privada
          </p>
          <h2 className="mt-4 max-w-4xl font-display text-[clamp(3rem,7vw,7rem)] font-light leading-[0.9] tracking-[-0.04em]">
            Hablemos de este proyecto.
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#070707]/68">
            Te compartimos disponibilidad, forma de pago, lista actualizada y la lectura comercial de la zona.
          </p>
        </div>

        <div className="space-y-4" data-dev-reveal>
          <div className="border border-[#070707]/12 bg-[#f8f5ef]/74 p-5">
            <ShareListingPdf
              title={development.name}
              pdfUrl={pdfUrl}
              pageUrl={pageUrl}
              typeLabel="desarrollo"
            />
          </div>
          <DevelopmentInquiryPanel
            developmentName={development.name}
            location={`${development.address}, ${development.location}`}
          />
        </div>
      </div>
    </section>
  );
}
