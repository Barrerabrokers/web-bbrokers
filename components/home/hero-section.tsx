"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { ArrowDownRight } from "lucide-react";

const VIDEO_SOURCES = [
  "/Buenos-Aires1.mp4",
  "/Buenos-Aires2.mp4",
  "/Buenos-Aires3.mp4",
];

type HeroSectionProps = {
  videos?: string[];
};

export function HeroSection({ videos = [] }: HeroSectionProps) {
  const sources = useMemo(() => {
    const videoSources = videos.filter(Boolean).slice(0, 3);
    return videoSources.length > 0 ? videoSources : VIDEO_SOURCES;
  }, [videos]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [active, setActive] = useState<"a" | "b">("a");
  const [srcA, setSrcA] = useState(sources[0]);
  const [srcB, setSrcB] = useState(sources[1] || sources[0]);

  const refA = useRef<HTMLVideoElement>(null);
  const refB = useRef<HTMLVideoElement>(null);
  const queueIdx = useRef(2);

  const playVideo = (el: HTMLVideoElement | null) => {
    if (!el) return;
    el.currentTime = 0;
    el.playbackRate = 0.72;
    el.play().catch(() => {});
  };

  const nextSrc = useCallback(() => {
    const src = sources[queueIdx.current % sources.length];
    queueIdx.current++;
    return src;
  }, [sources]);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 120);
    playVideo(refA.current);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (active !== "a") refA.current?.load();
  }, [srcA, active]);

  useEffect(() => {
    if (active !== "b") refB.current?.load();
  }, [srcB, active]);

  const handleEndedA = useCallback(() => {
    setActive("b");
    playVideo(refB.current);
    setSrcA(nextSrc());
  }, [nextSrc]);

  const handleEndedB = useCallback(() => {
    setActive("a");
    playVideo(refA.current);
    setSrcB(nextSrc());
  }, [nextSrc]);

  const fade = "opacity 1.1s cubic-bezier(0.19, 1, 0.22, 1)";

  return (
    <section
      id="inicio"
      className="relative min-h-[100svh] overflow-hidden bg-[#070707] text-[#f8f5ef]"
    >
      <div className="absolute inset-0">
        <video
          ref={refA}
          autoPlay
          muted
          playsInline
          onEnded={handleEndedA}
          onError={handleEndedA}
          className="absolute inset-0 h-full w-full object-cover"
          style={{
            opacity: active === "a" ? 1 : 0,
            transition: fade,
            zIndex: active === "a" ? 2 : 1,
          }}
        >
          <source src={srcA} type="video/mp4" />
        </video>
        <video
          ref={refB}
          muted
          playsInline
          onEnded={handleEndedB}
          onError={handleEndedB}
          className="absolute inset-0 h-full w-full object-cover"
          style={{
            opacity: active === "b" ? 1 : 0,
            transition: fade,
            zIndex: active === "b" ? 2 : 1,
          }}
        >
          <source src={srcB} type="video/mp4" />
        </video>
        <div className="absolute inset-0 z-[3] bg-[linear-gradient(180deg,rgba(0,0,0,0.58)_0%,rgba(0,0,0,0.18)_38%,rgba(0,0,0,0.82)_100%)]" />
        <div className="absolute inset-0 z-[4] bg-[radial-gradient(circle_at_70%_35%,rgba(255,255,255,0.12),transparent_28%),linear-gradient(90deg,rgba(0,0,0,0.76)_0%,rgba(0,0,0,0.24)_55%,rgba(0,0,0,0.58)_100%)]" />
        <div className="absolute inset-0 z-[5] bg-grain opacity-30" />
        <svg
          aria-hidden="true"
          className="oa-arch-path z-[6]"
          viewBox="0 0 1440 820"
          preserveAspectRatio="none"
        >
          <linearGradient id="bb-hero-path" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#f8f5ef" stopOpacity="0" />
            <stop offset="0.32" stopColor="#d8c4af" stopOpacity="0.5" />
            <stop offset="0.68" stopColor="#f8f5ef" stopOpacity="0.22" />
            <stop offset="1" stopColor="#f8f5ef" stopOpacity="0" />
          </linearGradient>
          <path
            d="M-40 705C245 464 446 895 690 572c199-263 335-623 496-467 143 139-83 426 300 225"
            fill="none"
            stroke="url(#bb-hero-path)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>

      <div className="relative z-10 flex min-h-[100svh] flex-col">
        <div className="container-custom flex flex-1 items-end pb-24 pt-32 md:pb-28 md:pt-40">
          <div className="grid w-full grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-9 xl:col-span-8">
              <p
                className={`mb-6 text-[10px] uppercase tracking-[0.34em] text-white/58 transition-all duration-1000 md:mb-8 ${
                  isLoaded ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
                }`}
              >
                Barrera Brokers · Buenos Aires real estate
              </p>
              <h1
                className={`oa-hero-title font-display text-[14vw] font-light leading-[0.9] text-[#f8f5ef] transition-all duration-[1600ms] sm:text-[12vw] lg:text-[8.2vw] ${
                  isLoaded ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"
                }`}
                style={{ transitionTimingFunction: "var(--ease-out-expo)" }}
              >
                <span className="block">
                  <span>Invertí en </span><em className="italic text-[#d8c4af]">desarrollos</em>
                </span>
                <span className="block"><span> desde el inicio.</span></span>
              </h1>
            </div>

            <div className="col-span-12 flex flex-col justify-end lg:col-span-3">
              <div
                className={`max-w-sm border-t border-white/18 pt-6 transition-all delay-300 duration-[1400ms] ${
                  isLoaded ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
                }`}
              >
                <p className="text-lg leading-relaxed text-white/76 md:text-xl">
                  Ingresá cuando la obra recién empieza, financiá en cuotas con
                  un anticipo del 35%, y al finalizar revendé con una ganancia
                  del 30-40% o generá renta pasiva con alquiler temporario.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:flex-col">
                  <Link href="#desarrollos" className="btn-primary">
                    Ver desarrollos
                  </Link>
                  <Link href="#contacto" className="bb-hero-link">
                    Agendar consulta
                    <ArrowDownRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="container-custom pb-5 md:pb-8">
          <div className="grid border-t border-white/14 pt-5 text-white/70 sm:grid-cols-3">
            {[
              ["01", "Desarrollos premium en pozo"],
              ["02", "Compra y reventa estrategica"],
              ["03", "Rentals y administracion Airbnb"],
            ].map(([number, label]) => (
              <div key={number} className="flex items-center gap-4 py-3">
                <span className="font-display text-2xl text-[#d8c4af]">
                  {number}
                </span>
                <span className="text-[10px] uppercase tracking-[0.22em]">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
