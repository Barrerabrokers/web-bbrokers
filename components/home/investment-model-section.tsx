import Link from "next/link";
import Image from "next/image";
import {
  Wallet,
  TrendingUp,
  Home,
  Building2,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { getFullSiteSettings } from "@/lib/db";

/**
 * Investment Model Section — server component que lee site_settings.
 * Si una palabra del título coincide con la lista TARGET_WORDS,
 * se renderiza en cursiva (estilo editorial).
 */

// Palabras clave que se renderizan en cursiva si aparecen en el título
const ITALIC_WORDS = ["inversión", "inversion", "invertir"];

function renderWithItalics(text: string) {
  // Match case-insensitive de las palabras clave; preserva resto literal
  const pattern = new RegExp(`(${ITALIC_WORDS.join("|")})`, "gi");
  const parts = text.split(pattern);
  return parts.map((part, i) =>
    ITALIC_WORDS.includes(part.toLowerCase()) ? (
      <span key={i} className="italic">{part}</span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

const STEP_ICONS = [Wallet, Building2, TrendingUp, Home];

export async function InvestmentModelSection() {
  const s = await getFullSiteSettings();

  const steps = [
    { no: "01", icon: STEP_ICONS[0], title: s.investmentStep1Title, description: s.investmentStep1Description, highlight: s.investmentStep1Highlight, value: s.investmentStep1Value },
    { no: "02", icon: STEP_ICONS[1], title: s.investmentStep2Title, description: s.investmentStep2Description, highlight: s.investmentStep2Highlight, value: s.investmentStep2Value },
    { no: "03", icon: STEP_ICONS[2], title: s.investmentStep3Title, description: s.investmentStep3Description, highlight: s.investmentStep3Highlight, value: s.investmentStep3Value },
    { no: "04", icon: STEP_ICONS[3], title: s.investmentStep4Title, description: s.investmentStep4Description, highlight: s.investmentStep4Highlight, value: s.investmentStep4Value },
  ];

  const benefits = [
    s.investmentBenefit1, s.investmentBenefit2, s.investmentBenefit3,
    s.investmentBenefit4, s.investmentBenefit5, s.investmentBenefit6,
  ].filter(Boolean);

  return (
    <section
      id="modelo"
      className="relative section-pad bg-bone text-ink overflow-hidden"
    >
      {/* Background accents */}
      <div className="absolute inset-0 bg-grain opacity-40 pointer-events-none" />
      <div
        aria-hidden="true"
        className="absolute top-0 right-0 w-[50vw] h-[50vw] max-w-[700px] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at top right, rgba(21,20,21,0.15) 0%, transparent 60%)",
        }}
      />

      <div className="container-custom relative z-10">
        {/* Section header */}
        <div className="grid grid-cols-12 gap-6 mb-16 md:mb-24">
          <div className="col-span-12 md:col-span-1">
            <p className="font-display italic font-light text-xl md:text-2xl text-ink/40">
              02
            </p>
          </div>

          <div className="col-span-12 md:col-span-7 md:col-start-3">
            <p className="text-[11px] uppercase tracking-widest text-accent-700 mb-4">
              {s.investmentEyebrow}
            </p>
            <h2 className="font-display font-light text-[36px] md:text-[56px] lg:text-[72px] tracking-[-0.025em] leading-[1.02] text-ink">
              {renderWithItalics(s.investmentTitle)}
            </h2>
          </div>

          <div className="col-span-12 md:col-span-3 md:col-start-10 flex items-end">
            <p className="text-ink/65 text-base leading-relaxed">
              {s.investmentDescription}
            </p>
          </div>
        </div>

        {/* Imagen opcional */}
        {s.investmentImage && (
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg mb-16 md:mb-20 bg-cream-200">
            <Image
              src={s.investmentImage}
              alt={s.investmentTitle}
              fill
              className="object-cover"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/20 via-transparent to-transparent pointer-events-none" />
          </div>
        )}

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div
                key={step.no}
                className="group relative p-6 md:p-8 border border-ink/15 rounded-lg hover:border-accent/50 transition-all duration-700"
              >
                {/* Step number */}
                <div className="flex items-center justify-between mb-6">
                  <span className="font-display italic font-light text-xl text-accent-700">
                    {step.no}
                  </span>
                  <Icon className="h-6 w-6 text-ink/40 group-hover:text-accent-700 transition-colors duration-500" />
                </div>

                {/* Value highlight */}
                <div className="mb-4">
                  <p className="text-[10px] uppercase tracking-widest text-ink/50 mb-1">
                    {step.highlight}
                  </p>
                  <div className="font-display font-light text-4xl md:text-5xl text-ink tracking-tight">
                    {step.value}
                  </div>
                </div>

                {/* Content */}
                <h3 className="font-display font-light text-xl text-ink mb-3 tracking-tight group-hover:italic transition-all duration-500">
                  {step.title}
                </h3>
                <p className="text-sm text-ink/65 leading-relaxed">
                  {step.description}
                </p>

                {/* Arrow connector */}
                {idx < steps.length - 1 && (
                  <div className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                    <ArrowRight className="h-5 w-5 text-accent-700" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Benefits + CTA */}
        <div className="grid grid-cols-12 gap-6 pt-16 border-t border-ink/15">
          <div className="col-span-12 lg:col-span-6">
            <h3 className="font-display font-light text-2xl md:text-3xl text-ink mb-8 tracking-tight">
              {renderWithItalics(s.investmentBenefitsTitle)}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {benefits.map((benefit, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-accent-700 flex-shrink-0" />
                  <span className="text-ink/75">{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="col-span-12 lg:col-span-5 lg:col-start-8">
            <div className="bg-ink text-bone p-8 md:p-10 rounded-lg">
              <p className="text-[11px] uppercase tracking-widest text-accent mb-4">
                {s.investmentCtaEyebrow}
              </p>
              <h4 className="font-display font-light text-2xl md:text-3xl text-bone mb-4 tracking-tight">
                {s.investmentCtaTitle}
              </h4>
              <p className="text-bone/70 text-sm mb-6 leading-relaxed">
                {s.investmentCtaDescription}
              </p>
              <Link href="#contacto" className="btn-primary w-full justify-center">
                Agendar consulta
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
