"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isAtTop, setIsAtTop] = useState(true);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setScrolled(scrollY > 24);
      setIsAtTop(scrollY < 100);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initial check
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const menuItems = [
    { href: "/#desarrollos", label: "Desarrollos" },
    { href: "/#modelo", label: "Inversión" },
    { href: "/#renta", label: "Renta" },
    { href: "/#estadisticas", label: "Estadísticas" },
    { href: "/#propiedades", label: "Propiedades" },
    { href: "/#contacto", label: "Contacto" },
  ];

  // Dynamic colors based on scroll position
  const headerBg = scrolled || isMenuOpen
    ? "bg-ink/95 backdrop-blur-md border-b border-bone/10"
    : "";
  const textColor = isAtTop && !scrolled ? "text-bone" : "text-bone";
  const logoFilter = ""; // Logo is always visible

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 pointer-events-none ${headerBg}`}
      style={{ transitionTimingFunction: "var(--f-cubic)" }}
    >
      <div className="container-custom">
        <div className="flex items-center justify-between h-20 pointer-events-auto">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative h-10 w-10 flex-shrink-0">
              <Image
                src="/logo.png"
                alt="Barrera Brokers"
                fill
                priority
                className={`object-contain ${logoFilter}`}
              />
            </div>
            <div className="hidden sm:flex items-baseline gap-2">
              <span className={`font-display font-light text-2xl tracking-[-0.02em] ${textColor} transition-colors duration-500`}>
                Barrera <span className="italic">Brokers</span>
              </span>
            </div>
          </Link>



          {/* Desktop Menu */}
          <nav className="hidden lg:flex items-center gap-8">
            {menuItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={`text-[11px] uppercase tracking-widest ${textColor}/70 hover:${textColor} hover:text-accent transition-colors duration-300`}
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Right CTAs */}
          <div className="hidden lg:flex items-center gap-3">
            <Link
              href="/login"
              className={`text-[11px] uppercase tracking-widest ${textColor}/60 hover:text-accent transition-colors duration-300 px-2`}
            >
              Portal
            </Link>
            <Link href="/#contacto" className="btn-primary">
              Invertir ahora
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className={`lg:hidden p-2 ${textColor} rounded-full transition-colors`}
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
          <div className="lg:hidden pb-6 pt-2 space-y-1 animate-fade-in-down pointer-events-auto bg-ink">
            {menuItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="block px-3 py-3 text-base text-bone/80 hover:text-bone hover:bg-bone/5 rounded-md transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                {item.label}
              </a>
            ))}
            <div className="pt-4 mt-4 border-t border-bone/15 flex flex-col gap-3">
              <Link
                href="/login"
                className="btn-outline-light justify-center w-full"
                onClick={() => setIsMenuOpen(false)}
              >
                Portal Inversores
              </Link>
              <Link
                href="/#contacto"
                className="btn-primary justify-center w-full"
                onClick={() => setIsMenuOpen(false)}
              >
                Invertir ahora
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
