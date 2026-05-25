"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * SmoothScroll — momentum-based scroll inspired by Awwwards-tier sites
 *
 * Lenis se monta una vez globalmente. Le da al scroll una sensación
 * cinematográfica con damping físico — sin saltos abruptos.
 *
 * - Respeta prefers-reduced-motion (Lenis lo skip-ea automáticamente).
 * - duration controla la suavidad. Valores altos (2.5+) = más cinemático.
 * - smoothWheel: true para mouse wheel; touch queda nativo (mejor en mobile).
 */
export function SmoothScroll() {
  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduceMotion) return;

    const lenis = new Lenis({
      duration: 1.4,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.4,
    });

    let raf = 0;
    function loop(time: number) {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);

  return null;
}
