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
      <div className="space-y-4">
        {/* Imagen principal */}
        <button
          type="button"
          onClick={() => openAt(0)}
          className="relative h-[500px] w-full overflow-hidden block group"
          aria-label="Ver galeria"
        >
          <Image
            src={images[0]}
            alt={title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            priority
            sizes="(max-width: 1024px) 100vw, 66vw"
          />
          <div className="absolute top-4 left-4">
            <span className="bg-gold-500 text-white px-4 py-2 label-tracking capitalize">
              {category}
            </span>
          </div>
          <div className="absolute bottom-4 right-4 bg-black/60 text-white px-3 py-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Expand className="h-4 w-4" />
            <span className="label-tracking text-xs">Ver galeria</span>
          </div>
          {images.length > 1 && (
            <div className="absolute bottom-4 left-4 bg-black/60 text-white px-3 py-1 label-tracking text-xs">
              {images.length} fotos
            </div>
          )}
        </button>

        {/* Miniaturas */}
        {images.length > 1 && (
          <div className="grid grid-cols-4 gap-4">
            {images.slice(1, 5).map((image, index) => {
              const realIndex = index + 1;
              const isLastShown = realIndex === 4 && images.length > 5;
              const remaining = images.length - 5;
              return (
                <button
                  key={realIndex}
                  type="button"
                  onClick={() => openAt(realIndex)}
                  className="h-24 overflow-hidden relative block group"
                  aria-label={`Ver imagen ${realIndex + 1}`}
                >
                  <Image
                    src={image}
                    alt={`${title} ${realIndex + 1}`}
                    fill
                    sizes="(max-width: 768px) 25vw, 200px"
                    className="object-cover group-hover:scale-110 transition-transform"
                  />
                  {isLastShown && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white heading-serif text-xl">
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
