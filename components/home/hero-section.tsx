"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useCallback } from "react";
import { ChevronDown } from "lucide-react";

const VIDEO_SOURCES = [
  "/Buenos-Aires1.mp4",
  "/Buenos-Aires2.mp4",
  "/Buenos-Aires3.mp4",
];

/**
 * Hero con crossfade entre videos — doble buffer A/B.
 * Los 3 videos rotan en secuencia: 0→1→2→0→1→2…
 * Sin flash negro entre transiciones.
 */
export function HeroSection() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [active, setActive]     = useState<"a" | "b">("a");
  const [srcA, setSrcA]         = useState(VIDEO_SOURCES[0]);
  const [srcB, setSrcB]         = useState(VIDEO_SOURCES[1]);

  const refA = useRef<HTMLVideoElement>(null);
  const refB = useRef<HTMLVideoElement>(null);

  // Siguiente índice en la cola circular (independiente de A/B)
  // Empieza en 2 porque A=0 y B=1 ya están asignados
  const queueIdx = useRef(2);

  const playVideo = (el: HTMLVideoElement | null) => {
    if (!el) return;
    el.currentTime = 0;
    el.playbackRate = 0.75;
    el.play().catch(() => {});
  };

  const nextSrc = () => {
    const src = VIDEO_SOURCES[queueIdx.current % VIDEO_SOURCES.length];
    queueIdx.current++;
    return src;
  };

  // Al montar: arranca A, precarga B
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);
    playVideo(refA.current);
    refB.current?.load();
    return () => clearTimeout(timer);
  }, []);

  // A terminó → mostrar B, recargar A con el siguiente video
  const handleEndedA = useCallback(() => {
    setActive("b");
    playVideo(refB.current);
    const next = nextSrc();
    setSrcA(next);
    setTimeout(() => refA.current?.load(), 80);
  }, []);

  // B terminó → mostrar A, recargar B con el siguiente video
  const handleEndedB = useCallback(() => {
    setActive("a");
    playVideo(refA.current);
    const next = nextSrc();
    setSrcB(next);
    setTimeout(() => refB.current?.load(), 80);
  }, []);

  const handleErrorA = useCallback(() => handleEndedA(), [handleEndedA]);
  const handleErrorB = useCallback(() => handleEndedB(), [handleEndedB]);

  const FADE = "opacity 0.8s ease";

  return (
    <section
      id="inicio"
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ backgroundColor: "#0a0a0b" }}
    >
      {/* Video Background — doble buffer con crossfade */}
      <div className="absolute inset-0 z-0">
        {/* Buffer A */}
        <video
          ref={refA}
          autoPlay
          muted
          playsInline
          onEnded={handleEndedA}
          onError={handleErrorA}
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            opacity: active === "a" ? 1 : 0,
            transition: FADE,
            zIndex: active === "a" ? 2 : 1,
          }}
          poster="/buenos-aires-poster.jpg"
        >
          <source src={srcA} type="video/mp4" />
        </video>
        {/* Buffer B */}
        <video
          ref={refB}
          muted
          playsInline
          onEnded={handleEndedB}
          onError={handleErrorB}
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            opacity: active === "b" ? 1 : 0,
            transition: FADE,
            zIndex: active === "b" ? 2 : 1,
          }}
        >
          <source src={srcB} type="video/mp4" />
        </video>
        {/* Overlay oscuro para legibilidad del menú y headline */}
        <div
          className="absolute inset-0"
          style={{
            zIndex: 3,
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.65) 45%, rgba(0,0,0,0.90) 100%)",
          }}
        />
        {/* Capa de negro transparente uniforme — oscurece más todo el video */}
        <div
          className="absolute inset-0"
          style={{ zIndex: 4, background: "rgba(0,0,0,0.35)" }}
        />
        {/* Grain texture sutil */}
        <div className="absolute inset-0 bg-grain opacity-20" style={{ zIndex: 5 }} />
      </div>

      {/* Accent glow */}
      <div
        aria-hidden="true"
        className="absolute top-0 right-0 w-[50vw] h-[50vw] max-w-[800px] max-h-[800px] pointer-events-none z-10"
        style={{
          background:
            "radial-gradient(ellipse at top right, rgba(21,20,21,0.18) 0%, transparent 60%)",
        }}
      />

      {/* Top label line */}
      <div className="relative z-20 container-custom pt-28 md:pt-36">
        <div
          className={`flex items-center justify-between text-[11px] uppercase tracking-widest transition-all duration-1500 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
          }`}
          style={{ transitionTimingFunction: "var(--f-cubic)", color: "rgba(255,255,255,0.6)" }}
        >
          <span className="flex items-center gap-3">
            <span className="h-px w-8" style={{ background: "rgba(255,255,255,0.5)" }} />
            Desarrollos Inmobiliarios
          </span>
          <span>Buenos Aires · Est. 2000</span>
        </div>
      </div>

      {/* Manifest content */}
      <div className="relative z-20 container-custom flex-1 flex items-center py-16 md:py-24">
        <div className="grid grid-cols-12 gap-6 w-full">
          <div className="col-span-12 lg:col-span-10 xl:col-span-9">
            <h1
              className={`font-display font-light text-[40px] sm:text-[56px] md:text-[72px] lg:text-[96px] xl:text-[120px] leading-[0.95] tracking-[-0.03em] transition-all duration-[2000ms] ${
                isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-16"
              }`}
              style={{ transitionTimingFunction: "var(--f-cubic)", transitionDelay: "200ms", color: "#f8f5ef" }}
            >
              <span className="block">
                Invertí en <span className="italic" style={{ color: "#d8c4af" }}>desarrollos</span>
              </span>
              <span className="block">
                desde el inicio.
              </span>
            </h1>

            <p
              className={`mt-10 md:mt-14 max-w-2xl text-lg md:text-xl leading-relaxed transition-all duration-[2000ms] ${
                isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
              }`}
              style={{ transitionTimingFunction: "var(--f-cubic)", transitionDelay: "400ms", color: "rgba(248,245,239,0.72)" }}
            >
              Ingresá cuando la obra recién empieza, financiá en cuotas con un
              anticipo del 35%, y al finalizar revendé con una ganancia del 30-40%
              o generá renta pasiva con alquiler temporario.
            </p>

            <div
              className={`mt-10 flex flex-wrap gap-4 transition-all duration-[2000ms] ${
                isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
              }`}
              style={{ transitionTimingFunction: "var(--f-cubic)", transitionDelay: "600ms" }}
            >
              <Link href="#desarrollos" className="btn-primary">
                Ver desarrollos
              </Link>
              <Link href="#modelo" className="btn-outline-light">
                Cómo funciona
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="relative z-20 container-custom pb-8">
        <div
          className={`grid grid-cols-2 md:grid-cols-4 gap-6 py-8 transition-all duration-[2000ms] ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
          style={{ transitionTimingFunction: "var(--f-cubic)", transitionDelay: "800ms", borderTop: "1px solid rgba(255,255,255,0.15)" }}
        >
          <div>
            <div className="font-display font-light text-4xl md:text-5xl tracking-tight" style={{ color: "#d8c4af" }}>
              30-40%
            </div>
            <p className="mt-2 text-[11px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.45)" }}>
              Retorno al finalizar
            </p>
          </div>
          <div>
            <div className="font-display font-light text-4xl md:text-5xl tracking-tight" style={{ color: "#f8f5ef" }}>
              35%
            </div>
            <p className="mt-2 text-[11px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.45)" }}>
              Anticipo inicial
            </p>
          </div>
          <div>
            <div className="font-display font-light text-4xl md:text-5xl tracking-tight" style={{ color: "#f8f5ef" }}>
              24/7
            </div>
            <p className="mt-2 text-[11px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.45)" }}>
              Gestión de renta
            </p>
          </div>
          <div>
            <div className="font-display font-light text-4xl md:text-5xl tracking-tight" style={{ color: "#f8f5ef" }}>
              +25
            </div>
            <p className="mt-2 text-[11px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.45)" }}>
              Años de experiencia
            </p>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="relative z-20 flex justify-center pb-8">
        <a
          href="#desarrollos"
          className={`flex flex-col items-center gap-2 transition-all duration-700 ${
            isLoaded ? "opacity-100" : "opacity-0"
          }`}
          style={{ transitionDelay: "1200ms", color: "rgba(255,255,255,0.4)" }}
        >
          <span className="text-[10px] uppercase tracking-widest">Explorar</span>
          <ChevronDown className="h-5 w-5 animate-bounce" />
        </a>
      </div>
    </section>
  );
}
