"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { Menu, X, ArrowRight } from "lucide-react";

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 16);
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
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled || isMenuOpen
          ? "bg-gray-950/80 backdrop-blur-xl border-b border-gray-800"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="container-custom">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative h-9 w-9 flex-shrink-0">
              <Image
                src="/logo.png"
                alt="Barrera Brokers"
                fill
                priority
                className="object-contain"
              />
            </div>
            <div className="hidden sm:flex items-baseline gap-2">
              <span className="text-[15px] font-semibold tracking-tight text-gray-50">
                Barrera Brokers
              </span>
              <span className="hidden md:inline text-[11px] tracking-tight text-gray-500">
                Real Estate
              </span>
            </div>
          </Link>

          {/* Desktop Menu */}
          <nav className="hidden lg:flex items-center gap-1">
            {menuItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="px-3 py-1.5 text-sm text-gray-300 hover:text-gray-50 rounded-md hover:bg-gray-900 transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Right CTAs */}
          <div className="hidden lg:flex items-center gap-2">
            <Link href="/login" className="btn-ghost text-sm">
              Portal Agentes
            </Link>
            <Link
              href="/#contacto"
              className="btn-primary text-sm"
            >
              Hablemos
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden p-2 text-gray-300 hover:text-gray-50 hover:bg-gray-900 rounded-md transition-colors"
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
          <div className="lg:hidden pb-4 pt-2 space-y-1 animate-fade-in-down">
            {menuItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="block px-3 py-2.5 text-sm text-gray-300 hover:text-gray-50 hover:bg-gray-900 rounded-md transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                {item.label}
              </a>
            ))}
            <div className="pt-3 mt-3 border-t border-gray-800 flex flex-col gap-2">
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
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
