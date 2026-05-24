"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 24);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const menuItems = [
    { href: "/#propiedades", label: "Propiedades" },
    { href: "/#servicios", label: "Servicios" },
    { href: "/#nosotros", label: "Nosotros" },
    { href: "/#contacto", label: "Contacto" },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-1500 pointer-events-none ${
        scrolled || isMenuOpen ? "bg-bone/85 backdrop-blur-md border-b border-ink/10" : ""
      }`}
      style={{ transitionTimingFunction: "var(--f-cubic)" }}
    >
      <div className="container-custom">
        <div className="flex items-center justify-between h-20 pointer-events-auto">
          {/* Logo - Obsidian Assembly stack style */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative h-10 w-10 flex-shrink-0">
              <Image
                src="/logo.png"
                alt="Barrera Brokers"
                fill
                priority
                className="object-contain"
              />
            </div>
            <div className="hidden sm:flex flex-col leading-[0.85]">
              <span className="text-[11px] uppercase tracking-widest text-ink/65">
                The
              </span>
              <span className="font-display font-light text-2xl md:text-[28px] text-ink tracking-[-0.02em] -ml-0.5">
                Barrera
              </span>
              <span className="font-display italic font-light text-2xl md:text-[28px] text-ink tracking-[-0.02em] -ml-0.5">
                Brokers
              </span>
            </div>
          </Link>

          {/* Desktop Menu */}
          <nav className="hidden lg:flex items-center gap-10">
            {menuItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-[12px] uppercase tracking-widest text-ink/75 hover:text-ink transition-colors duration-300"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Right CTAs */}
          <div className="hidden lg:flex items-center gap-3">
            <Link
              href="/login"
              className="text-[11px] uppercase tracking-widest text-ink/65 hover:text-ink transition-colors duration-300 px-2"
            >
              Portal
            </Link>
            <Link href="/#contacto" className="btn-primary">
              Hablemos
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden p-2 text-ink rounded-full transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="lg:hidden pb-6 pt-2 space-y-1 animate-fade-in-down pointer-events-auto">
            {menuItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="block px-3 py-3 text-base text-ink/80 hover:text-ink hover:bg-ink/5 rounded-md transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                {item.label}
              </a>
            ))}
            <div className="pt-4 mt-4 border-t border-ink/10 flex flex-col gap-3">
              <Link
                href="/login"
                className="btn-outline justify-center w-full"
                onClick={() => setIsMenuOpen(false)}
              >
                Portal Agentes
              </Link>
              <Link
                href="/#contacto"
                className="btn-primary justify-center w-full"
                onClick={() => setIsMenuOpen(false)}
              >
                Hablemos
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
