"use client";

import { useState } from "react";
import Image from "next/image";
import { Expand } from "lucide-react";
import { PropertyLightbox } from "./property-lightbox";

interface PropertyGalleryProps {
  images: string[];
  title: string;
  category: string;
}

export function PropertyGallery({
  images,
  title,
  category,
}: PropertyGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const mainImage = images[0];
  const sideImages = images.slice(1, 5);

  const openAt = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  if (!mainImage) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-ink/10 bg-cream-300 text-sm text-ink/50">
        Sin imagenes cargadas
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
        <button
          type="button"
          onClick={() => openAt(0)}
          className="group relative block min-h-[380px] overflow-hidden rounded-xl bg-cream-300 md:min-h-[560px] lg:min-h-[640px]"
          aria-label="Ver galeria"
        >
          <Image
            src={mainImage}
            alt={title}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-[1.02]"
            priority
            sizes="(max-width: 1024px) 100vw, 64vw"
          />

          <div className="absolute left-4 top-4 md:left-5 md:top-5">
            <span className="rounded-full bg-cream-50/92 px-3 py-1.5 text-[10px] uppercase tracking-widest text-ink shadow-sm">
              {category}
            </span>
          </div>

          {images.length > 1 && (
            <div className="absolute bottom-4 left-4 md:bottom-5 md:left-5">
              <span className="rounded-full bg-cream-50/92 px-3 py-1.5 text-[10px] uppercase tracking-widest text-ink shadow-sm">
                {images.length} fotos
              </span>
            </div>
          )}

          <div className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-xs uppercase tracking-widest text-bone shadow-sm transition-transform duration-300 group-hover:-translate-y-1 md:bottom-5 md:right-5">
            <Expand className="h-3.5 w-3.5" />
            Ver galeria
          </div>
        </button>

        {sideImages.length > 0 && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            {sideImages.map((image, index) => {
              const realIndex = index + 1;
              const isLastShown = realIndex === 4 && images.length > 5;
              const remaining = images.length - 5;
              return (
                <button
                  key={realIndex}
                  type="button"
                  onClick={() => openAt(realIndex)}
                  className={`group relative block min-h-[150px] overflow-hidden rounded-xl bg-cream-300 md:min-h-[190px] ${
                    sideImages.length === 1 ? "col-span-2 lg:col-span-1" : ""
                  }`}
                  aria-label={`Ver imagen ${realIndex + 1}`}
                >
                  <Image
                    src={image}
                    alt={`${title} ${realIndex + 1}`}
                    fill
                    sizes="(max-width: 1024px) 50vw, 28vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-[1.035]"
                  />
                  {isLastShown && (
                    <div className="absolute inset-0 flex items-center justify-center bg-ink/72 text-cream-100">
                      <span className="font-display text-3xl font-light">
                      +{remaining}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <PropertyLightbox
        images={images}
        initialIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        alt={title}
      />
    </>
  );
}
