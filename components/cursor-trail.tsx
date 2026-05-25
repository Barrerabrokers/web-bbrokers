"use client";

import { useEffect, useRef } from "react";

/**
 * SmartCursor (export name kept as CursorTrail for compatibility)
 *
 * Cursor minimalista de dos capas inspirado en Obsidian Assembly:
 * - Punto pequeño que sigue el mouse con leve lag (lerp)
 * - Anillo/circle más grande que escala al hover sobre links/botones
 * - El anillo se vuelve translúcido warm-beige (--c-warm-beige)
 *
 * Detecta automáticamente: a, button, [role="button"], [data-cursor="hover"]
 * Skip en touch devices y prefers-reduced-motion (oculta los divs).
 */
export function CursorTrail() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    const isFinePointer = window.matchMedia("(pointer: fine)").matches;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (!isFinePointer || reduceMotion) {
      dot.style.display = "none";
      ring.style.display = "none";
      return;
    }

    document.documentElement.classList.add("smart-cursor-active");

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let dotX = mouseX;
    let dotY = mouseY;
    let ringX = mouseX;
    let ringY = mouseY;

    const handleMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      dot.style.opacity = "1";
      ring.style.opacity = "1";
    };

    const handleEnter = (e: Event) => {
      const target = e.target as HTMLElement;
      if (
        target.closest &&
        target.closest(
          "a, button, [role='button'], input, textarea, select, [data-cursor='hover']"
        )
      ) {
        ring.classList.add("cursor-ring-hover");
      }
    };
    const handleLeaveEl = (e: Event) => {
      const target = e.target as HTMLElement;
      if (
        target.closest &&
        target.closest(
          "a, button, [role='button'], input, textarea, select, [data-cursor='hover']"
        )
      ) {
        ring.classList.remove("cursor-ring-hover");
      }
    };

    const handleWindowOut = (e: MouseEvent) => {
      if (!e.relatedTarget) {
        dot.style.opacity = "0";
        ring.style.opacity = "0";
      }
    };

    const handleDown = () => ring.classList.add("cursor-ring-down");
    const handleUp = () => ring.classList.remove("cursor-ring-down");

    let raf = 0;
    const loop = () => {
      dotX += (mouseX - dotX) * 0.55;
      dotY += (mouseY - dotY) * 0.55;
      ringX += (mouseX - ringX) * 0.16;
      ringY += (mouseY - ringY) * 0.16;

      dot.style.transform = `translate3d(${dotX - 2}px, ${dotY - 2}px, 0)`;
      ring.style.transform = `translate3d(${ringX - 18}px, ${ringY - 18}px, 0)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    window.addEventListener("mousemove", handleMove, { passive: true });
    window.addEventListener("mouseout", handleWindowOut);
    document.addEventListener("mouseover", handleEnter, true);
    document.addEventListener("mouseout", handleLeaveEl, true);
    document.addEventListener("mousedown", handleDown);
    document.addEventListener("mouseup", handleUp);

    return () => {
      cancelAnimationFrame(raf);
      document.documentElement.classList.remove("smart-cursor-active");
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseout", handleWindowOut);
      document.removeEventListener("mouseover", handleEnter, true);
      document.removeEventListener("mouseout", handleLeaveEl, true);
      document.removeEventListener("mousedown", handleDown);
      document.removeEventListener("mouseup", handleUp);
    };
  }, []);

  return (
    <>
      <div
        ref={ringRef}
        aria-hidden="true"
        className="cursor-ring fixed top-0 left-0 pointer-events-none z-[9998] h-9 w-9 rounded-full border border-bone/60 mix-blend-difference opacity-0 transition-[width,height,border-color,background-color,opacity] duration-300 ease-out"
        style={{ willChange: "transform" }}
      />
      <div
        ref={dotRef}
        aria-hidden="true"
        className="cursor-dot fixed top-0 left-0 pointer-events-none z-[9999] h-1 w-1 rounded-full bg-bone mix-blend-difference opacity-0"
        style={{ willChange: "transform" }}
      />
    </>
  );
}
