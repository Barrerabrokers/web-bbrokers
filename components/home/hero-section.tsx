"use client";

import Image from "next/image";
import { ChevronDown } from "lucide-react";

export function HeroSection() {
  return (
    <section
      id="inicio"
      className="relative h-screen min-h-[700px] flex items-center justify-center overflow-hidden"
    >
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1920&q=90"
          alt="Luxury real estate"
          fill
          priority
          className="object-cover animate-slow-zoom"
        />
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/70" />
      </div>

      {/* Content */}
      <div className="relative z-10 container-custom text-center text-white">
        <div className="animate-fade-in-up">
          {/* Small label */}
          <div className="mb-8 flex items-center justify-center gap-4">
            <div className="h-px w-12 bg-gold-500" />
            <span className="label-tracking text-gold-400">
              Real Estate Excellence
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
            Más de 20 años acompañando a quienes buscan invertir, habitar
            <br className="hidden md:block" />
            y rentabilizar las propiedades más exclusivas del mercado.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a href="#propiedades" className="btn-outline-light">
              Ver Propiedades
            </a>
            <a href="#contacto" className="text-white label-tracking hover:text-gold-400 transition-colors px-6 py-4">
              Contactar →
            </a>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-bounce">
        <ChevronDown className="h-6 w-6 text-white/60" />
      </div>

      {/* Bottom stats bar */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-black/30 backdrop-blur-sm border-t border-white/10">
        <div className="container-custom py-6">
          <div className="grid grid-cols-3 gap-8 text-center text-white">
            <div>
              <div className="heading-serif text-3xl md:text-4xl text-gold-400 mb-1">500+</div>
              <div className="label-tracking text-white/70 text-[10px]">Propiedades</div>
            </div>
            <div className="border-x border-white/20">
              <div className="heading-serif text-3xl md:text-4xl text-gold-400 mb-1">1,200+</div>
              <div className="label-tracking text-white/70 text-[10px]">Clientes</div>
            </div>
            <div>
              <div className="heading-serif text-3xl md:text-4xl text-gold-400 mb-1">20+</div>
              <div className="label-tracking text-white/70 text-[10px]">Años</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
