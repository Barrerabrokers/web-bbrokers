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
      className="relative h-screen min-h-[760px] w-full overflow-hidden bg-ink-700"
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
            videoLoaded ? "opacity-100 animate-slow-zoom" : "opacity-0"
          }`}
        >
          <source src="/buenos-aires.mp4" type="video/mp4" />
        </video>

        {/* Fallback poster while video loads */}
        {!videoLoaded && (
          <div
            className="absolute inset-0 bg-cover bg-center animate-slow-zoom"
            style={{
              backgroundImage:
                "url(https://images.unsplash.com/photo-1589909202802-8f4aadce1849?w=1920&q=80)",
            }}
          />
        )}

        {/* Luxury overlay: gradient bottom for legibility */}
        <div className="absolute inset-0 bg-gradient-to-b from-ink-700/40 via-ink-700/30 to-ink-700/80" />
      </div>

      {/* Top eyebrow */}
      <div className="absolute top-0 left-0 right-0 z-10">
        <div className="container-custom pt-32 md:pt-36">
          <div className="flex items-center justify-center">
            <span className="text-[11px] uppercase tracking-widest text-white/80">
              Buenos Aires &middot; Argentina &middot; Est. 2000
            </span>
          </div>
        </div>
      </div>

      {/* Main content centered */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center px-6 text-center">
        <div className="animate-fade-in-up max-w-5xl">
          <h1 className="font-display font-light text-white leading-[0.98] tracking-[-0.025em] text-[52px] sm:text-[72px] md:text-[100px] lg:text-[128px]">
            Stewart &amp; Co
            <br />
            <span className="italic">Real Estate</span>
          </h1>

          <p className="mt-8 md:mt-10 text-white/90 text-base md:text-lg max-w-xl mx-auto leading-relaxed font-light">
            Your Buenos Aires Real Estate Experts.
            <br />
            Acompanamos a quienes buscan invertir, habitar y rentabilizar las
            propiedades mas exclusivas de Argentina.
          </p>

          <div className="mt-10 md:mt-12 flex flex-wrap items-center justify-center gap-3">
            <a href="#propiedades" className="btn-outline-light">
              Ver propiedades
            </a>
            <a
              href="#contacto"
              className="text-[11px] uppercase tracking-widest text-white/85 hover:text-white px-4 py-3.5 transition-colors"
            >
              Hablemos &rarr;
            </a>
          </div>
        </div>
      </div>

      {/* Scroll hint */}
      <a
        href="#propiedades"
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 text-white/65 hover:text-white transition-colors"
        aria-label="Scroll"
      >
        <span className="text-[10px] uppercase tracking-widest">Scroll</span>
        <ArrowDown className="h-3.5 w-3.5 animate-bounce" />
      </a>
    </section>
  );
}
