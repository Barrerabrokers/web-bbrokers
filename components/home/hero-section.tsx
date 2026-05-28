"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Lista de videos del hero.
 * Para sumar mas videos, copiar archivos a /public/ y agregarlos a este array.
 * Se reproducen en secuencia con CROSSFADE entre uno y otro.
 * Si un archivo no existe (404), el componente lo marca como fallido y
 * salta al siguiente automaticamente.
 */
const VIDEO_SOURCES = [
  "/Buenos-Aires1.mp4",
  "/Buenos-Aires2.mp4",
  "/Buenos-Aires3.mp4",
];

const FADE_MS = 1000; // duracion del crossfade entre videos

/**
 * Hero — fondo de video con crossfade suave entre 3 videos
 * de Buenos Aires. Doble buffer: dos <video> apilados que
 * alternan opacity para que la transicion sea continua.
 */
export function HeroSection() {
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const refs = [videoARef, videoBRef] as const;

  const [isLoaded, setIsLoaded] = useState(false);

  // Buffer activo (el que se ve)
  const [active, setActive] = useState<0 | 1>(0);

  // Que video tiene cargado cada buffer
  const [sources, setSources] = useState<[string, string]>(() => [
    VIDEO_SOURCES[0],
    VIDEO_SOURCES[1 % VIDEO_SOURCES.length],
  ]);

  // Cursor en VIDEO_SOURCES: indice del ultimo video asignado a un buffer
  const [queueIdx, setQueueIdx] = useState(1 % VIDEO_SOURCES.length);

  // Set de fuentes que fallaron, para no insistir
  const [failedSrcs, setFailedSrcs] = useState<Set<string>>(new Set());

  // Animacion de entrada del contenido
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Cuando cambian los src de los buffers, recargarlos y poner playbackRate
  useEffect(() => {
    refs.forEach((r) => {
      const v = r.current;
      if (!v) return;
      try {
        v.load();
        v.playbackRate = 0.75;
      } catch {}
    });
    // Asegurar que el activo este reproduciendo
    const av = refs[active].current;
    if (av) {
      av.play().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources[0], sources[1]]);

  // Helper: encontrar el siguiente indice de VIDEO_SOURCES que no haya fallado
  const findNextValidIndex = (start: number) => {
    for (let step = 1; step <= VIDEO_SOURCES.length; step++) {
      const candidate = (start + step) % VIDEO_SOURCES.length;
      if (!failedSrcs.has(VIDEO_SOURCES[candidate])) return candidate;
    }
    return start; // todos fallaron, mantener
  };

  // Mientras el activo se acerca al final, "calentar" el otro buffer
  // empezando a reproducirlo, asi al hacer el crossfade ya esta corriendo.
  const handleTimeUpdate = (whichBuffer: 0 | 1) => {
    if (whichBuffer !== active) return;
    const v = refs[whichBuffer].current;
    if (!v || !v.duration || isNaN(v.duration)) return;
    const remaining = v.duration - v.currentTime;
    if (remaining < FADE_MS / 1000 + 0.3) {
      const other = refs[1 - whichBuffer].current;
      if (other && other.paused && other.readyState >= 2) {
        try {
          other.currentTime = 0;
        } catch {}
        other.play().catch(() => {});
      }
    }
  };

  // Cuando el video activo termina, swappeamos el buffer visible.
  // Despues del fade, cargamos el proximo video en el buffer que salio.
  const handleEnded = (whichBuffer: 0 | 1) => {
    if (whichBuffer !== active) return;

    const oldActive = active;
    const newActive: 0 | 1 = oldActive === 0 ? 1 : 0;
    setActive(newActive);

    window.setTimeout(() => {
      const nextIdx = findNextValidIndex(queueIdx);
      setQueueIdx(nextIdx);
      setSources((prev) => {
        const updated: [string, string] = [prev[0], prev[1]];
        updated[oldActive] = VIDEO_SOURCES[nextIdx];
        return updated;
      });
    }, FADE_MS + 100);
  };

  // Si un video falla (404, codec), marcarlo y reemplazar ese buffer
  const handleError = (whichBuffer: 0 | 1) => {
    const failedSrc = sources[whichBuffer];
    setFailedSrcs((prev) => {
      const next = new Set(prev);
      next.add(failedSrc);
      return next;
    });
    const idxFailed = VIDEO_SOURCES.indexOf(failedSrc);
    const nextIdx = findNextValidIndex(idxFailed >= 0 ? idxFailed : queueIdx);
    if (VIDEO_SOURCES[nextIdx] === failedSrc) return; // todos fallaron
    setSources((prev) => {
      const updated: [string, string] = [prev[0], prev[1]];
      updated[whichBuffer] = VIDEO_SOURCES[nextIdx];
      return updated;
    });
  };

  return (
    <section
      id="inicio"
      className="relative min-h-screen flex flex-col bg-ink text-bone overflow-hidden"
    >
      {/* Doble buffer de video para crossfade continuo */}
      <div className="absolute inset-0 z-0">
        {([0, 1] as const).map((idx) => (
          <video
            key={`buffer-${idx}-${sources[idx]}`}
            ref={refs[idx]}
            autoPlay={idx === active}
            muted
            playsInline
            preload="auto"
            onTimeUpdate={() => handleTimeUpdate(idx)}
            onEnded={() => handleEnded(idx)}
            onError={() => handleError(idx)}
            className="absolute inset-0 w-full h-full object-cover transition-opacity ease-linear"
            style={{
              opacity: idx === active ? 0.7 : 0,
              transitionDuration: `${FADE_MS}ms`,
            }}
            poster={idx === 0 ? "/buenos-aires-poster.jpg" : undefined}
          >
            <source src={sources[idx]} type="video/mp4" />
          </video>
        ))}

        {/* Overlay degradado: arriba/centro mas claros para que se vea
            el video, abajo mas oscuro para que las stats sean legibles */}
        <div className="absolute inset-0 bg-gradient-to-b from-ink/35 via-ink/20 to-ink/95" />

        {/* Grain texture sutil */}
        <div className="absolute inset-0 bg-grain opacity-15" />
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
              <span className="block">desde el inicio.</span>
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
