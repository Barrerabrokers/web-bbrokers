"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  motion,
  useScroll,
  useTransform,
  useMotionValue,
  useSpring,
  AnimatePresence,
} from "framer-motion";
import { ArrowLeft, ArrowRight, ArrowUpRight, MapPin } from "lucide-react";
import { Development, DEVELOPMENT_STATUS_LABELS } from "@/types";
import { formatPrice } from "@/lib/utils";

interface Props {
  developments: Development[];
}

export function InteractiveDevelopmentsSection({ developments }: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [hasEntered, setHasEntered] = useState(false);

  // Mouse tilt for main card
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useSpring(useTransform(mouseY, [-300, 300], [3, -3]), {
    stiffness: 150,
    damping: 30,
  });
  const rotateY = useSpring(useTransform(mouseX, [-300, 300], [-3, 3]), {
    stiffness: 150,
    damping: 30,
  });

  // Scroll-based parallax
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  const parallaxY1 = useTransform(scrollYProgress, [0, 1], [80, -80]);
  const parallaxY2 = useTransform(scrollYProgress, [0, 1], [120, -120]);
  const parallaxY3 = useTransform(scrollYProgress, [0, 1], [60, -60]);
  const parallaxScale = useTransform(scrollYProgress, [0, 0.3], [0.92, 1]);
  const parallaxOpacity = useTransform(scrollYProgress, [0, 0.2], [0, 1]);

  // Intersection observer for entry animation
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setHasEntered(true);
      },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  // Navigation
  const nextProject = useCallback(() => {
    setDirection(1);
    setActiveIndex((prev) => (prev + 1) % developments.length);
  }, [developments.length]);

  const prevProject = useCallback(() => {
    setDirection(-1);
    setActiveIndex((prev) =>
      prev === 0 ? developments.length - 1 : prev - 1
    );
  }, [developments.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") nextProject();
      if (e.key === "ArrowLeft") prevProject();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [nextProject, prevProject]);

  // Mouse move handler for tilt
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  if (developments.length === 0) {
    return (
      <section className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
        <p className="text-[#F1EADE]/60 text-lg">
          Pronto vamos a publicar nuestros desarrollos.
        </p>
      </section>
    );
  }

  const activeDev = developments[activeIndex];
  const primaryImage =
    activeDev.images.find((i) => i.isPrimary)?.url ||
    activeDev.images[0]?.url;
  const priceFrom = activeDev.minPriceAvailable ?? activeDev.priceFrom;

  // Secondary cards (other developments for background collage)
  const secondaryDevs = developments.filter((_, i) => i !== activeIndex);

  // Slide animation variants
  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 300 : -300,
      opacity: 0,
      scale: 0.9,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -300 : 300,
      opacity: 0,
      scale: 0.9,
    }),
  };

  const textVariants = {
    enter: (dir: number) => ({
      y: dir > 0 ? 40 : -40,
      opacity: 0,
    }),
    center: {
      y: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      y: dir > 0 ? -40 : 40,
      opacity: 0,
    }),
  };

  return (
    <section
      ref={sectionRef}
      id="desarrollos"
      className="relative min-h-screen overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, rgba(120,82,60,0.08) 0%, #0A0A0B 15%, #11100F 85%, #0A0A0B 100%)",
      }}
    >
      {/* Decorative diagonal lines */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-0 left-[20%] w-px h-full opacity-[0.06]"
          style={{
            background:
              "linear-gradient(180deg, transparent 0%, #F1EADE 30%, #F1EADE 70%, transparent 100%)",
            transform: "rotate(2deg)",
          }}
        />
        <div
          className="absolute top-0 right-[30%] w-px h-full opacity-[0.04]"
          style={{
            background:
              "linear-gradient(180deg, transparent 0%, #F1EADE 40%, #F1EADE 60%, transparent 100%)",
            transform: "rotate(-1.5deg)",
          }}
        />
        <div
          className="absolute top-0 right-[15%] w-px h-full opacity-[0.03]"
          style={{
            background:
              "linear-gradient(180deg, transparent 10%, #F1EADE 50%, transparent 90%)",
            transform: "rotate(1deg)",
          }}
        />
      </div>

      {/* Grain texture */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        }}
      />

      <motion.div
        style={{ scale: parallaxScale, opacity: parallaxOpacity }}
        className="relative z-10 container-custom py-24 md:py-32 lg:py-40"
      >
        {/* Section header */}
        <div className="mb-16 md:mb-24">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={hasEntered ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1] }}
            className="text-[11px] uppercase tracking-[0.25em] mb-5"
            style={{ color: "rgba(241,234,222,0.68)" }}
          >
            Desarrollos en curso
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 40 }}
            animate={hasEntered ? { opacity: 1, y: 0 } : {}}
            transition={{
              duration: 1.2,
              delay: 0.15,
              ease: [0.19, 1, 0.22, 1],
            }}
            className="font-display font-light tracking-[-0.03em] leading-[1] text-[#F1EADE] max-w-3xl"
            style={{ fontSize: "clamp(2.2rem, 5vw, 4.5rem)" }}
          >
            Proyectos con{" "}
            <span className="italic">alta rentabilidad</span> en las mejores
            zonas.
          </motion.h2>
        </div>

        {/* Main layout: collage grid */}
        <div className="relative grid grid-cols-12 gap-4 md:gap-6 min-h-[70vh] items-center">
          {/* Secondary card LEFT — parallax */}
          {secondaryDevs[0] && (
            <motion.div
              style={{ y: parallaxY1 }}
              className="hidden lg:block col-span-3 col-start-1"
            >
              <SecondaryCard dev={secondaryDevs[0]} delay={0.3} hasEntered={hasEntered} />
            </motion.div>
          )}

          {/* MAIN CARD — center */}
          <div className="col-span-12 lg:col-span-6 lg:col-start-4 relative z-20">
            <motion.div
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              style={{
                rotateX,
                rotateY,
                transformPerspective: 1200,
              }}
              className="relative"
            >
              {/* Main image with AnimatePresence */}
              <div
                className="relative aspect-[4/5] md:aspect-[3/4] overflow-hidden cursor-pointer"
                style={{ borderRadius: "18px" }}
              >
                <AnimatePresence initial={false} custom={direction} mode="wait">
                  <motion.div
                    key={activeIndex}
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{
                      duration: 0.8,
                      ease: [0.19, 1, 0.22, 1],
                    }}
                    className="absolute inset-0"
                  >
                    <Link href={`/desarrollos/${activeDev.slug}`} className="block h-full group">
                      {primaryImage && (
                        <Image
                          src={primaryImage}
                          alt={activeDev.name}
                          fill
                          priority
                          className="object-cover transition-transform duration-[3000ms] ease-out group-hover:scale-[1.05]"
                          sizes="(max-width: 1024px) 100vw, 50vw"
                        />
                      )}

                      {/* Dark overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0B]/90 via-[#0A0A0B]/30 to-transparent" />

                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-[#0A0A0B]/0 group-hover:bg-[#0A0A0B]/20 transition-colors duration-700" />

                      {/* Status badge */}
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.6 }}
                        className="absolute top-5 left-5"
                      >
                        <span
                          className="px-4 py-2 text-[10px] uppercase tracking-[0.2em] font-medium rounded-full"
                          style={{
                            background: "rgba(120,82,60,0.45)",
                            backdropFilter: "blur(16px)",
                            color: "#F1EADE",
                            border: "1px solid rgba(241,234,222,0.12)",
                          }}
                        >
                          {DEVELOPMENT_STATUS_LABELS[activeDev.status]}
                        </span>
                      </motion.div>

                      {/* Content at bottom */}
                      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                        <AnimatePresence mode="wait" custom={direction}>
                          <motion.div
                            key={`text-${activeIndex}`}
                            custom={direction}
                            variants={textVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{
                              duration: 0.6,
                              ease: [0.19, 1, 0.22, 1],
                            }}
                          >
                            <div className="flex items-center gap-2 mb-3" style={{ color: "rgba(241,234,222,0.68)" }}>
                              <MapPin className="h-3.5 w-3.5" />
                              <span className="text-[11px] uppercase tracking-[0.2em]">
                                {activeDev.location}
                              </span>
                            </div>

                            <h3
                              className="font-display font-light text-[#F1EADE] tracking-[-0.02em] leading-[1.05] mb-4"
                              style={{ fontSize: "clamp(1.8rem, 4vw, 3.2rem)" }}
                            >
                              {activeDev.name}
                            </h3>

                            {/* Stats row */}
                            <div className="flex items-center gap-6 flex-wrap">
                              {priceFrom && (
                                <div>
                                  <p className="text-[9px] uppercase tracking-[0.2em] mb-0.5" style={{ color: "rgba(241,234,222,0.5)" }}>
                                    Desde
                                  </p>
                                  <span className="font-display text-lg text-[#B89474]">
                                    {formatPrice(priceFrom)}
                                  </span>
                                </div>
                              )}
                              {activeDev.completionDate && (
                                <div>
                                  <p className="text-[9px] uppercase tracking-[0.2em] mb-0.5" style={{ color: "rgba(241,234,222,0.5)" }}>
                                    Entrega
                                  </p>
                                  <span className="font-display text-lg text-[#F1EADE]">
                                    {activeDev.completionDate}
                                  </span>
                                </div>
                              )}
                              {activeDev.progress > 0 && (
                                <div>
                                  <p className="text-[9px] uppercase tracking-[0.2em] mb-0.5" style={{ color: "rgba(241,234,222,0.5)" }}>
                                    Avance
                                  </p>
                                  <span className="font-display text-lg text-[#F1EADE]">
                                    {activeDev.progress}%
                                  </span>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        </AnimatePresence>
                      </div>

                      {/* CTA arrow */}
                      <div className="absolute bottom-6 right-6 md:bottom-8 md:right-8">
                        <div
                          className="h-12 w-12 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-500"
                          style={{
                            background: "rgba(120,82,60,0.45)",
                            backdropFilter: "blur(16px)",
                            border: "1px solid rgba(241,234,222,0.12)",
                          }}
                        >
                          <ArrowUpRight className="h-5 w-5 text-[#F1EADE]" />
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                </AnimatePresence>

                {/* Counter */}
                <div className="absolute bottom-6 right-6 md:bottom-8 md:right-8 z-30 pointer-events-none">
                  <span
                    className="font-display font-light text-sm tracking-widest"
                    style={{ color: "rgba(241,234,222,0.5)" }}
                  >
                    {activeIndex + 1} / {developments.length}
                  </span>
                </div>
              </div>

              {/* Navigation arrows — centered over main card */}
              {developments.length > 1 && (
                <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 z-30 flex justify-between px-4 md:-mx-8 pointer-events-none">
                  <button
                    onClick={prevProject}
                    className="pointer-events-auto h-14 w-14 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110"
                    style={{
                      background: "rgba(10,10,11,0.7)",
                      backdropFilter: "blur(16px)",
                      border: "1px solid rgba(241,234,222,0.12)",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.borderColor =
                        "rgba(241,234,222,0.35)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.borderColor =
                        "rgba(241,234,222,0.12)")
                    }
                    aria-label="Proyecto anterior"
                  >
                    <ArrowLeft className="h-5 w-5 text-[#F1EADE]" />
                  </button>
                  <button
                    onClick={nextProject}
                    className="pointer-events-auto h-14 w-14 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110"
                    style={{
                      background: "rgba(10,10,11,0.7)",
                      backdropFilter: "blur(16px)",
                      border: "1px solid rgba(241,234,222,0.12)",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.borderColor =
                        "rgba(241,234,222,0.35)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.borderColor =
                        "rgba(241,234,222,0.12)")
                    }
                    aria-label="Proyecto siguiente"
                  >
                    <ArrowRight className="h-5 w-5 text-[#F1EADE]" />
                  </button>
                </div>
              )}
            </motion.div>

            {/* CTA below main card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={hasEntered ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.8, duration: 0.8, ease: [0.19, 1, 0.22, 1] }}
              className="mt-6 text-center"
            >
              <Link
                href={`/desarrollos/${activeDev.slug}`}
                className="inline-flex items-center gap-3 px-6 py-3 rounded-full text-[11px] uppercase tracking-[0.2em] transition-all duration-300 hover:scale-[1.02]"
                style={{
                  background: "rgba(120,82,60,0.45)",
                  backdropFilter: "blur(16px)",
                  color: "#F1EADE",
                  border: "1px solid rgba(241,234,222,0.12)",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.borderColor = "rgba(241,234,222,0.35)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.borderColor = "rgba(241,234,222,0.12)")
                }
              >
                <span>Ver proyecto</span>
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </motion.div>
          </div>

          {/* Secondary card RIGHT — parallax */}
          {secondaryDevs[1] && (
            <motion.div
              style={{ y: parallaxY2 }}
              className="hidden lg:block col-span-3 col-start-10"
            >
              <SecondaryCard dev={secondaryDevs[1]} delay={0.5} hasEntered={hasEntered} />
            </motion.div>
          )}
        </div>

        {/* Bottom secondary cards row — mobile visible */}
        {secondaryDevs.length > 0 && (
          <div className="mt-16 md:mt-24">
            <motion.div
              style={{ y: parallaxY3 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4"
            >
              {secondaryDevs.slice(0, 4).map((dev, idx) => (
                <motion.div
                  key={dev.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={hasEntered ? { opacity: 1, y: 0 } : {}}
                  transition={{
                    delay: 0.6 + idx * 0.15,
                    duration: 0.9,
                    ease: [0.19, 1, 0.22, 1],
                  }}
                >
                  <SmallCard dev={dev} />
                </motion.div>
              ))}
            </motion.div>
          </div>
        )}

        {/* "Ver todos" link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={hasEntered ? { opacity: 1 } : {}}
          transition={{ delay: 1.2, duration: 0.8 }}
          className="text-center mt-16 md:mt-20"
        >
          <Link
            href="/desarrollos"
            className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] transition-colors duration-300 hover:text-[#B89474]"
            style={{ color: "rgba(241,234,222,0.5)" }}
          >
            <span>Ver todos los desarrollos</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}

// ═══════════════════════════════════════════════════
// SECONDARY CARD — Shown in the collage parallax
// ═══════════════════════════════════════════════════
function SecondaryCard({
  dev,
  delay,
  hasEntered,
}: {
  dev: Development;
  delay: number;
  hasEntered: boolean;
}) {
  const img =
    dev.images.find((i) => i.isPrimary)?.url || dev.images[0]?.url;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, clipPath: "inset(20% 0% 20% 0%)" }}
      animate={
        hasEntered
          ? { opacity: 1, y: 0, clipPath: "inset(0% 0% 0% 0%)" }
          : {}
      }
      transition={{
        delay,
        duration: 1.2,
        ease: [0.19, 1, 0.22, 1],
      }}
    >
      <Link
        href={`/desarrollos/${dev.slug}`}
        className="group block relative aspect-[3/4] overflow-hidden"
        style={{
          borderRadius: "14px",
          border: "1px solid rgba(241,234,222,0.12)",
        }}
      >
        {img && (
          <Image
            src={img}
            alt={dev.name}
            fill
            className="object-cover transition-transform duration-[2500ms] ease-out group-hover:scale-[1.06]"
            sizes="25vw"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0B]/80 via-[#0A0A0B]/20 to-transparent" />

        {/* Hover border glow */}
        <div
          className="absolute inset-0 rounded-[14px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{ boxShadow: "inset 0 0 0 1px rgba(241,234,222,0.35)" }}
        />

        <div className="absolute bottom-4 left-4 right-4">
          <p
            className="text-[9px] uppercase tracking-[0.2em] mb-1"
            style={{ color: "rgba(241,234,222,0.5)" }}
          >
            {dev.location}
          </p>
          <h4 className="font-display font-light text-base text-[#F1EADE] leading-tight group-hover:italic transition-all duration-500">
            {dev.name}
          </h4>
        </div>
      </Link>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════
// SMALL CARD — Bottom row thumbnails
// ═══════════════════════════════════════════════════
function SmallCard({ dev }: { dev: Development }) {
  const img =
    dev.images.find((i) => i.isPrimary)?.url || dev.images[0]?.url;
  const priceFrom = dev.minPriceAvailable ?? dev.priceFrom;

  return (
    <Link
      href={`/desarrollos/${dev.slug}`}
      className="group block relative aspect-square overflow-hidden"
      style={{
        borderRadius: "14px",
        border: "1px solid rgba(241,234,222,0.12)",
      }}
    >
      {img && (
        <Image
          src={img}
          alt={dev.name}
          fill
          className="object-cover transition-transform duration-[2000ms] ease-out group-hover:scale-[1.05]"
          sizes="(max-width: 768px) 50vw, 25vw"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0B]/85 via-[#0A0A0B]/30 to-transparent" />

      {/* Hover border */}
      <div
        className="absolute inset-0 rounded-[14px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ boxShadow: "inset 0 0 0 1px rgba(241,234,222,0.35)" }}
      />

      <div className="absolute bottom-3 left-3 right-3">
        <p
          className="text-[8px] uppercase tracking-[0.2em] mb-0.5"
          style={{ color: "rgba(241,234,222,0.5)" }}
        >
          {dev.location}
        </p>
        <h4 className="font-display font-light text-sm text-[#F1EADE] leading-tight truncate group-hover:italic transition-all duration-500">
          {dev.name}
        </h4>
        {priceFrom && (
          <p className="text-[10px] text-[#B89474] mt-1 font-display">
            {formatPrice(priceFrom)}
          </p>
        )}
      </div>
    </Link>
  );
}
