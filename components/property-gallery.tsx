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
          className="relative h-[420px] md:h-[520px] w-full overflow-hidden block group rounded-xl border border-gray-800"
          aria-label="Ver galeria"
        >
          <Image
            src={images[0]}
            alt={title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            priority
            sizes="(max-width: 1024px) 100vw, 66vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950/40 via-transparent to-gray-950/20" />

          <div className="absolute top-4 left-4">
            <span className="pill bg-gray-950/70 backdrop-blur-md capitalize">
              {category}
            </span>
          </div>

          {images.length > 1 && (
            <div className="absolute bottom-4 left-4">
              <span className="pill bg-gray-950/70 backdrop-blur-md">
                {images.length} fotos
              </span>
            </div>
          )}

          <div className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-md bg-gray-950/80 backdrop-blur-md border border-gray-800 px-3 py-1.5 text-xs text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity">
            <Expand className="h-3.5 w-3.5" />
            <span>Ver galeria</span>
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
                  className="h-20 md:h-24 overflow-hidden relative block group rounded-lg border border-gray-800 hover:border-gray-700 transition-colors"
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
                    <div className="absolute inset-0 bg-gray-950/80 backdrop-blur-sm flex items-center justify-center text-gray-50 text-lg font-semibold tracking-tight">
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
