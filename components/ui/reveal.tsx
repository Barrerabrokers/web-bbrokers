"use client";

import { useEffect, useRef, useState, ReactNode, CSSProperties } from "react";

type RevealVariant = "fade" | "fade-up" | "fade-down" | "clip-up" | "scale-in" | "clip-left";

interface RevealProps {
  children: ReactNode;
  /** Tipo de animación */
  variant?: RevealVariant;
  /** Delay en ms */
  delay?: number;
  /** Duración en ms (default 1200ms — cinemático) */
  duration?: number;
  /** Threshold de IntersectionObserver */
  threshold?: number;
  /** Animar solo una vez */
  once?: boolean;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}

/**
 * Reveal — wrapper editorial para scroll reveal.
 *
 * Inspirado en Obsidian Assembly:
 * - Easing largo tipo editorial
 * - clip-path reveals para titulares
 * - Respeta prefers-reduced-motion
 *
 * Uso:
 *   <Reveal variant="clip-up" delay={200}>
 *     <h1>Titular editorial</h1>
 *   </Reveal>
 */
export function Reveal({
  children,
  variant = "fade-up",
  delay = 0,
  duration = 1200,
  threshold = 0.12,
  once = true,
  className = "",
  as: Tag = "div",
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) { setVisible(true); return; }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setVisible(false);
        }
      },
      { threshold, rootMargin: "0px 0px -8% 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, once]);

  const EASE = "cubic-bezier(0.19, 1, 0.22, 1)";

  const style: CSSProperties = {
    transitionProperty: "opacity, transform, clip-path",
    transitionDuration: `${duration}ms`,
    transitionTimingFunction: EASE,
    transitionDelay: `${delay}ms`,
    willChange: "opacity, transform, clip-path",
  };

  switch (variant) {
    case "clip-up":
      style.clipPath = visible ? "inset(0% 0% 0% 0%)" : "inset(100% 0% 0% 0%)";
      style.opacity = 1;
      break;
    case "clip-left":
      style.clipPath = visible ? "inset(0% 0% 0% 0%)" : "inset(0% 100% 0% 0%)";
      style.opacity = 1;
      break;
    case "scale-in":
      style.opacity = visible ? 1 : 0;
      style.transform = visible ? "scale(1)" : "scale(0.94)";
      break;
    case "fade-down":
      style.opacity = visible ? 1 : 0;
      style.transform = visible ? "translate3d(0,0,0)" : "translate3d(0,-16px,0)";
      break;
    case "fade":
      style.opacity = visible ? 1 : 0;
      break;
    default: // fade-up
      style.opacity = visible ? 1 : 0;
      style.transform = visible ? "translate3d(0,0,0)" : "translate3d(0,36px,0)";
  }

  const Component = Tag as any;
  return (
    <Component ref={ref} className={className} style={style}>
      {children}
    </Component>
  );
}
