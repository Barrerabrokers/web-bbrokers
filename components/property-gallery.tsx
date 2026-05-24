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

  const openAt = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  return (
    <>
      <div className="space-y-3">
        {/* Imagen principal */}
        <button
          type="button"
          onClick={() => openAt(0)}
          className="relative h-[440px] md:h-[560px] w-full overflow-hidden block group bg-cream-300"
          aria-label="Ver galeria"
        >
          <Image
            src={images[0]}
            alt={title}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-[1.02]"
            priority
            sizes="(max-width: 1024px) 100vw, 66vw"
          />

          <div className="absolute top-5 left-5">
            <span className="text-[10px] uppercase tracking-widest bg-ink/30 backdrop-blur-sm text-cream-100 px-3 py-1.5 rounded-full">
              {category}
            </span>
          </div>

          {images.length > 1 && (
            <div className="absolute bottom-5 left-5">
              <span className="text-[10px] uppercase tracking-widest bg-ink/30 backdrop-blur-sm text-cream-100 px-3 py-1.5 rounded-full">
                {images.length} fotos
              </span>
            </div>
          )}

          <div className="absolute bottom-5 right-5 inline-flex items-center gap-2 rounded-full bg-cream-100/90 backdrop-blur-md px-4 py-2 text-xs uppercase tracking-widest text-ink opacity-0 group-hover:opacity-100 transition-opacity">
            <Expand className="h-3.5 w-3.5" />
            Ver galeria
          </div>
        </button>

        {/* Miniaturas */}
        {images.length > 1 && (
          <div className="grid grid-cols-4 gap-3">
            {images.slice(1, 5).map((image, index) => {
              const realIndex = index + 1;
              const isLastShown = realIndex === 4 && images.length > 5;
              const remaining = images.length - 5;
              return (
                <button
                  key={realIndex}
                  type="button"
                  onClick={() => openAt(realIndex)}
                  className="h-24 md:h-28 overflow-hidden relative block group bg-cream-300"
                  aria-label={`Ver imagen ${realIndex + 1}`}
                >
                  <Image
                    src={image}
                    alt={`${title} ${realIndex + 1}`}
                    fill
                    sizes="(max-width: 768px) 25vw, 200px"
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {isLastShown && (
                    <div className="absolute inset-0 bg-ink/70 backdrop-blur-sm flex items-center justify-center text-cream-100 font-display text-2xl">
                      +{remaining}
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
