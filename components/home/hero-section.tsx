"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

const VIDEO_SOURCES = [
  "/Buenos-Aires1.mp4",
  "/Buenos-Aires2.mp4",
  "/Buenos-Aires3.mp4",
  "/buenos-aires.mp4",
];

export function HeroSection() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [videoIndex, setVideoIndex] = useState(0);
  const [failedSet, setFailedSet] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = 0.7;
    const t = setTimeout(() => setIsLoaded(true), 120);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.load();
    v.playbackRate = 0.7;
    v.play().catch(() => {});
  }, [videoIndex]);

  const nextValidIndex = (cur: number, failed: Set<number>) => {
    for (let s = 1; s <= VIDEO_SOURCES.length; s++) {
      const c = (cur + s) % VIDEO_SOURCES.length;
      if (!failed.has(c)) return c;
    }
    return cur;
  };

  const handleEnded = () =>
    setVideoIndex((i) => nextValidIndex(i, failedSet));

  const handleError = () =>
    setFailedSet((prev) => {
      const next = new Set(prev);
      next.add(videoIndex);
      if (next.size < VIDEO_SOURCES.length)
        setVideoIndex((i) => nextValidIndex(i, next));
      return next;
    });

  return (
    <section
      id="inicio"
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ backgroundColor: "var(--oa-bg)" }}
    >
      {/* ── VIDEO BACKGROUND ── */}
      <div className="absolute inset-0 z-0">
        <video
          key={VIDEO_SOURCES[videoIndex]}
          ref={videoRef}
          autoPlay
          muted
          playsInline
          onEnded={handleEnded}
          onError={handleError}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: 0.35, mixBlendMode: "multiply" }}
          poster="/buenos-aires-poster.jpg"
        >
          <source src={VIDEO_SOURCES[videoIndex]} type="video/mp4" />
        </video>

        {/* Gradiente warm sobre el video */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(184,157,135,0.55) 0%, rgba(184,157,135,0.35) 40%, rgba(184,157,135,0.75) 85%, var(--oa-bg-cream) 100%)",
          }}
        />

        {/* Grain */}
        <div className="absolute inset-0 bg-grain opacity-60" />
      </div>

      {/* ── Círculos decorativos ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
        {/* Grande — fondo */}
        <div
          className="circle-deco"
          style={{
            width: "min(80vw, 900px)",
            height: "min(80vw, 900px)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            borderColor: "rgba(255,255,255,0.14)",
          }}
        />
        {/* Mediano */}
        <div
          className="circle-deco"
          style={{
            width: "min(55vw, 620px)",
            height: "min(55vw, 620px)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            borderColor: "rgba(255,255,255,0.1)",
          }}
        />
        {/* Pequeño */}
        <div
          className="circle-deco"
          style={{
            width: "min(30vw, 340px)",
            height: "min(30vw, 340px)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            borderColor: "rgba(255,255,255,0.08)",
          }}
        />
        {/* Líneas diagonales finas */}
        <div
          className="absolute top-0 left-[18%] w-px h-full"
          style={{
            background: "linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.18) 40%, rgba(255,255,255,0.18) 60%, transparent 100%)",
            transform: "rotate(1.5deg)",
          }}
        />
        <div
          className="absolute top-0 right-[22%] w-px h-full"
          style={{
            background: "linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.1) 35%, rgba(255,255,255,0.1) 65%, transparent 100%)",
            transform: "rotate(-1deg)",
          }}
        />
      </div>

      {/* ── EYEBROW LINE ── */}
      <div
        className="relative z-20 container-custom pt-[104px] md:pt-[120px]"
        style={{
          opacity: isLoaded ? 1 : 0,
          transform: isLoaded ? "translateY(0)" : "translateY(-12px)",
          transition: "all 1.2s var(--ease-out-expo)",
        }}
      >
        <div
          className="flex items-center justify-between text-[9px] uppercase tracking-[0.22em]"
          style={{ color: "rgba(7,7,7,0.5)", fontFamily: "var(--font-sans)" }}
        >
          <span className="flex items-center gap-3">
            <span
              className="h-px w-8"
              style={{ background: "var(--oa-brown)" }}
            />
            Desarrollos Inmobiliarios
          </span>
          <span className="hidden sm:block">Buenos Aires · Est. 2000</span>
        </div>
      </div>

      {/* ── HEADLINE EDITORIAL GIGANTE ── */}
      <div className="relative z-20 container-custom flex-1 flex items-center py-12 md:py-20">
        <div className="w-full">
          {/* Número de sección */}
          <div
            style={{
              opacity: isLoaded ? 1 : 0,
              transform: isLoaded ? "translateY(0)" : "translateY(20px)",
              transition: "all 1s var(--ease-out-expo)",
              transitionDelay: "100ms",
            }}
          >
            <span
              className="font-display italic font-light text-[13px] tracking-[0.2em] mb-6 block"
              style={{ color: "rgba(7,7,7,0.35)" }}
            >
              01
            </span>
          </div>

          <h1
            className="font-display font-light tracking-[-0.04em] leading-[0.9]"
            style={{
              fontSize: "clamp(3.5rem, 10vw, 11rem)",
              color: "var(--oa-black)",
              opacity: isLoaded ? 1 : 0,
              transform: isLoaded ? "translateY(0)" : "translateY(40px)",
              transition: "all 1.6s var(--ease-out-expo)",
              transitionDelay: "180ms",
            }}
          >
            <span className="block">
              Invertí en{" "}
              <em
                className="not-italic"
                style={{ color: "var(--oa-brown)" }}
              >
                desarrollos
              </em>
            </span>
            <span className="block">
              desde el inicio.
            </span>
          </h1>

          <p
            className="mt-8 md:mt-12 max-w-xl text-base md:text-lg leading-relaxed"
            style={{
              color: "rgba(7,7,7,0.65)",
              fontFamily: "var(--font-sans)",
              opacity: isLoaded ? 1 : 0,
              transform: isLoaded ? "translateY(0)" : "translateY(24px)",
              transition: "all 1.4s var(--ease-out-expo)",
              transitionDelay: "350ms",
            }}
          >
            Ingresá cuando la obra recién empieza, financiá en cuotas con un
            anticipo del 35%, y al finalizar revendé con una ganancia del 30–40%
            o generá renta pasiva con alquiler temporario.
          </p>

          <div
            className="mt-8 flex flex-wrap gap-3"
            style={{
              opacity: isLoaded ? 1 : 0,
              transform: isLoaded ? "translateY(0)" : "translateY(20px)",
              transition: "all 1.3s var(--ease-out-expo)",
              transitionDelay: "520ms",
            }}
          >
            <Link href="#desarrollos" className="btn-primary pr-10">
              Ver desarrollos
            </Link>
            <Link href="#modelo" className="btn-outline">
              Cómo funciona
            </Link>
          </div>
        </div>
      </div>

      {/* ── STATS STRIP ── */}
      <div className="relative z-20 container-custom pb-6">
        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-6 py-8"
          style={{
            borderTop: "1px solid rgba(7,7,7,0.1)",
            opacity: isLoaded ? 1 : 0,
            transform: isLoaded ? "translateY(0)" : "translateY(16px)",
            transition: "all 1.2s var(--ease-out-expo)",
            transitionDelay: "720ms",
          }}
        >
          {[
            { value: "30–40%", label: "Retorno al finalizar", accent: true },
            { value: "35%",    label: "Anticipo inicial",     accent: false },
            { value: "24/7",   label: "Gestión de renta",     accent: false },
            { value: "+25",    label: "Años de experiencia",  accent: false },
          ].map((stat) => (
            <div key={stat.label}>
              <div
                className="font-display font-light tracking-[-0.03em] leading-none"
                style={{
                  fontSize: "clamp(2rem, 3.5vw, 3.5rem)",
                  color: stat.accent ? "var(--oa-brown)" : "var(--oa-black)",
                }}
              >
                {stat.value}
              </div>
              <p
                className="mt-2 text-[9px] uppercase tracking-[0.18em]"
                style={{ color: "rgba(7,7,7,0.45)", fontFamily: "var(--font-sans)" }}
              >
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── SCROLL INDICATOR ── */}
      <div className="relative z-20 flex justify-center pb-7">
        <a
          href="#desarrollos"
          className="flex flex-col items-center gap-2 group transition-all duration-500"
          style={{
            color: "rgba(7,7,7,0.35)",
            opacity: isLoaded ? 1 : 0,
            transition: "opacity 1s var(--ease-out-expo)",
            transitionDelay: "1100ms",
          }}
        >
          <span
            className="text-[8px] uppercase tracking-[0.2em] group-hover:tracking-[0.3em] transition-all duration-500"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Explorar
          </span>
          <ChevronDown
            className="h-4 w-4 animate-bounce"
            style={{ color: "var(--oa-brown)" }}
          />
        </a>
      </div>
    </section>
  );
}
