"use client";

import { useEffect, useRef, useState, ReactNode, CSSProperties } from "react";

type RevealVariant = "fade" | "fade-up" | "fade-down" | "clip-up" | "scale-in";

interface RevealProps {
  children: ReactNode;
  /** Tipo de animación. clip-up es la más editorial/cinemática */
  variant?: RevealVariant;
  /** Delay en ms antes de empezar la animación cuando entra al viewport */
  delay?: number;
  /** Duración de la animación en ms (default: 1400ms para sensación cinemática) */
  duration?: number;
  /** Threshold del intersection observer (default 0.15) */
  threshold?: number;
  /** Si true, anima solo una vez (default true) */
  once?: boolean;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}

/**
 * Reveal — wrapper editorial para animar elementos al entrar al viewport.
 *
 * Inspirado en Obsidian Assembly y sites Awwwards:
 * - Cubic-bezier largo y suave (no spring rebote)
 * - clip-path reveals tipo página de revista
 * - Soporta delay para stagger manual
 *
 * Uso:
 *   <Reveal variant="clip-up" delay={200}>
 *     <h1>Editorial title</h1>
 *   </Reveal>
 */
export function Reveal({
  children,
  variant = "fade-up",
  delay = 0,
  duration = 1400,
  threshold = 0.15,
  once = true,
  className = "",
  as: Tag = "div",
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduceMotion) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setVisible(false);
        }
      },
      { threshold, rootMargin: "0px 0px -10% 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, once]);

  const style: CSSProperties = {
    transitionProperty: "opacity, transform, clip-path",
    transitionDuration: `${duration}ms`,
    transitionTimingFunction: "cubic-bezier(0.6, 0, 0.2, 1)",
    transitionDelay: `${delay}ms`,
    willChange: "opacity, transform, clip-path",
  };

  if (variant === "clip-up") {
    style.clipPath = visible
      ? "inset(0% 0% 0% 0%)"
      : "inset(100% 0% 0% 0%)";
    style.opacity = 1; // clip-path lo oculta solo
  } else {
    style.opacity = visible ? 1 : 0;
    if (variant === "fade-up") {
      style.transform = visible ? "translate3d(0,0,0)" : "translate3d(0,40px,0)";
    } else if (variant === "fade-down") {
      style.transform = visible ? "translate3d(0,0,0)" : "translate3d(0,-20px,0)";
    } else if (variant === "scale-in") {
      style.transform = visible ? "scale(1)" : "scale(0.95)";
    }
  }

  const Component = Tag as any;
  return (
    <Component ref={ref} className={className} style={style}>
      {children}
    </Component>
  );
}
