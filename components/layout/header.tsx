"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSiteSettings } from "@/lib/use-site-settings";

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const settings = useSiteSettings();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navItems = [
    { href: "/#desarrollos", label: "Desarrollos" },
    { href: "/#modelo", label: "Inversión" },
    { href: "/#renta", label: "Renta" },
    { href: "/#propiedades", label: "Propiedades" },
  ];

  // Render del wordmark: primera palabra normal, resto en italic
  const [firstWord, ...rest] = settings.companyName.split(" ");
  const restWords = rest.join(" ");
  // Ciudad para subtítulo (sin país)
  const city = settings.addressCity.split(",")[0].trim();

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-700"
        style={{
          padding: scrolled ? "12px 0" : "20px 0",
          background: scrolled
            ? "rgba(10,10,11,0.82)"
            : "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, transparent 100%)",
          backdropFilter: scrolled ? "blur(20px)" : "none",
          borderBottom: scrolled ? "1px solid rgba(255,255,255,0.07)" : "none",
          transitionTimingFunction: "var(--ease-out-expo)",
        }}
      >
        <div className="container-custom flex items-center justify-between">
          {/* Logo — siempre blanco sobre el hero */}
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt={settings.companyName}
              width={40}
              height={40}
              priority
              className="h-10 w-10 object-contain"
            />
            <span className="flex flex-col">
              <span className="font-display text-xl tracking-tight leading-none" style={{ color: "#f8f5ef" }}>
                {firstWord}
                {restWords && (
                  <>
                    {" "}
                    <em className="not-italic font-normal">{restWords}</em>
                  </>
                )}
              </span>
              <span className="text-[9px] uppercase tracking-[0.2em] mt-1" style={{ color: "rgba(248,245,239,0.45)" }}>
                {city} · Est. 2000
              </span>
            </span>
          </Link>

          {/* Center nav — desktop */}
          <nav
            className="hidden lg:flex items-center gap-1 px-2 py-1.5 rounded-full backdrop-blur-md"
            style={{
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.06)",
            }}
          >
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="px-4 py-2 rounded-full text-[10px] uppercase tracking-[0.14em] font-medium transition-all duration-300"
                style={{ color: "rgba(255,255,255,0.75)" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = "#fff";
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.75)";
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden md:inline-flex text-[10px] uppercase tracking-[0.15em] transition-colors duration-300 px-3 py-2"
              style={{ color: "rgba(255,255,255,0.55)" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#fff")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.55)")}
            >
              Portal
            </Link>
            <Link
              href="/#contacto"
              className="hidden md:inline-flex items-center px-6 py-2.5 pr-10 rounded-full text-[10px] uppercase tracking-[0.18em] font-medium relative transition-all duration-500"
              style={{
                background: "rgba(255,255,255,0.92)",
                color: "#0a0a0b",
                border: "1px solid rgba(255,255,255,0.2)",
              }}
            >
              Agendar consulta
              <span
                className="absolute right-3.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
                style={{ background: "#0a0a0b" }}
              />
            </Link>

            {/* Hamburger capsule */}
            <button
              onClick={() => setIsMenuOpen(true)}
              className="lg:hidden flex items-center gap-2 px-4 py-2.5 rounded-full backdrop-blur-md transition-all"
              style={{
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(255,255,255,0.08)",
              }}
              aria-label="Abrir menú"
            >
              <div className="flex flex-col gap-[5px]">
                <span className="block w-4 h-[1.5px]" style={{ background: "#fff" }} />
                <span className="block w-3 h-[1.5px]" style={{ background: "rgba(255,255,255,0.6)" }} />
              </div>
              <span className="text-[10px] uppercase tracking-[0.15em] hidden sm:block" style={{ color: "rgba(255,255,255,0.7)" }}>
                Menú
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Fullscreen menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.19, 1, 0.22, 1] }}
            className="fixed inset-0 z-[100] bg-obsidian/98 backdrop-blur-2xl flex flex-col"
          >
            {/* Close button */}
            <div className="container-custom flex justify-end pt-6">
              <button
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-ivory/[0.15] text-ivory/70 hover:text-ivory transition-colors"
              >
                <span className="text-[10px] uppercase tracking-[0.15em]">Cerrar</span>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </button>
            </div>

            {/* Nav links */}
            <nav className="flex-1 flex flex-col items-center justify-center gap-2">
              {[
                ...navItems,
                { href: "/#nosotros", label: "Nosotros" },
                { href: "/#contacto", label: "Contacto" },
              ].map((item, idx) => (
                <motion.a
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMenuOpen(false)}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + idx * 0.06, duration: 0.6, ease: [0.19, 1, 0.22, 1] }}
                  className="font-display text-4xl md:text-6xl text-ivory/80 hover:text-ivory transition-colors duration-300 py-2"
                >
                  {item.label}
                </motion.a>
              ))}
            </nav>

            {/* Bottom info */}
            <div className="container-custom pb-8 flex items-end justify-between">
              <div className="text-[11px] text-ivory/30 uppercase tracking-[0.15em]">
                <p>{settings.email}</p>
                <p className="mt-1">{settings.phone}</p>
              </div>
              <Link
                href="/#contacto"
                onClick={() => setIsMenuOpen(false)}
                className="btn-primary"
              >
                Agendar consulta
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
