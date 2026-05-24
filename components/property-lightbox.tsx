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

  // Reset index cuando se abre
  useEffect(() => {
    if (isOpen) setIndex(initialIndex);
  }, [isOpen, initialIndex]);

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % images.length);
  }, [images.length]);

  const prev = useCallback(() => {
    setIndex((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  // Teclado
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

  // Bloquear scroll del body cuando esta abierto
  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen]);

  // Touch / swipe
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
      className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
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
        className="absolute top-4 right-4 z-10 p-2 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
        aria-label="Cerrar"
      >
        <X className="h-7 w-7" />
      </button>

      {/* Counter */}
      {images.length > 1 && (
        <div className="absolute top-6 left-6 z-10 text-white/90 label-tracking text-sm">
          {index + 1} / {images.length}
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
          className="absolute left-2 md:left-6 z-10 p-2 md:p-3 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Anterior"
        >
          <ChevronLeft className="h-8 w-8 md:h-10 md:w-10" />
        </button>
      )}

      {/* Imagen */}
      <div
        className="relative w-full h-full max-w-7xl max-h-[90vh] mx-auto px-12 md:px-20 py-12 flex items-center justify-center"
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
          className="absolute right-2 md:right-6 z-10 p-2 md:p-3 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Siguiente"
        >
          <ChevronRight className="h-8 w-8 md:h-10 md:w-10" />
        </button>
      )}

      {/* Thumbnails */}
      {images.length > 1 && (
        <div
          className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 px-4 overflow-x-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              className={`relative h-16 w-16 md:h-20 md:w-20 flex-shrink-0 overflow-hidden border-2 transition-all ${
                i === index
                  ? "border-gold-500 opacity-100"
                  : "border-transparent opacity-50 hover:opacity-100"
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
