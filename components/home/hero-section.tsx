"use client";

import { ChevronDown } from "lucide-react";
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
      className="relative h-screen min-h-[700px] flex items-center justify-center overflow-hidden bg-charcoal-900"
    >
      {/* Background Video */}
      <div className="absolute inset-0 z-0">
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
          {/* Video Buenos Aires - Pexels ID: 32119232 - free license */}
          <source
            src="https://videos.pexels.com/video-files/32119232/32119232-hd_1920_1080_30fps.mp4"
            type="video/mp4"
          />
          <source
            src="https://videos.pexels.com/video-files/32119232/32119232-uhd_2732_1440_30fps.mp4"
            type="video/mp4"
          />
          <source
            src="https://videos.pexels.com/video-files/32119232/32119232-hd_1280_720_30fps.mp4"
            type="video/mp4"
          />
          <source
            src="https://videos.pexels.com/video-files/32119232/32119232-uhd_3840_2160_30fps.mp4"
            type="video/mp4"
          />
        </video>

        {/* Fallback image while video loads */}
        {!videoLoaded && (
          <div
            className="absolute inset-0 bg-cover bg-center animate-slow-zoom"
            style={{
              backgroundImage:
                "url(https://images.unsplash.com/photo-1589909202802-8f4aadce1849?w=1920&q=80)",
            }}
          />
        )}

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/80" />
      </div>

      {/* Content */}
      <div className="relative z-10 container-custom text-center text-white">
        <div className="animate-fade-in-up">
          {/* Small label */}
          <div className="mb-8 flex items-center justify-center gap-4">
            <div className="h-px w-12 bg-gold-500" />
            <span className="label-tracking text-gold-400">
              Buenos Aires Real Estate
            </span>
            <div className="h-px w-12 bg-gold-500" />
          </div>

          {/* Main heading */}
          <h1 className="heading-serif text-5xl md:text-7xl lg:text-8xl mb-8 leading-tight">
            Encuentra tu
            <br />
            <span className="italic text-gold-400">propiedad ideal</span>
          </h1>

          {/* Subtitle */}
          <p className="max-w-2xl mx-auto text-base md:text-lg text-white/80 mb-12 leading-relaxed font-light">
            Mas de 20 anos acompanando a quienes buscan invertir, habitar
            <br className="hidden md:block" />
            y rentabilizar las propiedades mas exclusivas del mercado.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a href="#propiedades" className="btn-outline-light">
              Ver Propiedades
            </a>
            <a
              href="#contacto"
              className="text-white label-tracking hover:text-gold-400 transition-colors px-6 py-4"
            >
              Contactar -&gt;
            </a>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10 animate-bounce">
        <ChevronDown className="h-6 w-6 text-white/60" />
      </div>

      {/* Bottom stats bar */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-black/40 backdrop-blur-sm border-t border-white/10">
        <div className="container-custom py-6">
          <div className="grid grid-cols-3 gap-8 text-center text-white">
            <div>
              <div className="heading-serif text-3xl md:text-4xl text-gold-400 mb-1">
                500+
              </div>
              <div className="label-tracking text-white/70 text-[10px]">
                Propiedades
              </div>
            </div>
            <div className="border-x border-white/20">
              <div className="heading-serif text-3xl md:text-4xl text-gold-400 mb-1">
                1,200+
              </div>
              <div className="label-tracking text-white/70 text-[10px]">
                Clientes
              </div>
            </div>
            <div>
              <div className="heading-serif text-3xl md:text-4xl text-gold-400 mb-1">
                20+
              </div>
              <div className="label-tracking text-white/70 text-[10px]">
                Anos
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
