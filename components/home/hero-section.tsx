"use client";

import { ArrowDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function HeroSection() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoLoaded, setVideoLoaded] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleCanPlay = () => {
      setVideoLoaded(true);
      video.play().catch((err) => {
        console.log("Autoplay prevented:", err);
      });
    };

    video.addEventListener("canplay", handleCanPlay);
    video.load();

    return () => {
      video.removeEventListener("canplay", handleCanPlay);
    };
  }, []);

  return (
    <section
      id="inicio"
      className="relative h-screen min-h-[760px] w-full overflow-hidden bg-cream-900"
    >
      {/* Video full-bleed protagonist */}
      <div className="absolute inset-0">
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          poster="https://images.unsplash.com/photo-1589909202802-8f4aadce1849?w=1920&q=80"
          className={`w-full h-full object-cover transition-opacity duration-1000 ${
            videoLoaded ? "opacity-100" : "opacity-0"
          }`}
        >
          <source src="/buenos-aires.mp4" type="video/mp4" />
        </video>

        {/* Fallback image while video loads */}
        {!videoLoaded && (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage:
                "url(https://images.unsplash.com/photo-1589909202802-8f4aadce1849?w=1920&q=80)",
            }}
          />
        )}

        {/* Overlay: subtle gradient bottom for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60" />
      </div>

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col">
        <div className="flex-1 flex items-end pb-32 md:pb-36">
          <div className="container-custom w-full">
            <div className="animate-fade-in-up max-w-6xl">
              {/* Eyebrow */}
              <div className="mb-6 md:mb-8 flex items-center gap-3 text-cream-100/80">
                <span className="h-px w-10 bg-cream-100/50" />
                <span className="text-[11px] tracking-widest uppercase">
                  Buenos Aires Real Estate &nbsp;/&nbsp; Est. 2000
                </span>
              </div>

              {/* Editorial display headline */}
              <h1 className="font-display text-cream-100 leading-[0.92] tracking-tightest text-[64px] sm:text-[88px] md:text-[120px] lg:text-[156px] xl:text-[176px]">
                Encontra
                <br />
                <span className="italic">la propiedad</span>
                <br />
                que buscas.
              </h1>
            </div>
          </div>
        </div>

        {/* Bottom strip: subtitle + CTA + scroll */}
        <div className="container-custom pb-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-t border-cream-100/20 pt-6">
            <p className="text-cream-100/85 text-sm md:text-base max-w-md leading-relaxed">
              Mas de 20 anos acompanando a quienes buscan invertir, habitar y
              rentabilizar las propiedades mas exclusivas de Buenos Aires.
            </p>
            <div className="flex items-center gap-3 md:gap-4 flex-wrap">
              <a href="#propiedades" className="btn-outline-light">
                Ver propiedades
              </a>
              <a
                href="#contacto"
                className="text-cream-100/90 hover:text-cream-100 text-xs uppercase tracking-widest px-4 py-3.5 transition-colors"
              >
                Hablar con un agente &rarr;
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll hint (top-right corner) */}
      <a
        href="#propiedades"
        className="hidden md:flex absolute right-10 top-1/2 -translate-y-1/2 z-10 flex-col items-center gap-3 text-cream-100/60 hover:text-cream-100 transition-colors"
        aria-label="Scroll"
      >
        <span className="text-[10px] uppercase tracking-widest [writing-mode:vertical-rl]">
          Scroll
        </span>
        <ArrowDown className="h-4 w-4 animate-bounce" />
      </a>
    </section>
  );
}
