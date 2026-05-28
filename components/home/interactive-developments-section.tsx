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

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useSpring(useTransform(mouseY, [-300, 300], [2, -2]), { stiffness: 150, damping: 30 });
  const rotateY = useSpring(useTransform(mouseX, [-300, 300], [-2, 2]), { stiffness: 150, damping: 30 });

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end start"] });
  const parallaxY1     = useTransform(scrollYProgress, [0, 1], [80, -80]);
  const parallaxY2     = useTransform(scrollYProgress, [0, 1], [120, -120]);
  const parallaxY3     = useTransform(scrollYProgress, [0, 1], [60, -60]);
  const parallaxScale  = useTransform(scrollYProgress, [0, 0.3], [0.93, 1]);
  const parallaxOpacity = useTransform(scrollYProgress, [0, 0.18], [0, 1]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setHasEntered(true); },
      { threshold: 0.08 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const nextProject = useCallback(() => {
    setDirection(1);
    setActiveIndex((prev) => (prev + 1) % developments.length);
  }, [developments.length]);

  const prevProject = useCallback(() => {
    setDirection(-1);
    setActiveIndex((prev) => (prev === 0 ? developments.length - 1 : prev - 1));
  }, [developments.length]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") nextProject();
      if (e.key === "ArrowLeft") prevProject();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [nextProject, prevProject]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left - rect.width / 2);
    mouseY.set(e.clientY - rect.top - rect.height / 2);
  };
  const handleMouseLeave = () => { mouseX.set(0); mouseY.set(0); };

  if (developments.length === 0) {
    return (
      <section className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--oa-bg-cream)" }}>
        <p className="text-lg" style={{ color: "rgba(7,7,7,0.45)", fontFamily: "var(--font-sans)" }}>
          Pronto vamos a publicar nuestros desarrollos.
        </p>
      </section>
    );
  }

  const activeDev = developments[activeIndex];
  const primaryImage = activeDev.images.find((i) => i.isPrimary)?.url || activeDev.images[0]?.url;
  const priceFrom = activeDev.minPriceAvailable ?? activeDev.priceFrom;
  const secondaryDevs = developments.filter((_, i) => i !== activeIndex);

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 280 : -280, opacity: 0, scale: 0.92 }),
    center: { x: 0, opacity: 1, scale: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -280 : 280, opacity: 0, scale: 0.92 }),
  };
  const textVariants = {
    enter: (dir: number) => ({ y: dir > 0 ? 30 : -30, opacity: 0 }),
    center: { y: 0, opacity: 1 },
    exit: (dir: number) => ({ y: dir > 0 ? -30 : 30, opacity: 0 }),
  };

  return (
    <section
      ref={sectionRef}
      id="desarrollos"
      className="relative min-h-screen overflow-hidden"
      style={{
        background: "linear-gradient(180deg, rgba(184,157,135,0.1) 0%, var(--oa-bg-cream) 12%, #e8ddd0 88%, var(--oa-bg-cream) 100%)",
      }}
    >
      {/* Líneas diagonales */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-[20%] w-px h-full" style={{ background: "linear-gradient(180deg, transparent 0%, rgba(7,7,7,0.05) 35%, rgba(7,7,7,0.05) 65%, transparent 100%)", transform: "rotate(1.5deg)" }} />
        <div className="absolute top-0 right-[28%] w-px h-full" style={{ background: "linear-gradient(180deg, transparent 0%, rgba(7,7,7,0.03) 40%, rgba(7,7,7,0.03) 60%, transparent 100%)", transform: "rotate(-1deg)" }} />
      </div>

      {/* Grain */}
      <div aria-hidden className="absolute inset-0 pointer-events-none bg-grain opacity-40" />

      <motion.div style={{ scale: parallaxScale, opacity: parallaxOpacity }} className="relative z-10 container-custom py-24 md:py-32 lg:py-40">

        {/* ── HEADER ── */}
        <div className="mb-16 md:mb-24">
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={hasEntered ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1] }}
            className="label-tracking mb-5"
            style={{ color: "rgba(7,7,7,0.5)" }}
          >
            Desarrollos en curso
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 36 }}
            animate={hasEntered ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 1.2, delay: 0.12, ease: [0.19, 1, 0.22, 1] }}
            className="font-display font-light tracking-[-0.04em] leading-[0.93] max-w-3xl"
            style={{ fontSize: "clamp(2.2rem, 5vw, 5rem)", color: "var(--oa-black)" }}
          >
            Proyectos con{" "}
            <em className="not-italic" style={{ color: "var(--oa-brown)" }}>
              alta rentabilidad
            </em>{" "}
            en las mejores zonas.
          </motion.h2>
        </div>

        {/* ── GRID PRINCIPAL ── */}
        <div className="relative grid grid-cols-12 gap-4 md:gap-6 min-h-[70vh] items-center">

          {/* Secondary LEFT */}
          {secondaryDevs[0] && (
            <motion.div style={{ y: parallaxY1 }} className="hidden lg:block col-span-3 col-start-1">
              <SecondaryCard dev={secondaryDevs[0]} delay={0.3} hasEntered={hasEntered} />
            </motion.div>
          )}

          {/* MAIN CARD */}
          <div className="col-span-12 lg:col-span-6 lg:col-start-4 relative z-20">
            <motion.div
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              style={{ rotateX, rotateY, transformPerspective: 1200 }}
              className="relative"
            >
              <div className="relative aspect-[4/5] md:aspect-[3/4] overflow-hidden cursor-pointer" style={{ borderRadius: "18px" }}>
                <AnimatePresence initial={false} custom={direction} mode="wait">
                  <motion.div
                    key={activeIndex}
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.75, ease: [0.19, 1, 0.22, 1] }}
                    className="absolute inset-0"
                  >
                    <Link href={`/desarrollos/${activeDev.slug}`} className="block h-full group">
                      {primaryImage && (
                        <Image
                          src={primaryImage}
                          alt={activeDev.name}
                          fill
                          priority
                          className="object-cover transition-transform duration-[3000ms] ease-out group-hover:scale-[1.04]"
                          sizes="(max-width: 1024px) 100vw, 50vw"
                        />
                      )}

                      <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(58,29,23,0.88) 0%, rgba(58,29,23,0.3) 45%, transparent 100%)" }} />
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-colors duration-700" style={{ background: "rgba(58,29,23,0.1)" }} />

                      {/* Badge */}
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.6 }}
                        className="absolute top-5 left-5"
                      >
                        <span
                          className="px-4 py-1.5 text-[9px] uppercase tracking-[0.2em] font-medium rounded-full"
                          style={{ background: "rgba(239,230,216,0.88)", backdropFilter: "blur(16px)", color: "var(--oa-brown)", border: "1px solid rgba(58,29,23,0.15)", fontFamily: "var(--font-sans)" }}
                        >
                          {DEVELOPMENT_STATUS_LABELS[activeDev.status]}
                        </span>
                      </motion.div>

                      {/* Bottom content */}
                      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                        <AnimatePresence mode="wait" custom={direction}>
                          <motion.div
                            key={`text-${activeIndex}`}
                            custom={direction}
                            variants={textVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.55, ease: [0.19, 1, 0.22, 1] }}
                          >
                            <div className="flex items-center gap-2 mb-3" style={{ color: "rgba(248,245,239,0.7)" }}>
                              <MapPin className="h-3.5 w-3.5" />
                              <span className="text-[10px] uppercase tracking-[0.18em]" style={{ fontFamily: "var(--font-sans)" }}>{activeDev.location}</span>
                            </div>
                            <h3 className="font-display font-light tracking-[-0.03em] leading-[1.02] mb-4" style={{ fontSize: "clamp(1.8rem, 3.5vw, 3rem)", color: "var(--oa-white)" }}>
                              {activeDev.name}
                            </h3>
                            <div className="flex items-center gap-6 flex-wrap">
                              {priceFrom && (
                                <div>
                                  <p className="text-[8px] uppercase tracking-[0.2em] mb-0.5" style={{ color: "rgba(248,245,239,0.5)", fontFamily: "var(--font-sans)" }}>Desde</p>
                                  <span className="font-display text-lg" style={{ color: "var(--oa-bg-light)" }}>{formatPrice(priceFrom)}</span>
                                </div>
                              )}
                              {activeDev.completionDate && (
                                <div>
                                  <p className="text-[8px] uppercase tracking-[0.2em] mb-0.5" style={{ color: "rgba(248,245,239,0.5)", fontFamily: "var(--font-sans)" }}>Entrega</p>
                                  <span className="font-display text-lg" style={{ color: "var(--oa-white)" }}>{activeDev.completionDate}</span>
                                </div>
                              )}
                              {activeDev.progress > 0 && (
                                <div>
                                  <p className="text-[8px] uppercase tracking-[0.2em] mb-0.5" style={{ color: "rgba(248,245,239,0.5)", fontFamily: "var(--font-sans)" }}>Avance</p>
                                  <span className="font-display text-lg" style={{ color: "var(--oa-white)" }}>{activeDev.progress}%</span>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        </AnimatePresence>
                      </div>

                      {/* Arrow hover */}
                      <div className="absolute bottom-6 right-6 md:bottom-8 md:right-8">
                        <div className="h-11 w-11 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-500" style={{ background: "var(--oa-white)", border: "1px solid rgba(7,7,7,0.1)" }}>
                          <ArrowUpRight className="h-4 w-4" style={{ color: "var(--oa-black)" }} />
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                </AnimatePresence>

                {/* Counter */}
                <div className="absolute bottom-6 right-6 md:bottom-8 md:right-8 z-30 pointer-events-none">
                  <span className="font-display font-light text-sm tracking-widest" style={{ color: "rgba(248,245,239,0.5)" }}>
                    {activeIndex + 1} / {developments.length}
                  </span>
                </div>
              </div>

              {/* Nav arrows */}
              {developments.length > 1 && (
                <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 z-30 flex justify-between px-4 md:-mx-8 pointer-events-none">
                  {[{ fn: prevProject, Icon: ArrowLeft, label: "Anterior" }, { fn: nextProject, Icon: ArrowRight, label: "Siguiente" }].map(({ fn, Icon, label }) => (
                    <button
                      key={label}
                      onClick={fn}
                      className="pointer-events-auto rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110"
                      style={{ width: "52px", height: "52px", background: "rgba(248,245,239,0.75)", backdropFilter: "blur(16px)", border: "1px solid rgba(7,7,7,0.1)" }}
                      aria-label={label}
                    >
                      <Icon className="h-4 w-4" style={{ color: "var(--oa-black)" }} />
                    </button>
                  ))}
                </div>
              )}
            </motion.div>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={hasEntered ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.8, duration: 0.8, ease: [0.19, 1, 0.22, 1] }}
              className="mt-6 text-center"
            >
              <Link
                href={`/desarrollos/${activeDev.slug}`}
                className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full text-[10px] uppercase tracking-[0.18em] transition-all duration-300 hover:scale-[1.03]"
                style={{ background: "rgba(7,7,7,0.07)", color: "var(--oa-black)", border: "1px solid rgba(7,7,7,0.1)", fontFamily: "var(--font-sans)" }}
              >
                <span>Ver proyecto</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </motion.div>
          </div>

          {/* Secondary RIGHT */}
          {secondaryDevs[1] && (
            <motion.div style={{ y: parallaxY2 }} className="hidden lg:block col-span-3 col-start-10">
              <SecondaryCard dev={secondaryDevs[1]} delay={0.5} hasEntered={hasEntered} />
            </motion.div>
          )}
        </div>

        {/* ── BOTTOM THUMBNAILS ── */}
        {secondaryDevs.length > 0 && (
          <div className="mt-16 md:mt-24">
            <motion.div style={{ y: parallaxY3 }} className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {secondaryDevs.slice(0, 4).map((dev, idx) => (
                <motion.div
                  key={dev.id}
                  initial={{ opacity: 0, y: 24 }}
                  animate={hasEntered ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 0.55 + idx * 0.12, duration: 0.9, ease: [0.19, 1, 0.22, 1] }}
                >
                  <SmallCard dev={dev} />
                </motion.div>
              ))}
            </motion.div>
          </div>
        )}

        {/* Ver todos */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={hasEntered ? { opacity: 1 } : {}}
          transition={{ delay: 1.1, duration: 0.8 }}
          className="text-center mt-16 md:mt-20"
        >
          <Link
            href="/desarrollos"
            className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] transition-colors duration-300"
            style={{ color: "rgba(7,7,7,0.45)", fontFamily: "var(--font-sans)" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--oa-brown)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(7,7,7,0.45)")}
          >
            <span>Ver todos los desarrollos</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}

/* ── SECONDARY CARD ── */
function SecondaryCard({ dev, delay, hasEntered }: { dev: Development; delay: number; hasEntered: boolean }) {
  const img = dev.images.find((i) => i.isPrimary)?.url || dev.images[0]?.url;
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, clipPath: "inset(18% 0% 18% 0%)" }}
      animate={hasEntered ? { opacity: 1, y: 0, clipPath: "inset(0% 0% 0% 0%)" } : {}}
      transition={{ delay, duration: 1.1, ease: [0.19, 1, 0.22, 1] }}
    >
      <Link
        href={`/desarrollos/${dev.slug}`}
        className="group block relative aspect-[3/4] overflow-hidden"
        style={{ borderRadius: "14px", border: "1px solid rgba(7,7,7,0.08)" }}
      >
        {img && <Image src={img} alt={dev.name} fill className="object-cover transition-transform duration-[2500ms] ease-out group-hover:scale-[1.06]" sizes="25vw" />}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(58,29,23,0.85) 0%, rgba(58,29,23,0.2) 50%, transparent 100%)" }} />
        <div className="absolute inset-0 rounded-[14px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ boxShadow: "inset 0 0 0 1px rgba(7,7,7,0.2)" }} />
        <div className="absolute bottom-4 left-4 right-4">
          <p className="text-[8px] uppercase tracking-[0.18em] mb-1" style={{ color: "rgba(248,245,239,0.55)", fontFamily: "var(--font-sans)" }}>{dev.location}</p>
          <h4 className="font-display font-light text-base leading-tight group-hover:italic transition-all duration-500" style={{ color: "var(--oa-white)" }}>{dev.name}</h4>
        </div>
      </Link>
    </motion.div>
  );
}

/* ── SMALL CARD ── */
function SmallCard({ dev }: { dev: Development }) {
  const img = dev.images.find((i) => i.isPrimary)?.url || dev.images[0]?.url;
  const priceFrom = dev.minPriceAvailable ?? dev.priceFrom;
  return (
    <Link
      href={`/desarrollos/${dev.slug}`}
      className="group block relative aspect-square overflow-hidden"
      style={{ borderRadius: "12px", border: "1px solid rgba(7,7,7,0.08)" }}
    >
      {img && <Image src={img} alt={dev.name} fill className="object-cover transition-transform duration-[2000ms] ease-out group-hover:scale-[1.05]" sizes="(max-width: 768px) 50vw, 25vw" />}
      <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(58,29,23,0.85) 0%, rgba(58,29,23,0.3) 50%, transparent 100%)" }} />
      <div className="absolute inset-0 rounded-[12px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ boxShadow: "inset 0 0 0 1px rgba(7,7,7,0.2)" }} />
      <div className="absolute bottom-3 left-3 right-3">
        <p className="text-[8px] uppercase tracking-[0.18em] mb-0.5" style={{ color: "rgba(248,245,239,0.55)", fontFamily: "var(--font-sans)" }}>{dev.location}</p>
        <h4 className="font-display font-light text-sm leading-tight truncate group-hover:italic transition-all duration-500" style={{ color: "var(--oa-white)" }}>{dev.name}</h4>
        {priceFrom && <p className="text-[10px] mt-1 font-display" style={{ color: "var(--oa-bg-light)" }}>{formatPrice(priceFrom)}</p>}
      </div>
    </Link>
  );
}
