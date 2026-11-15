import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getDevelopmentBySlug } from "@/lib/developments-db";
import { DEVELOPMENT_STATUS_LABELS } from "@/types";

export async function AlphaFeaturedSection() {
  const development = await getDevelopmentBySlug("alpha-place-libertador");
  if (!development || development.visibility !== "public") return null;
  const images = development.images || [];
  const image = images.find((item) => item.isPrimary) || images[0];
  const href = `/desarrollos/${development.slug}`;

  return (
    <section aria-labelledby="alpha-featured-title" className="bg-bone px-5 py-16 text-ink md:px-10 md:py-24">
      <div className="mx-auto grid max-w-[1500px] gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
        {image && (
          <Link href={href} className="group relative block overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
            {/* Project imagery comes from the development's managed gallery. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt={`Arquitectura de ${development.name}`} loading="lazy" className="aspect-[4/5] max-h-[680px] w-full object-cover transition-transform duration-700 motion-safe:group-hover:scale-[1.025] motion-reduce:transition-none" />
            <span className="absolute bottom-4 left-4 bg-ink px-4 py-2 text-xs text-bone">{DEVELOPMENT_STATUS_LABELS[development.status]}</span>
          </Link>
        )}
        <div>
          <p className="text-sm font-medium text-[#6b4335]">{development.location} · Buenos Aires</p>
          <h2 id="alpha-featured-title" className="mt-4 text-balance font-display text-[clamp(3rem,5vw,5rem)] font-light leading-[1.04] tracking-[-0.025em]">{development.name}</h2>
          <p className="mt-6 max-w-xl text-lg leading-relaxed">Conocé el proyecto, recorré sus espacios y evaluá las opciones para tu próxima inversión.</p>
          <dl className="my-8 divide-y divide-ink/15 border-y border-ink/15">
            <div className="flex flex-wrap justify-between gap-3 py-5"><dt>Ubicación</dt><dd className="font-medium">{development.address}</dd></div>
            <div className="flex flex-wrap justify-between gap-3 py-5"><dt>Entrega estimada</dt><dd className="font-medium">{development.completionDate || "Consultar"}</dd></div>
            <div className="flex flex-wrap justify-between gap-3 py-5"><dt>Financiación</dt><dd className="font-medium">Consultá el plan de tu unidad</dd></div>
          </dl>
          <div className="flex flex-wrap gap-4">
            <Link href={href} className="btn-primary inline-flex items-center gap-3">Ver proyecto y unidades <ArrowUpRight className="h-4 w-4" /></Link>
            <Link href={`${href}#financiacion`} className="inline-flex min-h-12 items-center border-b border-ink/50 text-sm">Brochure y financiación</Link>
          </div>
          <p className="mt-6 text-sm leading-relaxed text-ink/75">Te acompañamos a comparar unidades, revisar las condiciones de compra y coordinar una reunión.</p>
        </div>
      </div>
    </section>
  );
}
