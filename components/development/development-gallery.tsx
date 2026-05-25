"use client";

import { useState } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { DevelopmentImage } from "@/types";

interface Props {
  images: DevelopmentImage[];
}

export function DevelopmentGallery({ images }: Props) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const open = (idx: number) => setActiveIdx(idx);
  const close = () => setActiveIdx(null);
  const prev = () =>
    setActiveIdx((i) => (i === null ? null : (i - 1 + images.length) % images.length));
  const next = () =>
    setActiveIdx((i) => (i === null ? null : (i + 1) % images.length));

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        {images.map((img, idx) => (
          <button
            key={img.id || idx}
            onClick={() => open(idx)}
            className={`group relative overflow-hidden bg-cream-200 rounded ${
              idx === 0 ? "md:col-span-2 md:row-span-2 aspect-square md:aspect-auto" : "aspect-square"
            }`}
          >
            <Image
              src={img.url}
              alt={img.caption || `Imagen ${idx + 1}`}
              fill
              className="object-cover transition-transform duration-1000 group-hover:scale-105"
              sizes="(max-width: 768px) 50vw, 33vw"
            />
            {img.caption && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-ink/80 to-transparent p-3">
                <p className="text-bone text-xs uppercase tracking-widest">
                  {img.caption}
                </p>
              </div>
            )}
          </button>
        ))}
      </div>


      {/* Lightbox */}
      {activeIdx !== null && (
        <div
          className="fixed inset-0 z-[100] bg-ink/95 flex items-center justify-center"
          onClick={close}
        >
          <button
            className="absolute top-6 right-6 h-10 w-10 rounded-full bg-bone/10 hover:bg-accent flex items-center justify-center text-bone hover:text-ink transition-colors"
            onClick={close}
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
          <button
            className="absolute left-6 h-12 w-12 rounded-full bg-bone/10 hover:bg-accent flex items-center justify-center text-bone hover:text-ink transition-colors z-10"
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            aria-label="Anterior"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            className="absolute right-6 h-12 w-12 rounded-full bg-bone/10 hover:bg-accent flex items-center justify-center text-bone hover:text-ink transition-colors z-10"
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            aria-label="Siguiente"
          >
            <ChevronRight className="h-6 w-6" />
          </button>

          <div
            className="relative w-[90vw] h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={images[activeIdx].url}
              alt={images[activeIdx].caption || ""}
              fill
              className="object-contain"
              sizes="90vw"
            />
            {images[activeIdx].caption && (
              <div className="absolute bottom-0 left-0 right-0 text-center pb-4">
                <p className="text-bone/80 text-sm">
                  {images[activeIdx].caption}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
