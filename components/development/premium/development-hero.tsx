import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowRight, FileText, LockKeyhole, MapPin } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import type { DevelopmentDetailModel } from "@/lib/development-detail-view-model";

interface DevelopmentHeroProps {
  model: DevelopmentDetailModel;
}

export function DevelopmentHero({ model }: DevelopmentHeroProps) {
  const { development, primaryImage, coverVideo, priceFrom, statusLabel } = model;

  return (
    <section className="relative isolate min-h-[92svh] overflow-hidden bg-[#070707] text-[#f8f5ef]">
      <div className="absolute inset-0 -z-10">
        {coverVideo ? (
          <>
            {primaryImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={primaryImage}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full scale-110 object-cover opacity-32 blur-xl"
              />
            )}
            <div className="absolute inset-0 bg-[#070707]" />
            {primaryImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={primaryImage}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full scale-110 object-cover opacity-28 blur-2xl"
              />
            )}
            <div
              className="absolute inset-x-4 top-[16svh] h-[44svh] overflow-hidden border border-white/14 bg-black shadow-[0_34px_120px_rgba(0,0,0,0.55)] md:inset-x-auto md:bottom-[12svh] md:right-[4vw] md:top-auto md:h-[66svh] md:w-[min(58vw,980px)] lg:right-[5vw] lg:w-[min(54vw,1040px)]"
              data-dev-parallax
            >
              <video
                src={coverVideo}
                poster={primaryImage}
                autoPlay
                muted
                loop
                playsInline
                disablePictureInPicture
                preload="metadata"
                aria-label={`Video sin audio de ${development.name}`}
                className="h-full w-full object-contain"
              />
            </div>
          </>
        ) : primaryImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={primaryImage}
            alt={development.name}
            className="h-full w-full scale-[1.04] object-cover"
            data-dev-parallax
          />
        ) : (
          <div className="h-full w-full bg-[#2b1712]" />
        )}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_18%,rgba(216,196,175,0.20),transparent_28%),linear-gradient(90deg,rgba(7,7,7,0.88),rgba(7,7,7,0.34)_48%,rgba(7,7,7,0.76))]" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#070707] via-[#070707]/60 to-transparent" />
      </div>

      <div className="flex min-h-[92svh] flex-col px-5 pb-8 pt-24 md:px-10 lg:px-14">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/desarrollos"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/18 bg-white/8 px-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/84 backdrop-blur-md transition-colors hover:border-white/42 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Desarrollos
          </Link>
          <div className="hidden items-center gap-2 rounded-full border border-white/16 bg-white/8 px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-white/74 backdrop-blur-md md:flex">
            <MapPin className="h-4 w-4" />
            {development.location}
          </div>
        </div>

        <div className="mt-auto grid items-end gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="max-w-6xl">
            <p
              className="mb-5 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#d8c4af]"
              data-dev-hero-title
            >
              {development.location} · {statusLabel}
            </p>
            <h1 className="font-display text-[clamp(3.8rem,10vw,9rem)] font-light leading-[0.86] tracking-[-0.04em] text-white">
              <span className="block" data-dev-hero-title>
                {development.name}
              </span>
            </h1>
            <p
              className="mt-7 max-w-2xl text-lg leading-relaxed text-white/80 md:text-2xl"
              data-dev-hero-title
            >
              {development.shortDescription ||
                "Una presentación de inversión para entender ubicación, producto, financiación y disponibilidad."}
            </p>
            <div className="mt-8 flex flex-wrap gap-3" data-dev-hero-title>
              <a
                href="#contacto-desarrollo"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#f8f5ef] px-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#070707] transition-transform hover:-translate-y-0.5"
              >
                Consultar disponibilidad
              </a>
              <a
                href="#unidades"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/22 bg-white/8 px-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-white backdrop-blur-md transition-colors hover:border-white/48"
              >
                Ver unidades
              </a>
              {model.brochureHref && (
                <Link
                  href={model.brochureHref}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/22 bg-white/8 px-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-white backdrop-blur-md transition-colors hover:border-white/48"
                >
                  <FileText className="h-4 w-4" />
                  Descargar carpeta
                </Link>
              )}
            </div>
          </div>

          <aside className="border border-[#070707]/14 bg-[#f8f5ef] p-5 text-[#070707] shadow-[0_30px_90px_rgba(0,0,0,0.38)] md:p-6" data-dev-reveal>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#3a1d17]">
              Precio inicial
            </p>
            <p className="mt-2 font-display text-5xl font-light tracking-[-0.035em] text-[#3a1d17]">
              {priceFrom ? formatPrice(priceFrom) : "Consultar"}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-px bg-[#070707]/12">
              <div className="bg-[#f8f5ef] p-4">
                <span className="block text-[10px] uppercase tracking-[0.16em] text-[#070707]/50">
                  Entrega
                </span>
                <strong className="mt-1 block font-display text-2xl font-light">
                  {development.completionDate || "A confirmar"}
                </strong>
              </div>
              <div className="bg-[#f8f5ef] p-4">
                <span className="block text-[10px] uppercase tracking-[0.16em] text-[#070707]/50">
                  Avance
                </span>
                <strong className="mt-1 block font-display text-2xl font-light">
                  {development.progress}%
                </strong>
              </div>
            </div>
            {model.priceListHref && (
              <a
                href={model.priceListHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#070707] px-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#f8f5ef] transition-colors hover:bg-[#3a1d17]"
              >
                <LockKeyhole className="h-4 w-4" />
                Lista de precios
              </a>
            )}
          </aside>
        </div>

        <a
          href="#resumen"
          className="absolute bottom-7 left-1/2 hidden -translate-x-1/2 items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/58 transition-colors hover:text-white md:flex"
        >
          Scroll
          <ArrowDown className="h-4 w-4" />
        </a>
      </div>
    </section>
  );
}
