"use client";

import { ArrowRight, ArrowDown } from "lucide-react";
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
      className="relative min-h-screen flex items-center overflow-hidden bg-gray-950 pt-24"
    >
      {/* Background gradient layers (Linear-style) */}
      <div className="absolute inset-0 -z-10 bg-grid opacity-[0.4]" />
      <div className="absolute inset-0 -z-10 bg-glow-accent" />
      <div className="absolute inset-0 -z-10 bg-noise opacity-[0.4] mix-blend-overlay pointer-events-none" />

      {/* Background video (subtle, behind everything) */}
      <div className="absolute inset-0 -z-20 opacity-[0.18]">
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className={`w-full h-full object-cover transition-opacity duration-1000 ${
            videoLoaded ? "opacity-100" : "opacity-0"
          }`}
        >
          <source src="/buenos-aires.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-gray-950/40 via-gray-950/70 to-gray-950" />
      </div>

      <div className="container-custom relative z-10 py-16 md:py-24">
        <div className="max-w-4xl mx-auto text-center animate-fade-in-up">
          {/* Eyebrow chip */}
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-8 rounded-full border border-gray-800 bg-gray-900/60 backdrop-blur-sm">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
            </span>
            <span className="text-xs font-medium tracking-tight text-gray-300">
              Buenos Aires real estate
            </span>
          </div>

          {/* Main heading - Linear style: ultra tight, large, gradient */}
          <h1 className="text-5xl md:text-7xl lg:text-[88px] font-semibold tracking-tightest leading-[1.02] mb-6">
            <span className="text-gradient">Encontra la propiedad</span>
            <br />
            <span className="text-gradient-accent">que estabas buscando.</span>
          </h1>

          {/* Subtitle */}
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-gray-400 leading-relaxed mb-10 tracking-tight">
            Hace mas de 20 anos acompanamos a quienes buscan invertir, habitar y
            rentabilizar las propiedades mas exclusivas de Buenos Aires.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <a href="#propiedades" className="btn-primary">
              Ver propiedades
              <ArrowRight className="h-4 w-4" />
            </a>
            <a href="#contacto" className="btn-outline">
              Hablar con un agente
            </a>
          </div>

          {/* Stats inline */}
          <div className="mt-20 grid grid-cols-3 gap-8 max-w-2xl mx-auto pt-10 border-t border-gray-800">
            <div>
              <div className="text-3xl md:text-4xl font-semibold tracking-tightest text-gray-50">
                500<span className="text-accent">+</span>
              </div>
              <div className="mt-1 text-xs text-gray-500 tracking-tight">
                Propiedades
              </div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-semibold tracking-tightest text-gray-50">
                1.2k<span className="text-accent">+</span>
              </div>
              <div className="mt-1 text-xs text-gray-500 tracking-tight">
                Clientes
              </div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-semibold tracking-tightest text-gray-50">
                20<span className="text-accent">+</span>
              </div>
              <div className="mt-1 text-xs text-gray-500 tracking-tight">
                Anos
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll hint */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
        <a
          href="#propiedades"
          className="flex flex-col items-center gap-2 text-gray-500 hover:text-gray-300 transition-colors"
          aria-label="Scroll"
        >
          <span className="text-[10px] uppercase tracking-widest">Scroll</span>
          <ArrowDown className="h-4 w-4 animate-bounce" />
        </a>
      </div>
    </section>
  );
}
