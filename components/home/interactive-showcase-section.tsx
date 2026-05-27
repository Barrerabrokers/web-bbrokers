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

export interface ShowcaseItem {
  id: string;
  slug?: string;
  href: string;
  title: string;
  location: string;
  image?: string;
  status?: string;
  statusLabel?: string;
  priceFrom?: number;
  priceLabel?: string;
  completionDate?: string;
  progress?: number;
  availableUnits?: number;
  subtitle?: string;
  extraStats?: { label: string; value: string }[];
}

interface Props {
  items: ShowcaseItem[];
  sectionId: string;
  eyebrow: string;
  heading: React.ReactNode;
  description: string;
  ctaText: string;
  ctaHref: string;
  gradientColor?: string; // top gradient accent color
  theme?: "dark" | "light";
}

export function InteractiveShowcaseSection({
  items,
  sectionId,
  eyebrow,
  heading,
  description,
  ctaText,
  ctaHref,
  gradientColor = "rgba(120,82,60,0.08)",
  theme = "dark",
}: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [hasEntered, setHasEntered] = useState(false);

  // Mouse tilt
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

  // Scroll parallax
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  const parallaxY1 = useTransform(scrollYProgress, [0, 1], [80, -80]);
  const parallaxY2 = useTransform(scrollYProgress, [0, 1], [120, -120]);
  const parallaxY3 = useTransform(scrollYProgress, [0, 1], [60, -60]);
  const parallaxScale = useTransform(scrollYProgress, [0, 0.3], [0.92, 1]);
  const parallaxOpacity = useTransform(scrollYProgress, [0, 0.2], [0, 1]);

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

  const nextProject = useCallback(() => {
    setDirection(1);
    setActiveIndex((prev) => (prev + 1) % items.length);
  }, [items.length]);

  const prevProject = useCallback(() => {
    setDirection(-1);
    setActiveIndex((prev) => (prev === 0 ? items.length - 1 : prev - 1));
  }, [items.length]);

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

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  if (items.length === 0) {
    return (
      <section className="min-h-[60vh] bg-[#0A0A0B] flex items-center justify-center">
        <p className="text-[#F1EADE]/60 text-lg">
          Pronto vamos a publicar contenido en esta sección.
        </p>
      </section>
    );
  }

  const active = items[activeIndex];
  const secondaryItems = items.filter((_, i) => i !== activeIndex);

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0, scale: 0.9 }),
    center: { x: 0, opacity: 1, scale: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -300 : 300, opacity: 0, scale: 0.9 }),
  };

  const textVariants = {
    enter: (dir: number) => ({ y: dir > 0 ? 40 : -40, opacity: 0 }),
    center: { y: 0, opacity: 1 },
    exit: (dir: number) => ({ y: dir > 0 ? -40 : 40, opacity: 0 }),
  };

  const isDark = theme === "dark";
  const bg = isDark ? "#0A0A0B" : "#F1EADE";
  const textColor = isDark ? "#F1EADE" : "#151415";
  const textMuted = isDark ? "rgba(241,234,222,0.68)" : "rgba(21,20,21,0.6)";
  const borderColor = isDark ? "rgba(241,234,222,0.12)" : "rgba(21,20,21,0.12)";
  const borderHover = isDark ? "rgba(241,234,222,0.35)" : "rgba(21,20,21,0.35)";
  const glassColor = isDark ? "rgba(120,82,60,0.45)" : "rgba(120,82,60,0.2)";
  const overlayColor = isDark ? "#0A0A0B" : "#151415";

  return (
    <section
      ref={sectionRef}
      id={sectionId}
      className="relative min-h-screen overflow-hidden"
      style={{
        background: `linear-gradient(180deg, ${gradientColor} 0%, ${bg} 15%, ${isDark ? "#11100F" : "#E3D9C9"} 85%, ${bg} 100%)`,
      }}
    >
      {/* Decorative lines */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-[20%] w-px h-full opacity-[0.06]" style={{ background: `linear-gradient(180deg, transparent 0%, ${textColor} 30%, ${textColor} 70%, transparent 100%)`, transform: "rotate(2deg)" }} />
        <div className="absolute top-0 right-[30%] w-px h-full opacity-[0.04]" style={{ background: `linear-gradient(180deg, transparent 0%, ${textColor} 40%, ${textColor} 60%, transparent 100%)`, transform: "rotate(-1.5deg)" }} />
      </div>

      {/* Grain */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none opacity-[0.02]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")` }} />

      <motion.div style={{ scale: parallaxScale, opacity: parallaxOpacity }} className="relative z-10 container-custom py-24 md:py-32 lg:py-40">
        {/* Header */}
        <div className="mb-16 md:mb-24">
          <motion.p initial={{ opacity: 0, y: 20 }} animate={hasEntered ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1] }} className="text-[11px] uppercase tracking-[0.25em] mb-5" style={{ color: textMuted }}>{eyebrow}</motion.p>
          <motion.h2 initial={{ opacity: 0, y: 40 }} animate={hasEntered ? { opacity: 1, y: 0 } : {}} transition={{ duration: 1.2, delay: 0.15, ease: [0.19, 1, 0.22, 1] }} className="font-display font-light tracking-[-0.03em] leading-[1] max-w-3xl" style={{ fontSize: "clamp(2.2rem, 5vw, 4.5rem)", color: textColor }}>{heading}</motion.h2>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={hasEntered ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.8, delay: 0.3, ease: [0.19, 1, 0.22, 1] }} className="mt-5 max-w-md text-sm leading-relaxed" style={{ color: textMuted }}>{description}</motion.p>
        </div>

        {/* Main grid */}
        <div className="relative grid grid-cols-12 gap-4 md:gap-6 min-h-[60vh] items-center">
          {/* Left secondary */}
          {secondaryItems[0] && (
            <motion.div style={{ y: parallaxY1 }} className="hidden lg:block col-span-3 col-start-1">
              <SideCard item={secondaryItems[0]} delay={0.3} hasEntered={hasEntered} borderColor={borderColor} borderHover={borderHover} overlayColor={overlayColor} textColor={textColor} textMuted={textMuted} />
            </motion.div>
          )}

          {/* Center main card */}
          <div className="col-span-12 lg:col-span-6 lg:col-start-4 relative z-20">
            <motion.div onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} style={{ rotateX, rotateY, transformPerspective: 1200 }} className="relative">
              <div className="relative aspect-[4/5] md:aspect-[3/4] overflow-hidden cursor-pointer" style={{ borderRadius: "18px" }}>
                <AnimatePresence initial={false} custom={direction} mode="wait">
                  <motion.div key={activeIndex} custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1] }} className="absolute inset-0">
                    <Link href={active.href} className="block h-full group">
                      {active.image && (
                        <Image src={active.image} alt={active.title} fill priority className="object-cover transition-transform duration-[3000ms] ease-out group-hover:scale-[1.05]" sizes="(max-width: 1024px) 100vw, 50vw" />
                      )}
                      <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${overlayColor}ee 0%, ${overlayColor}55 40%, transparent 100%)` }} />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-700" />

                      {/* Status */}
                      {active.statusLabel && (
                        <div className="absolute top-5 left-5">
                          <span className="px-4 py-2 text-[10px] uppercase tracking-[0.2em] font-medium rounded-full" style={{ background: glassColor, backdropFilter: "blur(16px)", color: "#F1EADE", border: `1px solid ${borderColor}` }}>{active.statusLabel}</span>
                        </div>
                      )}

                      {/* Content */}
                      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                        <AnimatePresence mode="wait" custom={direction}>
                          <motion.div key={`text-${activeIndex}`} custom={direction} variants={textVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.6, ease: [0.19, 1, 0.22, 1] }}>
                            <div className="flex items-center gap-2 mb-3" style={{ color: textMuted }}>
                              <MapPin className="h-3.5 w-3.5" />
                              <span className="text-[11px] uppercase tracking-[0.2em]">{active.location}</span>
                            </div>
                            <h3 className="font-display font-light tracking-[-0.02em] leading-[1.05] mb-4" style={{ fontSize: "clamp(1.8rem, 4vw, 3.2rem)", color: "#F1EADE" }}>{active.title}</h3>
                            <div className="flex items-center gap-6 flex-wrap">
                              {active.priceLabel && (
                                <div>
                                  <p className="text-[9px] uppercase tracking-[0.2em] mb-0.5" style={{ color: "rgba(241,234,222,0.5)" }}>Desde</p>
                                  <span className="font-display text-lg text-[#B89474]">{active.priceLabel}</span>
                                </div>
                              )}
                              {active.completionDate && (
                                <div>
                                  <p className="text-[9px] uppercase tracking-[0.2em] mb-0.5" style={{ color: "rgba(241,234,222,0.5)" }}>Entrega</p>
                                  <span className="font-display text-lg text-[#F1EADE]">{active.completionDate}</span>
                                </div>
                              )}
                              {active.extraStats?.map((stat) => (
                                <div key={stat.label}>
                                  <p className="text-[9px] uppercase tracking-[0.2em] mb-0.5" style={{ color: "rgba(241,234,222,0.5)" }}>{stat.label}</p>
                                  <span className="font-display text-lg text-[#F1EADE]">{stat.value}</span>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        </AnimatePresence>
                      </div>

                      {/* Hover arrow */}
                      <div className="absolute bottom-6 right-6 md:bottom-8 md:right-8">
                        <div className="h-12 w-12 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-500" style={{ background: glassColor, backdropFilter: "blur(16px)", border: `1px solid ${borderColor}` }}>
                          <ArrowUpRight className="h-5 w-5 text-[#F1EADE]" />
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                </AnimatePresence>

                {/* Counter */}
                <div className="absolute bottom-6 right-6 md:bottom-8 md:right-8 z-30 pointer-events-none">
                  <span className="font-display font-light text-sm tracking-widest" style={{ color: "rgba(241,234,222,0.5)" }}>{activeIndex + 1} / {items.length}</span>
                </div>
              </div>

              {/* Arrows */}
              {items.length > 1 && (
                <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 z-30 flex justify-between px-4 md:-mx-8 pointer-events-none">
                  <button onClick={prevProject} className="pointer-events-auto h-14 w-14 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110" style={{ background: `rgba(10,10,11,0.7)`, backdropFilter: "blur(16px)", border: `1px solid ${borderColor}` }} aria-label="Anterior">
                    <ArrowLeft className="h-5 w-5 text-[#F1EADE]" />
                  </button>
                  <button onClick={nextProject} className="pointer-events-auto h-14 w-14 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110" style={{ background: `rgba(10,10,11,0.7)`, backdropFilter: "blur(16px)", border: `1px solid ${borderColor}` }} aria-label="Siguiente">
                    <ArrowRight className="h-5 w-5 text-[#F1EADE]" />
                  </button>
                </div>
              )}
            </motion.div>

            {/* CTA */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={hasEntered ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.8, duration: 0.8, ease: [0.19, 1, 0.22, 1] }} className="mt-6 text-center">
              <Link href={active.href} className="inline-flex items-center gap-3 px-6 py-3 rounded-full text-[11px] uppercase tracking-[0.2em] transition-all duration-300 hover:scale-[1.02]" style={{ background: glassColor, backdropFilter: "blur(16px)", color: "#F1EADE", border: `1px solid ${borderColor}` }}>
                <span>Ver detalle</span>
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </motion.div>
          </div>

          {/* Right secondary */}
          {secondaryItems[1] && (
            <motion.div style={{ y: parallaxY2 }} className="hidden lg:block col-span-3 col-start-10">
              <SideCard item={secondaryItems[1]} delay={0.5} hasEntered={hasEntered} borderColor={borderColor} borderHover={borderHover} overlayColor={overlayColor} textColor={textColor} textMuted={textMuted} />
            </motion.div>
          )}
        </div>

        {/* Bottom thumbnails */}
        {secondaryItems.length > 0 && (
          <motion.div style={{ y: parallaxY3 }} className="mt-16 md:mt-24 grid grid-cols-2 md:grid-cols-4 gap-4">
            {secondaryItems.slice(0, 4).map((item, idx) => (
              <motion.div key={item.id} initial={{ opacity: 0, y: 30 }} animate={hasEntered ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.6 + idx * 0.15, duration: 0.9, ease: [0.19, 1, 0.22, 1] }}>
                <Link href={item.href} className="group block relative aspect-square overflow-hidden" style={{ borderRadius: "14px", border: `1px solid ${borderColor}` }}>
                  {item.image && <Image src={item.image} alt={item.title} fill className="object-cover transition-transform duration-[2000ms] ease-out group-hover:scale-[1.05]" sizes="(max-width: 768px) 50vw, 25vw" />}
                  <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${overlayColor}dd 0%, ${overlayColor}44 50%, transparent 100%)` }} />
                  <div className="absolute inset-0 rounded-[14px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ boxShadow: `inset 0 0 0 1px ${borderHover}` }} />
                  <div className="absolute bottom-3 left-3 right-3">
                    <p className="text-[8px] uppercase tracking-[0.2em] mb-0.5" style={{ color: "rgba(241,234,222,0.5)" }}>{item.location}</p>
                    <h4 className="font-display font-light text-sm text-[#F1EADE] leading-tight truncate group-hover:italic transition-all duration-500">{item.title}</h4>
                    {item.priceLabel && <p className="text-[10px] text-[#B89474] mt-1 font-display">{item.priceLabel}</p>}
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Ver todos */}
        <motion.div initial={{ opacity: 0 }} animate={hasEntered ? { opacity: 1 } : {}} transition={{ delay: 1.2, duration: 0.8 }} className="text-center mt-16 md:mt-20">
          <Link href={ctaHref} className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] transition-colors duration-300 hover:text-[#B89474]" style={{ color: textMuted }}>
            <span>{ctaText}</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}

// Side card component
function SideCard({ item, delay, hasEntered, borderColor, borderHover, overlayColor, textColor, textMuted }: { item: ShowcaseItem; delay: number; hasEntered: boolean; borderColor: string; borderHover: string; overlayColor: string; textColor: string; textMuted: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 40, clipPath: "inset(20% 0% 20% 0%)" }} animate={hasEntered ? { opacity: 1, y: 0, clipPath: "inset(0% 0% 0% 0%)" } : {}} transition={{ delay, duration: 1.2, ease: [0.19, 1, 0.22, 1] }}>
      <Link href={item.href} className="group block relative aspect-[3/4] overflow-hidden" style={{ borderRadius: "14px", border: `1px solid ${borderColor}` }}>
        {item.image && <Image src={item.image} alt={item.title} fill className="object-cover transition-transform duration-[2500ms] ease-out group-hover:scale-[1.06]" sizes="25vw" />}
        <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${overlayColor}cc 0%, ${overlayColor}33 50%, transparent 100%)` }} />
        <div className="absolute inset-0 rounded-[14px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ boxShadow: `inset 0 0 0 1px ${borderHover}` }} />
        <div className="absolute bottom-4 left-4 right-4">
          <p className="text-[9px] uppercase tracking-[0.2em] mb-1" style={{ color: "rgba(241,234,222,0.5)" }}>{item.location}</p>
          <h4 className="font-display font-light text-base text-[#F1EADE] leading-tight group-hover:italic transition-all duration-500">{item.title}</h4>
        </div>
      </Link>
    </motion.div>
  );
}
