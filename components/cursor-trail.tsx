"use client";

import { useEffect, useRef, useState } from "react";

/**
 * SmartCursor (export name kept as CursorTrail for compatibility)
 *
 * Cursor minimalista de dos capas inspirado en Obsidian Assembly:
 * - Punto pequeño que sigue el mouse con leve lag (lerp)
 * - Anillo/circle más grande que escala al hover sobre links/botones
 * - El anillo se vuelve translúcido warm-beige (--c-warm-beige)
 *
 * Detecta automáticamente: a, button, [role="button"], [data-cursor="hover"]
 * Skip en touch devices y prefers-reduced-motion.
 */
export function CursorTrail() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const isFinePointer = window.matchMedia("(pointer: fine)").matches;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (!isFinePointer || reduceMotion) return;
    setEnabled(true);

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let dotX = mouseX;
    let dotY = mouseY;
    let ringX = mouseX;
    let ringY = mouseY;
    let isHovering = false;
    let isPointerDown = false;

    const handleMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    const handleEnter = (e: Event) => {
      const target = e.target as HTMLElement;
      // Detect hover-eligible elements
      if (
        target.closest("a, button, [role='button'], input, textarea, select, [data-cursor='hover']")
      ) {
        isHovering = true;
        ring.classList.add("cursor-ring-hover");
      }
    };
    const handleLeave = (e: Event) => {
      const target = e.target as HTMLElement;
      if (
        target.closest("a, button, [role='button'], input, textarea, select, [data-cursor='hover']")
      ) {
        isHovering = false;
        ring.classList.remove("cursor-ring-hover");
      }
    };

    const handleDown = () => {
      isPointerDown = true;
      ring.classList.add("cursor-ring-down");
    };
    const handleUp = () => {
      isPointerDown = false;
      ring.classList.remove("cursor-ring-down");
    };

    let raf = 0;
    const loop = () => {
      // Dot follows almost instantly
      dotX += (mouseX - dotX) * 0.55;
      dotY += (mouseY - dotY) * 0.55;
      // Ring lags behind for cinematic feel
      ringX += (mouseX - ringX) * 0.16;
      ringY += (mouseY - ringY) * 0.16;

      dot.style.transform = `translate3d(${dotX}px, ${dotY}px, 0) translate(-50%, -50%)`;
      ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    window.addEventListener("mousemove", handleMove, { passive: true });
    document.addEventListener("mouseover", handleEnter, true);
    document.addEventListener("mouseout", handleLeave, true);
    document.addEventListener("mousedown", handleDown);
    document.addEventListener("mouseup", handleUp);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseover", handleEnter, true);
      document.removeEventListener("mouseout", handleLeave, true);
      document.removeEventListener("mousedown", handleDown);
      document.removeEventListener("mouseup", handleUp);
    };
  }, []);

  if (!enabled) return null;

  return (
    <>
      {/* Anillo grande con lag */}
      <div
        ref={ringRef}
        aria-hidden="true"
        className="cursor-ring fixed top-0 left-0 pointer-events-none z-[60] h-9 w-9 rounded-full border border-bone/40 mix-blend-difference transition-[width,height,border-color,background-color,opacity] duration-300 ease-out"
        style={{ willChange: "transform" }}
      />
      {/* Punto pequeño con respuesta inmediata */}
      <div
        ref={dotRef}
        aria-hidden="true"
        className="cursor-dot fixed top-0 left-0 pointer-events-none z-[61] h-1 w-1 rounded-full bg-bone mix-blend-difference"
        style={{ willChange: "transform" }}
      />

      <style jsx global>{`
        @media (pointer: fine) {
          html,
          body,
          a,
          button,
          [role="button"] {
            cursor: none !important;
          }
        }

        .cursor-ring-hover {
          width: 56px !important;
          height: 56px !important;
          background-color: rgba(var(--c-warm-beige-rgb), 0.18);
          border-color: rgba(var(--c-warm-beige-rgb), 0.55);
        }

        .cursor-ring-down {
          transform-origin: center;
          width: 24px !important;
          height: 24px !important;
        }
      `}</style>
    </>
  );
}
