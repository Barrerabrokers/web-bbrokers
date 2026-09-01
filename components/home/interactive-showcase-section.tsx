"use client";

import {
  StageCarouselItem,
  StageCarouselSection,
} from "./stage-carousel-section";

export type ShowcaseItem = StageCarouselItem & {
  slug?: string;
  status?: string;
  priceFrom?: number;
  progress?: number;
  availableUnits?: number;
  subtitle?: string;
};

interface Props {
  items: ShowcaseItem[];
  sectionId: string;
  eyebrow: string;
  heading: React.ReactNode;
  description: string;
  ctaText: string;
  ctaHref: string;
  gradientColor?: string;
  theme?: "dark" | "light";
  imageTone?: "standard" | "clear";
}

export function InteractiveShowcaseSection({
  items,
  sectionId,
  eyebrow,
  heading,
  description,
  ctaText,
  ctaHref,
}: Props) {
  return (
    <StageCarouselSection
      items={items}
      sectionId={sectionId}
      eyebrow={eyebrow}
      heading={heading}
      description={description}
      ctaText={ctaText}
      ctaHref={ctaHref}
    />
  );
}
