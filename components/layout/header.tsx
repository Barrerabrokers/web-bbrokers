"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSiteSettings } from "@/lib/use-site-settings";
import { SocialLinks } from "@/components/social-links";

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
    { href: "/#desarrollos-terminados", label: "Terminados" },
    { href: "/#mapa", label: "Mapa" },
    { href: "/#modelo", label: "Inversión" },
    { href: "/#prensa", label: "Prensa" },
    { href: "/#rentals", label: "Rentals" },
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
        className={`fixed left-0 right-0 top-0 z-50 transition-all duration-[900ms] ${
          scrolled ? "py-2.5 md:py-3" : "py-4 md:py-5"
        }`}
        style={{
          background: scrolled
            ? "rgba(7,7,7,0.86)"
            : "linear-gradient(180deg, rgba(7,7,7,0.6) 0%, rgba(7,7,7,0.22) 56%, transparent 100%)",
          backdropFilter: scrolled ? "blur(28px)" : "none",
          borderBottom: scrolled ? "1px solid rgba(248,245,239,0.12)" : "1px solid transparent",
          transitionTimingFunction: "var(--f-drawer)",
        }}
      >
        <div className="mx-auto flex w-full max-w-[1880px] items-center justify-between gap-5 px-5 md:px-8 xl:px-12 2xl:px-16">
          {/* Logo — siempre blanco sobre el hero */}
          <Link href="/" className="flex shrink-0 items-center gap-4">
            <Image
              src={settings.logoUrl}
              alt={settings.companyName}
              width={56}
              height={56}
              priority
              className="h-11 w-11 object-contain md:h-12 md:w-12 xl:h-14 xl:w-14"
            />
            <span className="flex flex-col">
              <span className="whitespace-nowrap font-display text-2xl tracking-[-0.04em] leading-none md:text-3xl xl:text-[2rem]" style={{ color: "#f8f5ef" }}>
                {firstWord}
                {restWords && (
                  <>
                    {" "}
                    <em className="not-italic font-normal">{restWords}</em>
                  </>
                )}
              </span>
              <span className="mt-1 whitespace-nowrap text-[8px] uppercase tracking-[0.16em] md:text-[9px] md:tracking-[0.22em]" style={{ color: "rgba(248,245,239,0.45)" }}>
                {city} · Est. 2000
              </span>
            </span>
          </Link>

          {/* Center nav — desktop */}
          <nav
            className="hidden min-w-0 flex-1 items-center justify-center gap-4 lg:flex xl:gap-5 2xl:gap-7"
            style={{
              color: "rgba(255,255,255,0.72)",
            }}
          >
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="whitespace-nowrap border-b border-transparent py-2 text-[9px] font-medium uppercase tracking-[0.2em] transition-all duration-300 2xl:text-[10px] 2xl:tracking-[0.24em]"
                style={{ color: "rgba(255,255,255,0.72)" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = "#fff";
                  (e.currentTarget as HTMLElement).style.borderBottomColor = "rgba(255,255,255,0.45)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.72)";
                  (e.currentTarget as HTMLElement).style.borderBottomColor = "transparent";
                }}
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex shrink-0 items-center gap-2 xl:gap-3">
            <SocialLinks
              iconOnly
              className="hidden flex-nowrap gap-1.5 xl:flex [&_a]:h-8 [&_a]:w-8 [&_svg]:h-3.5 [&_svg]:w-3.5 2xl:[&_a]:h-9 2xl:[&_a]:w-9 2xl:[&_svg]:h-4 2xl:[&_svg]:w-4"
            />
            <Link
              href="/login"
              className="hidden whitespace-nowrap px-2 py-2 text-[9px] uppercase tracking-[0.14em] transition-colors duration-300 md:inline-flex 2xl:px-3 2xl:text-[10px]"
              style={{ color: "rgba(255,255,255,0.55)" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#fff")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.55)")}
            >
              Portal
            </Link>
            <Link
              href="/#contacto"
              className="relative hidden items-center whitespace-nowrap rounded-full px-4 py-2 pr-8 text-[9px] font-medium uppercase tracking-[0.16em] transition-all duration-500 md:inline-flex 2xl:px-5 2xl:py-2.5 2xl:pr-9 2xl:text-[10px] 2xl:tracking-[0.18em]"
              style={{
                background: "rgba(255,255,255,0.92)",
                color: "#0a0a0b",
                border: "1px solid rgba(255,255,255,0.2)",
              }}
            >
              Agendar consulta
              <span
                className="absolute right-3 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full"
                style={{ background: "#0a0a0b" }}
              />
            </Link>

            {/* Hamburger capsule */}
            <button
              onClick={() => setIsMenuOpen(true)}
              className="flex h-10 w-12 items-center justify-center rounded-full backdrop-blur-md transition-all sm:w-auto sm:px-4 sm:py-2.5 xl:hidden"
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
            initial={{ opacity: 0, clipPath: "inset(0 0 100% 0)" }}
            animate={{ opacity: 1, clipPath: "inset(0 0 0% 0)" }}
            exit={{ opacity: 0, clipPath: "inset(0 0 100% 0)" }}
            transition={{ duration: 0.9, ease: [0.32, 0.72, 0, 1] }}
            className="fixed inset-0 z-[100] flex flex-col overflow-y-auto backdrop-blur-2xl"
            style={{
              background:
                "radial-gradient(circle at 50% 14%, rgba(216,196,175,0.13), transparent 28%), #151415",
              color: "#f8f5ef",
            }}
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
            <nav className="flex-1 flex flex-col items-center justify-center gap-1 px-5 py-10">
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
                  className="font-display text-4xl md:text-7xl text-[#f8f5ef]/82 hover:text-[#f8f5ef] transition-colors duration-300 py-1.5"
                >
                  {item.label}
                </motion.a>
              ))}
            </nav>

            {/* Bottom info */}
            <div className="container-custom pb-8 flex flex-col items-start gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-[11px] text-ivory/30 uppercase tracking-[0.15em]">
                  <p>{settings.email}</p>
                  <p className="mt-1">{settings.phone}</p>
                </div>
                <SocialLinks compact className="mt-4" />
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
