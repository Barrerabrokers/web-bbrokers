"use client";

import { useEffect, useRef } from "react";
import Image, { ImageProps } from "next/image";

interface ParallaxImageProps extends Omit<ImageProps, "ref"> {
  /** Cantidad de parallax en px. Negativo = se mueve más lento que el scroll. */
  speed?: number;
  /** Wrapper className (sobre el div contenedor con overflow-hidden). */
  wrapperClassName?: string;
}

/**
 * ParallaxImage — Image de Next con parallax sutil basado en scroll.
 *
 * Diferencia clave con un parallax común: usa scroll relativo a la
 * posición del elemento en viewport (no scroll absoluto). Eso le da
 * la sensación cinemática suave y nunca se sale de su contenedor.
 *
 * Speed sugeridos:
 *   -40 a -80 → imagen "anclada" al fondo (sutil, premium)
 *   -120+ → más dramático (cuidado: puede marear)
 */
export function ParallaxImage({
  speed = -50,
  wrapperClassName = "",
  className = "",
  alt,
  ...imageProps
}: ParallaxImageProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const inner = innerRef.current;
    if (!wrapper || !inner) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduceMotion) return;

    let raf = 0;
    const update = () => {
      const rect = wrapper.getBoundingClientRect();
      const vh = window.innerHeight;
      // Progress: -1 (under viewport) to 1 (above viewport), 0 centered
      const progress =
        (rect.top + rect.height / 2 - vh / 2) / (vh / 2 + rect.height / 2);
      const offset = progress * speed;
      inner.style.transform = `translate3d(0, ${offset}px, 0)`;
      raf = requestAnimationFrame(update);
    };

    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [speed]);

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
          style={{ height: "calc(100% + 120px)", marginTop: "-60px" }}
        >
          <Image alt={alt} {...imageProps} />
        </div>
      </div>
    </div>
  );
}
