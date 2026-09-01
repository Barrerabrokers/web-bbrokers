import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowUpRight, Building2, FileText, MapPin } from "lucide-react";
import { getQuoteForPublicShare } from "@/lib/db";
import { absoluteUrl, SITE_NAME } from "@/lib/seo";

type QuoteSharePageProps = {
  params: {
    id: string;
  };
};

export const dynamic = "force-dynamic";

function quoteTitle(developmentName?: string, unitNumber?: string) {
  const development = developmentName || SITE_NAME;
  const unit = unitNumber || "unidad";
  return `Cotización ${development} - Unidad ${unit}`;
}

function quoteDescription(developmentName?: string, unitNumber?: string) {
  return `Te comparto la ficha de cotización de ${
    developmentName || SITE_NAME
  } - Unidad ${unitNumber || "unidad"}.`;
}

function formatMoney(value?: number, currency = "USD") {
  if (!Number.isFinite(value) || Number(value) <= 0) return "Consultar";
  const symbol = currency === "USD" ? "US$" : currency === "ARS" ? "$" : currency;
  return `${symbol} ${Number(value).toLocaleString("es-AR")}`;
}

function formatArea(value?: number) {
  if (!Number.isFinite(value) || Number(value) <= 0) return "Consultar";
  return `${Number(value).toLocaleString("es-AR")} m²`;
}

function formatTypology(bedrooms?: number, bathrooms?: number) {
  const parts = [
    Number.isFinite(bedrooms) && Number(bedrooms) > 0 ? `${Number(bedrooms)} amb.` : null,
    Number.isFinite(bathrooms) && Number(bathrooms) > 0 ? `${Number(bathrooms)} baño` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "Consultar";
}

function quoteFallbackRows(quote: Awaited<ReturnType<typeof getQuoteForPublicShare>>) {
  if (!quote) return [];

  return [
    ["Desarrollo", quote.developmentName],
    ["Unidad", quote.unitNumber],
    ["Precio final", formatMoney(quote.payload.price, quote.payload.currency)],
    ["Superficie total", formatArea(quote.payload.totalArea || quote.payload.area)],
    [
      "Financiación",
      [
        quote.payload.downPayment
          ? `Anticipo ${formatMoney(quote.payload.downPayment, quote.payload.currency)}`
          : null,
        quote.payload.installmentCount && quote.payload.installmentValue
          ? `${quote.payload.installmentCount} cuotas de ${formatMoney(
              quote.payload.installmentValue,
              quote.payload.currency
            )}`
          : null,
      ]
        .filter(Boolean)
        .join(" · ") || "Consultar",
    ],
  ].filter(([, value]) => Boolean(value));
}

export async function generateMetadata({ params }: QuoteSharePageProps): Promise<Metadata> {
  const quote = await getQuoteForPublicShare(params.id);
  if (!quote) {
    return {
      title: `Cotización | ${SITE_NAME}`,
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const title = quoteTitle(quote.developmentName, quote.unitNumber);
  const description = quoteDescription(quote.developmentName, quote.unitNumber);
  const previewImage = absoluteUrl(quote.payload.imageUrls?.[0] || "/icon.svg");
  const url = absoluteUrl(`/cotizaciones/${quote.id}`);

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: "article",
      images: [
        {
          url: previewImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [previewImage],
    },
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function QuoteSharePage({ params }: QuoteSharePageProps) {
  const quote = await getQuoteForPublicShare(params.id);
  if (!quote) notFound();

  const title = quoteTitle(quote.developmentName, quote.unitNumber);
  const description = quoteDescription(quote.developmentName, quote.unitNumber);
  const previewImage = quote.payload.imageUrls?.[0];
  const secondaryImage = quote.payload.imageUrls?.[1];
  const pdfUrl = quote.payload.pdfUrl;
  const hasVisualPreview = Boolean(previewImage || pdfUrl);
  const fallbackRows = quoteFallbackRows(quote);
  const financing = [
    quote.payload.downPayment
      ? `Anticipo ${formatMoney(quote.payload.downPayment, quote.payload.currency)}`
      : null,
    quote.payload.installmentCount && quote.payload.installmentValue
      ? `${quote.payload.installmentCount} cuotas de ${formatMoney(
          quote.payload.installmentValue,
          quote.payload.currency
        )}`
      : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <main className="min-h-screen bg-bone text-ink">
      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col justify-center px-5 py-10 md:px-8">
        <div className="grid items-center gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-accent-700">
              Barrera Brokers
            </p>
            <h1 className="mt-5 max-w-3xl text-balance font-display text-4xl leading-[0.95] tracking-tight text-ink md:text-6xl lg:text-7xl">
              {title}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink/68">
              {description}
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <div className="border-t border-ink/14 pt-4">
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-ink/45">
                  Precio final
                </p>
                <p className="mt-1 font-display text-3xl leading-none text-ink">
                  {formatMoney(quote.payload.price, quote.payload.currency)}
                </p>
              </div>
              <div className="border-t border-ink/14 pt-4">
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-ink/45">
                  Superficie total
                </p>
                <p className="mt-1 font-display text-3xl leading-none text-ink">
                  {formatArea(quote.payload.totalArea || quote.payload.area)}
                </p>
              </div>
              <div className="border-t border-ink/14 pt-4">
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-ink/45">
                  Unidad
                </p>
                <p className="mt-1 text-lg font-medium text-ink">
                  {quote.unitNumber}
                  {quote.payload.floor ? ` · Piso ${quote.payload.floor}` : ""}
                </p>
              </div>
              <div className="border-t border-ink/14 pt-4">
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-ink/45">
                  Tipología
                </p>
                <p className="mt-1 text-lg font-medium text-ink">
                  {formatTypology(quote.payload.bedrooms, quote.payload.bathrooms)}
                </p>
              </div>
            </div>

            {financing.length > 0 && (
              <div className="mt-6 rounded-2xl border border-ink/12 bg-white/55 p-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-700">
                  Financiación
                </p>
                <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink/72">
                  {financing.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {pdfUrl ? (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-6 text-sm font-medium uppercase tracking-[0.14em] text-bone transition-colors hover:bg-ink-600"
                >
                  <FileText className="h-4 w-4" />
                  Abrir cotización
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              ) : (
                <span className="inline-flex min-h-12 items-center justify-center rounded-full border border-ink/18 px-6 text-sm font-medium uppercase tracking-[0.12em] text-ink/62">
                  Ficha online
                </span>
              )}
              <a
                href={absoluteUrl("/")}
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-ink/18 px-6 text-sm font-medium uppercase tracking-[0.14em] text-ink transition-colors hover:bg-white/70"
              >
                Ver Barrera Brokers
              </a>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[18px] border border-ink/12 bg-white p-3 shadow-[0_18px_60px_rgba(28,18,12,0.12)]">
              {previewImage ? (
                <div
                  className="aspect-[4/5] rounded-[12px] bg-white bg-contain bg-center bg-no-repeat"
                  style={{ backgroundImage: `url(${previewImage})` }}
                  aria-label={title}
                />
              ) : pdfUrl ? (
                <iframe
                  src={`${pdfUrl}#toolbar=0&navpanes=0`}
                  title={title}
                  className="aspect-[4/5] w-full rounded-[12px] bg-bone"
                />
              ) : (
                <div className="flex aspect-[4/5] flex-col justify-between rounded-[12px] bg-bone p-7 text-ink">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent-700">
                      Ficha de cotización
                    </p>
                    <h2 className="mt-4 font-display text-4xl leading-[0.95] tracking-tight text-ink">
                      {quote.developmentName}
                    </h2>
                    <p className="mt-3 text-sm uppercase tracking-[0.16em] text-ink/50">
                      Unidad {quote.unitNumber}
                    </p>
                  </div>

                  <dl className="space-y-4">
                    {fallbackRows.map(([label, value]) => (
                      <div key={label} className="border-t border-ink/12 pt-3">
                        <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/45">
                          {label}
                        </dt>
                        <dd className="mt-1 text-lg font-medium leading-snug text-ink">{value}</dd>
                      </div>
                    ))}
                  </dl>

                  <div>
                    {!hasVisualPreview && (
                      <p className="mb-4 rounded-xl border border-ink/10 bg-white/45 p-3 text-xs leading-relaxed text-ink/55">
                        La ficha comercial está disponible online. Para ver el PDF con planos e
                        imágenes, solicitá al asesor la versión actualizada.
                      </p>
                    )}
                    <p className="text-xs uppercase tracking-[0.18em] text-ink/40">
                      Barrera Brokers
                    </p>
                  </div>
                </div>
              )}
            </div>

            {(quote.payload.description || quote.payload.comments || secondaryImage) && (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {(quote.payload.description || quote.payload.comments) && (
                  <div className="rounded-2xl border border-ink/12 bg-white/70 p-5">
                    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-700">
                      <Building2 className="h-4 w-4" />
                      Detalle
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-ink/72">
                      {quote.payload.comments || quote.payload.description}
                    </p>
                  </div>
                )}
                {secondaryImage && (
                  <div className="rounded-2xl border border-ink/12 bg-white/70 p-3">
                    <div
                      className="aspect-[4/3] rounded-xl bg-white bg-contain bg-center bg-no-repeat"
                      style={{ backgroundImage: `url(${secondaryImage})` }}
                      aria-label="Ubicación en planta"
                    />
                    <p className="mt-3 flex items-center gap-2 px-2 text-xs font-medium uppercase tracking-[0.14em] text-ink/50">
                      <MapPin className="h-4 w-4" />
                      Ubicación en planta
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
