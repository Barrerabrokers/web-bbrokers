"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Lista de videos del hero.
 * Para sumar mas videos, copiar archivos a /public/ y agregarlos a este array.
 * Se reproducen en secuencia. Si un archivo no existe (404), se saltea
 * automaticamente al siguiente, asi que el orden y los nombres pueden
 * irse ajustando segun los archivos que esten realmente en /public/.
 */
const VIDEO_SOURCES = [
  "/Buenos-Aires1.mp4",
  "/Buenos-Aires2.mp4",
  "/Buenos-Aires3.mp4",
  "/buenos-aires.mp4", // fallback: video original ya commiteado
];

/**
 * Hero — Obsidian Assembly inspired dark cinematic style
 * Video background with manifesto text for real estate investors
 */
export function HeroSection() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [videoIndex, setVideoIndex] = useState(0);
  const [failedSet, setFailedSet] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = 0.75;
    }
    // Trigger animations after mount
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Cuando cambia el video, recargar el <video> y reproducir
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.load();
    v.playbackRate = 0.75;
    const playPromise = v.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        // autoplay puede fallar en algunos navegadores; ignoramos
      });
    }
  }, [videoIndex]);

  // Avanza al siguiente video que no haya fallado.
  // Si ya fallaron todos menos uno, queda en ese.
  const nextValidIndex = (current: number, failed: Set<number>) => {
    for (let step = 1; step <= VIDEO_SOURCES.length; step++) {
      const candidate = (current + step) % VIDEO_SOURCES.length;
      if (!failed.has(candidate)) return candidate;
    }
    return current; // todos fallaron, mantener
  };

  const handleEnded = () => {
    setVideoIndex((i) => nextValidIndex(i, failedSet));
  };

  const handleError = () => {
    // Marcar este indice como fallido y saltar al siguiente valido
    setFailedSet((prev) => {
      const next = new Set(prev);
      next.add(videoIndex);
      // Si todavia hay alguno que no fallo, avanzamos
      if (next.size < VIDEO_SOURCES.length) {
        setVideoIndex((i) => nextValidIndex(i, next));
      }
      return next;
    });
  };

  return (
    <section
      id="inicio"
      className="relative min-h-screen flex flex-col bg-ink text-bone overflow-hidden"
    >
      {/* Video Background */}
      <div className="absolute inset-0 z-0">
        <video
          key={VIDEO_SOURCES[videoIndex]}
          ref={videoRef}
          autoPlay
          muted
          playsInline
          onEnded={handleEnded}
          onError={handleError}
          className="absolute inset-0 w-full h-full object-cover opacity-40"
          poster="/buenos-aires-poster.jpg"
        >
          <source src={VIDEO_SOURCES[videoIndex]} type="video/mp4" />
        </video>
        {/* Dark overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-ink/80 via-ink/60 to-ink" />
        {/* Grain texture */}
        <div className="absolute inset-0 bg-grain opacity-30" />
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
          className={`flex items-center justify-between text-[11px] uppercase tracking-widest text-bone/50 transition-all duration-1500 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
          }`}
          style={{ transitionTimingFunction: "var(--f-cubic)" }}
        >
          <span className="flex items-center gap-3">
            <span className="h-px w-8 bg-accent" />
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
              className={`font-display font-light text-bone text-[40px] sm:text-[56px] md:text-[72px] lg:text-[96px] xl:text-[120px] leading-[0.95] tracking-[-0.03em] transition-all duration-[2000ms] ${
                isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-16"
              }`}
              style={{ transitionTimingFunction: "var(--f-cubic)", transitionDelay: "200ms" }}
            >
              <span className="block">
                Invertí en <span className="italic text-accent">desarrollos</span>
              </span>
              <span className="block">
                desde el inicio.
              </span>
            </h1>

            <p
              className={`mt-10 md:mt-14 max-w-2xl text-bone/70 text-lg md:text-xl leading-relaxed transition-all duration-[2000ms] ${
                isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
              }`}
              style={{ transitionTimingFunction: "var(--f-cubic)", transitionDelay: "400ms" }}
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
          className={`grid grid-cols-2 md:grid-cols-4 gap-6 py-8 border-t border-bone/15 transition-all duration-[2000ms] ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
          style={{ transitionTimingFunction: "var(--f-cubic)", transitionDelay: "800ms" }}
        >
          <div>
            <div className="font-display font-light text-4xl md:text-5xl text-accent tracking-tight">
              30-40%
            </div>
            <p className="mt-2 text-[11px] uppercase tracking-widest text-bone/50">
              Retorno al finalizar
            </p>
          </div>
          <div>
            <div className="font-display font-light text-4xl md:text-5xl text-bone tracking-tight">
              35%
            </div>
            <p className="mt-2 text-[11px] uppercase tracking-widest text-bone/50">
              Anticipo inicial
            </p>
          </div>
          <div>
            <div className="font-display font-light text-4xl md:text-5xl text-bone tracking-tight">
              24/7
            </div>
            <p className="mt-2 text-[11px] uppercase tracking-widest text-bone/50">
              Gestión de renta
            </p>
          </div>
          <div>
            <div className="font-display font-light text-4xl md:text-5xl text-bone tracking-tight">
              +25
            </div>
            <p className="mt-2 text-[11px] uppercase tracking-widest text-bone/50">
              Años de experiencia
            </p>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="relative z-20 flex justify-center pb-8">
        <a
          href="#desarrollos"
          className={`flex flex-col items-center gap-2 text-bone/40 hover:text-accent transition-all duration-700 ${
            isLoaded ? "opacity-100" : "opacity-0"
          }`}
          style={{ transitionDelay: "1200ms" }}
        >
          <span className="text-[10px] uppercase tracking-widest">Explorar</span>
          <ChevronDown className="h-5 w-5 animate-bounce" />
        </a>
      </div>
    </section>
  );
}
