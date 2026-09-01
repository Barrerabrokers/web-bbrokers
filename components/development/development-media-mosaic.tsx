"use client";

import Image from "next/image";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Images, X } from "lucide-react";
import type { DevelopmentImage } from "@/types";

interface Props {
  images: DevelopmentImage[];
  name: string;
  video?: string;
}

export function DevelopmentMediaMosaic({ images, name, video }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const safeImages = Array.isArray(images)
    ? images.filter((image) => typeof image?.url === "string" && image.url.trim().length > 0)
    : [];
  const primaryIndex = Math.max(0, safeImages.findIndex((image) => image.isPrimary));
  const primaryImage = safeImages[primaryIndex] || safeImages[0];
  const secondaryImages = video
    ? safeImages.slice(0, 4)
    : safeImages.filter((_, index) => index !== primaryIndex).slice(0, 4);

  const openImage = (image: DevelopmentImage) => {
    const index = safeImages.findIndex((candidate) => candidate.url === image.url);
    if (index >= 0) setActiveIndex(index);
  };

  const previous = () =>
    setActiveIndex((index) =>
      index === null ? null : (index - 1 + safeImages.length) % safeImages.length
    );
  const next = () =>
    setActiveIndex((index) =>
      index === null ? null : (index + 1) % safeImages.length
    );

  if (!primaryImage && !video) return null;

  return (
    <>
      <div
        className={`grid gap-3 ${
          secondaryImages.length > 0 ? "lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]" : "grid-cols-1"
        }`}
      >
        <div className="relative min-h-[380px] overflow-hidden rounded-xl bg-ink md:min-h-[620px]">
          {video ? (
            <video
              src={video}
              poster={primaryImage?.url}
              autoPlay
              muted
              loop
              playsInline
              disablePictureInPicture
              aria-label={`Video sin audio de ${name}`}
              className="h-full w-full object-cover"
            />
          ) : primaryImage ? (
            <button
              type="button"
              onClick={() => openImage(primaryImage)}
              className="group relative h-full w-full"
              aria-label={`Ampliar imagen principal de ${name}`}
            >
              <Image
                src={primaryImage.url}
                alt={primaryImage.caption || name}
                fill
                priority
                className="object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                sizes="(max-width: 1024px) 100vw, 60vw"
              />
            </button>
          ) : null}
          <div className="pointer-events-none absolute bottom-4 left-4 rounded-full bg-bone/92 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-ink shadow-sm">
            {video ? "Video principal" : "Imagen principal"}
          </div>
        </div>

        {secondaryImages.length > 0 && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            {secondaryImages.map((image, index) => (
              <button
                key={image.id || image.url}
                type="button"
                onClick={() => openImage(image)}
                className="group relative min-h-[150px] overflow-hidden rounded-xl bg-ink/8 md:min-h-[190px]"
                aria-label={`Ampliar imagen ${index + 1} de ${name}`}
              >
                <Image
                  src={image.url}
                  alt={image.caption || `${name}, imagen ${index + 1}`}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.035]"
                  sizes="(max-width: 1024px) 50vw, 20vw"
                />
                {index === secondaryImages.length - 1 && safeImages.length > 5 && (
                  <span className="absolute bottom-3 right-3 inline-flex items-center gap-2 rounded-full bg-ink/85 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-bone shadow-sm">
                    <Images className="h-3.5 w-3.5" />
                    {safeImages.length} fotos
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {activeIndex !== null && safeImages[activeIndex] && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Galería del desarrollo"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/96 p-4 md:p-8"
          onClick={() => setActiveIndex(null)}
        >
          <button
            type="button"
            onClick={() => setActiveIndex(null)}
            className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-bone/10 text-bone transition-colors hover:bg-bone hover:text-ink md:right-8 md:top-8"
            aria-label="Cerrar galería"
          >
            <X className="h-5 w-5" />
          </button>
          {safeImages.length > 1 && (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  previous();
                }}
                className="absolute left-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-bone/10 text-bone transition-colors hover:bg-bone hover:text-ink md:left-8"
                aria-label="Imagen anterior"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  next();
                }}
                className="absolute right-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-bone/10 text-bone transition-colors hover:bg-bone hover:text-ink md:right-8"
                aria-label="Imagen siguiente"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
          <div
            className="relative h-[82vh] w-[88vw]"
            onClick={(event) => event.stopPropagation()}
          >
            <Image
              src={safeImages[activeIndex].url}
              alt={safeImages[activeIndex].caption || name}
              fill
              className="object-contain"
              sizes="90vw"
            />
          </div>
        </div>
      )}
    </>
  );
}
