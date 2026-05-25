"use client";

import { useEffect, useRef } from "react";

/**
 * CursorTrail — efecto de estela siguiendo el mouse.
 *
 * Usa canvas full-screen fixed, dibuja puntos que aparecen en la posicion
 * del mouse y se desvanecen progresivamente con un fade + shrink suave.
 *
 * - Solo se activa en pointer:fine (desktop). En touch devices no hace nada.
 * - Respeta prefers-reduced-motion.
 * - Mix-blend-mode multiply para integrarse con cualquier fondo.
 * - Color del trail tomado de --c-yellow (CSS variable).
 */
export function CursorTrail() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Skip si el dispositivo no es desktop o el usuario pidio reduced motion
    const isFinePointer = window.matchMedia("(pointer: fine)").matches;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (!isFinePointer || reduceMotion) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    // Lee el color accent desde CSS var (rgb triplet)
    const rootStyles = getComputedStyle(document.documentElement);
    const yellowRgb =
      rootStyles.getPropertyValue("--c-yellow-rgb").trim() ||
      "212, 185, 78";

    type Point = { x: number; y: number; vx: number; vy: number; life: number };
    const points: Point[] = [];
    const MAX_POINTS = 40;
    const MAX_LIFE = 35; // frames (~580ms a 60fps)

    let mouseX = -100;
    let mouseY = -100;
    let lastEmitX = mouseX;
    let lastEmitY = mouseY;
    let mouseInside = false;

    const handleMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      mouseInside = true;
    };
    const handleLeave = () => {
      mouseInside = false;
    };

    window.addEventListener("mousemove", handleMove, { passive: true });
    window.addEventListener("mouseleave", handleLeave);
    window.addEventListener("blur", handleLeave);

    let raf = 0;
    const animate = () => {
      // Emit nuevo punto si el mouse se movio
      const dx = mouseX - lastEmitX;
      const dy = mouseY - lastEmitY;
      const dist = Math.hypot(dx, dy);
      if (mouseInside && dist > 2) {
        points.push({
          x: mouseX,
          y: mouseY,
          vx: dx * 0.05,
          vy: dy * 0.05,
          life: 0,
        });
        lastEmitX = mouseX;
        lastEmitY = mouseY;
        if (points.length > MAX_POINTS) {
          points.splice(0, points.length - MAX_POINTS);
        }
      }

      // Update + render
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = points.length - 1; i >= 0; i--) {
        const p = points[i];
        p.life += 1;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.92;
        p.vy *= 0.92;

        if (p.life >= MAX_LIFE) {
          points.splice(i, 1);
          continue;
        }

        const t = p.life / MAX_LIFE;
        const radius = 14 * (1 - t * 0.85);
        const alpha = 0.55 * (1 - t);

        // Glow exterior + core mas brillante
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
        grad.addColorStop(0, `rgba(${yellowRgb}, ${alpha})`);
        grad.addColorStop(1, `rgba(${yellowRgb}, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseleave", handleLeave);
      window.removeEventListener("blur", handleLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-[60]"
      style={{ mixBlendMode: "multiply" }}
    />
  );
}
