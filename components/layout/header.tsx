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
          ? "bg-charcoal-900/95 backdrop-blur-md shadow-lg py-3"
          : "bg-transparent py-5"
      }`}
    >
      <div className="container-custom">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center group">
            <div className="relative h-12 w-32 md:h-14 md:w-40 transition-all duration-300">
              <Image
                src="/logo.png"
                alt="Barrera Brokers"
                fill
                priority
                className="object-contain object-left"
              />
            </div>
          </Link>

          {/* Desktop Menu */}
          <nav className="hidden lg:flex items-center space-x-10">
            {menuItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="label-tracking text-white/90 hover:text-gold-400 transition-colors"
              >
                {item.label}
              </a>
            ))}
            <Link
              href="/login"
              className="label-tracking border border-gold-400 text-gold-400 px-6 py-3 hover:bg-gold-400 hover:text-charcoal-900 transition-all duration-300"
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
              <X className="h-6 w-6 text-white" />
            ) : (
              <Menu className="h-6 w-6 text-white" />
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
                className="block px-4 py-3 label-tracking text-white hover:text-gold-400 hover:bg-white/5 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                {item.label}
              </a>
            ))}
            <Link
              href="/login"
              className="block mx-4 mt-4 px-6 py-3 text-center label-tracking border border-gold-400 text-gold-400 hover:bg-gold-400 hover:text-charcoal-900 transition-all"
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
