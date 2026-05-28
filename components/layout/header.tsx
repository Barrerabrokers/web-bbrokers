"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Bloquear scroll cuando el menú está abierto
  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isMenuOpen]);

  const navItems = [
    { href: "/#desarrollos",  label: "Desarrollos" },
    { href: "/#modelo",       label: "Inversión"   },
    { href: "/#renta",        label: "Renta"        },
    { href: "/#propiedades",  label: "Propiedades"  },
  ];

  return (
    <>
      {/* ── NAVBAR FLOTANTE ── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-700"
        style={{
          paddingTop:    scrolled ? "12px" : "22px",
          paddingBottom: scrolled ? "12px" : "22px",
          transitionTimingFunction: "var(--ease-out-expo)",
        }}
      >
        {/* Fondo glassmorphism al hacer scroll */}
        <div
          className="absolute inset-0 transition-all duration-700"
          style={{
            background: scrolled
              ? "rgba(239, 230, 216, 0.85)"
              : "transparent",
            backdropFilter: scrolled ? "blur(20px) saturate(1.4)" : "none",
            borderBottom: scrolled
              ? "1px solid rgba(7,7,7,0.07)"
              : "none",
          }}
        />

        <div className="container-custom relative flex items-center justify-between">
          {/* ── LOGO ── */}
          <Link href="/" className="flex flex-col group" aria-label="Barrera Brokers">
            <span
              className="font-display text-[22px] leading-none tracking-[-0.02em] transition-opacity duration-300 group-hover:opacity-70"
              style={{ color: "var(--oa-black)" }}
            >
              Barrera <em className="not-italic">Brokers</em>
            </span>
            <span
              className="text-[8px] uppercase tracking-[0.22em] mt-0.5"
              style={{ color: "rgba(7,7,7,0.45)", fontFamily: "var(--font-sans)" }}
            >
              Buenos Aires · Est. 2000
            </span>
          </Link>

          {/* ── NAV CENTRAL en cápsulas — desktop ── */}
          <nav
            className="hidden lg:flex items-center gap-0.5 px-1.5 py-1.5 rounded-full"
            style={{
              background: "rgba(7,7,7,0.06)",
              border: "1px solid rgba(7,7,7,0.09)",
              backdropFilter: "blur(12px)",
            }}
          >
            {navItems.map((item) => (
              <a key={item.href} href={item.href} className="nav-pill">
                {item.label}
              </a>
            ))}
          </nav>

          {/* ── LADO DERECHO ── */}
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden md:inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] transition-colors duration-300 px-3 py-2"
              style={{
                color: "rgba(7,7,7,0.5)",
                fontFamily: "var(--font-sans)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--oa-black)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(7,7,7,0.5)")}
            >
              Portal
            </Link>

            {/* Botón CTA — blanco con punto negro */}
            <Link href="/#contacto" className="hidden md:inline-flex btn-primary pr-10">
              Agendar consulta
            </Link>

            {/* ── HAMBURGER CAPSULE — mobile ── */}
            <button
              onClick={() => setIsMenuOpen(true)}
              className="lg:hidden flex items-center gap-2.5 px-4 py-2.5 rounded-full transition-all duration-300"
              style={{
                background: "rgba(7,7,7,0.06)",
                border: "1px solid rgba(7,7,7,0.1)",
              }}
              aria-label="Abrir menú"
            >
              <div className="flex flex-col gap-[5px]">
                <span
                  className="block w-[18px] h-[1px] transition-all duration-300"
                  style={{ background: "var(--oa-black)" }}
                />
                <span
                  className="block w-3 h-[1px] transition-all duration-300"
                  style={{ background: "rgba(7,7,7,0.5)" }}
                />
              </div>
              <span
                className="text-[9px] uppercase tracking-[0.16em] hidden sm:block"
                style={{ color: "rgba(7,7,7,0.6)", fontFamily: "var(--font-sans)" }}
              >
                Menú
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* ── MENÚ OVERLAY FULLSCREEN ── */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
            className="fixed inset-0 z-[100] flex flex-col overflow-hidden"
            style={{ backgroundColor: "var(--oa-bg-cream)" }}
          >
            {/* Blur overlay */}
            <motion.div
              initial={{ backdropFilter: "blur(0px)" }}
              animate={{ backdropFilter: "blur(24px)" }}
              exit={{ backdropFilter: "blur(0px)" }}
              transition={{ duration: 0.6 }}
              className="absolute inset-0 pointer-events-none"
              style={{ background: "rgba(239,230,216,0.92)" }}
            />

            {/* Grain texture */}
            <div className="absolute inset-0 bg-grain opacity-40 pointer-events-none" />

            {/* Círculos decorativos */}
            <div
              className="circle-deco"
              style={{ width: "600px", height: "600px", top: "-150px", right: "-150px", opacity: 0.25 }}
            />
            <div
              className="circle-deco"
              style={{ width: "300px", height: "300px", bottom: "80px", left: "60px", opacity: 0.15 }}
            />

            {/* ── Top bar ── */}
            <div className="relative z-10 container-custom flex items-center justify-between pt-5 pb-4">
              <Link
                href="/"
                onClick={() => setIsMenuOpen(false)}
                className="font-display text-[22px] leading-none tracking-[-0.02em]"
                style={{ color: "var(--oa-black)" }}
              >
                Barrera <em className="not-italic">Brokers</em>
              </Link>

              <button
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full transition-all duration-300"
                style={{
                  background: "rgba(7,7,7,0.06)",
                  border: "1px solid rgba(7,7,7,0.1)",
                  color: "rgba(7,7,7,0.7)",
                  fontFamily: "var(--font-sans)",
                }}
              >
                <span className="text-[9px] uppercase tracking-[0.16em]">Cerrar</span>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.2"/>
                </svg>
              </button>
            </div>

            {/* ── Links de navegación ── */}
            <nav className="relative z-10 flex-1 flex flex-col justify-center px-8 md:px-14 lg:px-20 gap-0">
              {[
                ...navItems,
                { href: "/#nosotros", label: "Nosotros" },
                { href: "/#contacto", label: "Contacto" },
              ].map((item, idx) => (
                <motion.div
                  key={item.href}
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{
                    delay: 0.08 + idx * 0.07,
                    duration: 0.7,
                    ease: [0.19, 1, 0.22, 1],
                  }}
                  className="border-b"
                  style={{ borderColor: "rgba(7,7,7,0.07)" }}
                >
                  <a
                    href={item.href}
                    onClick={() => setIsMenuOpen(false)}
                    className="group flex items-center justify-between py-5 md:py-6 w-full"
                    style={{ color: "var(--oa-black)" }}
                  >
                    <span
                      className="font-display font-light leading-none tracking-[-0.02em] transition-all duration-500 group-hover:italic group-hover:translate-x-2"
                      style={{ fontSize: "clamp(2.2rem, 6vw, 5rem)" }}
                    >
                      {item.label}
                    </span>
                    <span
                      className="text-[9px] uppercase tracking-[0.18em] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      style={{ color: "rgba(7,7,7,0.45)", fontFamily: "var(--font-sans)" }}
                    >
                      0{idx + 1}
                    </span>
                  </a>
                </motion.div>
              ))}
            </nav>

            {/* ── Bottom info ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55, duration: 0.8, ease: [0.19, 1, 0.22, 1] }}
              className="relative z-10 container-custom pb-8 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6"
            >
              <div
                className="text-[10px] uppercase tracking-[0.16em] leading-loose"
                style={{ color: "rgba(7,7,7,0.45)", fontFamily: "var(--font-sans)" }}
              >
                <p>info@barrerabrokers.com</p>
                <p>+54 11 1234-5678</p>
              </div>
              <Link
                href="/#contacto"
                onClick={() => setIsMenuOpen(false)}
                className="btn-primary pr-10"
              >
                Agendar consulta
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
