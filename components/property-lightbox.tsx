"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface PropertyLightboxProps {
  images: string[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
  alt?: string;
}

export function PropertyLightbox({
  images,
  initialIndex,
  isOpen,
  onClose,
  alt = "Imagen de propiedad",
}: PropertyLightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) setIndex(initialIndex);
  }, [isOpen, initialIndex]);

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % images.length);
  }, [images.length]);

  const prev = useCallback(() => {
    setIndex((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose, next, prev]);

  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(diff) > 50) {
      if (diff < 0) next();
      else prev();
    }
    touchStartX.current = null;
  };

  if (!isOpen || images.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-cream-900/95 backdrop-blur-sm flex items-center justify-center animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Galeria de imagenes"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Cerrar */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute top-5 right-5 z-10 inline-flex items-center justify-center h-11 w-11 rounded-full bg-cream-100/10 hover:bg-cream-100/20 text-cream-100 transition-colors"
        aria-label="Cerrar"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Counter */}
      {images.length > 1 && (
        <div className="absolute top-7 left-7 z-10 text-cream-100/85 text-xs uppercase tracking-widest">
          {String(index + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}
        </div>
      )}

      {/* Prev */}
      {images.length > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            prev();
          }}
          className="absolute left-3 md:left-6 z-10 inline-flex items-center justify-center h-12 w-12 rounded-full bg-cream-100/10 hover:bg-cream-100/20 text-cream-100 transition-colors"
          aria-label="Anterior"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {/* Imagen */}
      <div
        className="relative w-full h-full max-w-7xl max-h-[88vh] mx-auto px-16 md:px-24 py-12 flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative w-full h-full">
          <Image
            src={images[index]}
            alt={`${alt} ${index + 1}`}
            fill
            sizes="(max-width: 768px) 100vw, 90vw"
            className="object-contain"
            priority
          />
        </div>
      </div>

      {/* Next */}
      {images.length > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            next();
          }}
          className="absolute right-3 md:right-6 z-10 inline-flex items-center justify-center h-12 w-12 rounded-full bg-cream-100/10 hover:bg-cream-100/20 text-cream-100 transition-colors"
          aria-label="Siguiente"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Thumbnails */}
      {images.length > 1 && (
        <div
          className="absolute bottom-5 left-0 right-0 flex justify-center gap-2 px-4 overflow-x-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              className={`relative h-16 w-16 md:h-20 md:w-20 flex-shrink-0 overflow-hidden transition-all ${
                i === index
                  ? "opacity-100 ring-2 ring-cream-100"
                  : "opacity-50 hover:opacity-90"
              }`}
              aria-label={`Ir a imagen ${i + 1}`}
            >
              <Image
                src={src}
                alt={`Miniatura ${i + 1}`}
                fill
                sizes="80px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
