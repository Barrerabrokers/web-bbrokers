"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const menuItems = [
    { href: "#inicio", label: "Inicio" },
    { href: "#propiedades", label: "Propiedades" },
    { href: "#servicios", label: "Servicios" },
    { href: "#nosotros", label: "Nosotros" },
    { href: "#contacto", label: "Contacto" },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled || isMenuOpen
          ? "bg-white/95 backdrop-blur-md shadow-sm py-4"
          : "bg-transparent py-6"
      }`}
    >
      <div className="container-custom">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center group">
            <span
              className={`heading-serif text-2xl md:text-3xl font-normal tracking-wide transition-colors ${
                scrolled || isMenuOpen ? "text-charcoal-900" : "text-white"
              }`}
            >
              Barrera<span className="text-gold-600">.</span>Brokers
            </span>
          </Link>

          {/* Desktop Menu */}
          <nav className="hidden lg:flex items-center space-x-12">
            {menuItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={`label-tracking transition-colors hover:text-gold-600 ${
                  scrolled ? "text-charcoal-900" : "text-white"
                }`}
              >
                {item.label}
              </a>
            ))}
            <Link
              href="/login"
              className={`label-tracking border px-6 py-3 transition-all duration-300 ${
                scrolled
                  ? "border-charcoal-900 text-charcoal-900 hover:bg-charcoal-900 hover:text-white"
                  : "border-white text-white hover:bg-white hover:text-charcoal-900"
              }`}
            >
              Portal Agentes
            </Link>
          </nav>

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden p-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? (
              <X className={`h-6 w-6 ${scrolled || isMenuOpen ? "text-charcoal-900" : "text-white"}`} />
            ) : (
              <Menu className={`h-6 w-6 ${scrolled ? "text-charcoal-900" : "text-white"}`} />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="lg:hidden mt-6 pb-6 space-y-1 animate-fade-in">
            {menuItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="block px-4 py-3 label-tracking text-charcoal-900 hover:text-gold-600 hover:bg-charcoal-50 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                {item.label}
              </a>
            ))}
            <Link
              href="/login"
              className="block mx-4 mt-4 px-6 py-3 text-center label-tracking border border-charcoal-900 text-charcoal-900 hover:bg-charcoal-900 hover:text-white transition-all"
              onClick={() => setIsMenuOpen(false)}
            >
              Portal Agentes
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
