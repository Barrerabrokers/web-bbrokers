"use client";

import { useEffect, useRef } from "react";
import Image, { ImageProps } from "next/image";

interface ParallaxImageProps extends Omit<ImageProps, "ref"> {
  /**
   * Intensidad del parallax en px.
   * Negativo = imagen "anclada" (sutil, premium).
   * Rango sugerido: -30 a -80.
   */
  speed?: number;
  /** Clase del wrapper (div con overflow-hidden). */
  wrapperClassName?: string;
  /** Aplicar rotación leve a la imagen (efecto editorial). */
  tilt?: number;
}

/**
 * ParallaxImage — Next/Image con parallax suave.
 *
 * Calcula el offset relativo a la posición del elemento
 * en el viewport (no al scroll absoluto), lo que da una
 * sensación cinematográfica premium y evita salirse del contenedor.
 *
 * Inspirado en la estética de obsidianassembly.com:
 * - Movimiento sutil, nunca distrae
 * - Siempre dentro del bounding box del wrapper
 * - Compatible con Lenis / smooth scroll
 */
export function ParallaxImage({
  speed = -45,
  wrapperClassName = "",
  className = "",
  tilt = 0,
  alt,
  ...imageProps
}: ParallaxImageProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const inner = innerRef.current;
    if (!wrapper || !inner) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    let raf = 0;
    const update = () => {
      const rect = wrapper.getBoundingClientRect();
      const vh = window.innerHeight;
      // Progress: -1 (debajo del viewport) a +1 (encima), 0 = centro
      const progress =
        (rect.top + rect.height / 2 - vh / 2) / (vh / 2 + rect.height / 2);
      const offset = progress * speed;
      const rotate = tilt !== 0 ? ` rotate(${tilt}deg)` : "";
      inner.style.transform = `translate3d(0, ${offset}px, 0)${rotate}`;
      raf = requestAnimationFrame(update);
    };

    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [speed, tilt]);

  return (
    <div
      ref={wrapperRef}
      className={`overflow-hidden ${wrapperClassName}`}
    >
      <div
        ref={innerRef}
        className="w-full h-full"
        style={{ willChange: "transform" }}
      >
        {/* Sobredimensiona la imagen para que el parallax no muestre bordes vacíos */}
        <div
          className={`relative w-full ${className}`}
          style={{ height: "calc(100% + 100px)", marginTop: "-50px" }}
        >
          <Image alt={alt} {...imageProps} />
        </div>
      </div>
    </div>
  );
}
