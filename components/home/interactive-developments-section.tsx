"use client";

import { Development, DEVELOPMENT_STATUS_LABELS } from "@/types";
import { formatPrice } from "@/lib/utils";
import {
  StageCarouselItem,
  StageCarouselSection,
} from "./stage-carousel-section";
import { getDevelopmentVideo } from "@/lib/development-media";

interface Props {
  developments: Development[];
}

export function InteractiveDevelopmentsSection({ developments }: Props) {
  const items: StageCarouselItem[] = developments.map((dev) => {
    const priceFrom = dev.minPriceAvailable ?? dev.priceFrom;
    const image =
      dev.images.find((item) => item.isPrimary)?.url || dev.images[0]?.url;

    return {
      id: dev.id,
      href: `/desarrollos/${dev.slug}`,
      title: dev.name,
      location: dev.location,
      image,
      video: getDevelopmentVideo(dev.name, dev.videoUrl, dev.videoIsPrimary),
      statusLabel: DEVELOPMENT_STATUS_LABELS[dev.status],
      priceLabel: priceFrom ? formatPrice(priceFrom) : undefined,
      completionDate: dev.completionDate || undefined,
      extraStats:
        dev.progress > 0
          ? [{ label: "Avance", value: `${dev.progress}%` }]
          : undefined,
    };
  });

  return (
    <StageCarouselSection
      items={items}
      sectionId="desarrollos"
      eyebrow="Desarrollos en curso"
      heading={
        <>
          Proyectos con <span className="italic text-[#d8c4af]">alta rentabilidad</span>{" "}
          en las mejores zonas.
        </>
      }
      description="Una selección de desarrollos con ubicación, financiación y salida comercial clara para entrar desde el inicio de la obra."
      ctaText="Ver todos los desarrollos"
      ctaHref="/desarrollos"
    />
  );
}
