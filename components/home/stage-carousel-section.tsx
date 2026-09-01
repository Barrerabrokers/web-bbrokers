"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, ArrowUpRight, MapPin } from "lucide-react";
import { DevelopmentCoverMedia } from "@/components/development/development-cover-media";

export interface StageCarouselItem {
  id: string;
  href: string;
  title: string;
  location: string;
  image?: string;
  video?: string;
  statusLabel?: string;
  priceLabel?: string;
  completionDate?: string;
  extraStats?: { label: string; value: string }[];
}

interface StageCarouselSectionProps {
  items: StageCarouselItem[];
  sectionId: string;
  eyebrow: string;
  heading: React.ReactNode;
  description: string;
  ctaText: string;
  ctaHref: string;
}

function circularOffset(index: number, activeIndex: number, total: number) {
  const raw = index - activeIndex;
  const half = total / 2;
  if (raw > half) return raw - total;
  if (raw < -half) return raw + total;
  return raw;
}

const positionStyles = {
  "-2": {
    left: "4%",
    width: "min(20vw, 190px)",
    height: "clamp(150px, 22vw, 220px)",
    y: 50,
    scale: 0.72,
    opacity: 0.22,
    rotate: -8,
    zIndex: 5,
  },
  "-1": {
    left: "14%",
    width: "min(34vw, 260px)",
    height: "clamp(210px, 32vw, 325px)",
    y: 28,
    scale: 0.84,
    opacity: 0.66,
    rotate: -4,
    zIndex: 15,
  },
  "0": {
    left: "50%",
    width: "min(82vw, 500px)",
    height: "clamp(310px, 42vw, 420px)",
    y: 0,
    scale: 1,
    opacity: 1,
    rotate: 0,
    zIndex: 30,
  },
  "1": {
    left: "66%",
    width: "min(34vw, 260px)",
    height: "clamp(210px, 32vw, 325px)",
    y: 32,
    scale: 0.84,
    opacity: 0.66,
    rotate: 4,
    zIndex: 15,
  },
  "2": {
    left: "82%",
    width: "min(20vw, 190px)",
    height: "clamp(150px, 22vw, 220px)",
    y: 56,
    scale: 0.72,
    opacity: 0.22,
    rotate: 8,
    zIndex: 5,
  },
} as const;

export function StageCarouselSection({
  items,
  sectionId,
  eyebrow,
  heading,
  description,
  ctaText,
  ctaHref,
}: StageCarouselSectionProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const active = items[activeIndex];

  const next = useCallback(() => {
    setDirection(1);
    setActiveIndex((current) => (current + 1) % items.length);
  }, [items.length]);

  const previous = useCallback(() => {
    setDirection(-1);
    setActiveIndex((current) => (current === 0 ? items.length - 1 : current - 1));
  }, [items.length]);

  useEffect(() => {
    if (items.length < 2) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") next();
      if (event.key === "ArrowLeft") previous();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [items.length, next, previous]);

  const visibleItems = useMemo(
    () =>
      items
        .map((item, index) => ({
          item,
          index,
          offset: circularOffset(index, activeIndex, items.length),
        }))
        .filter(({ offset }) => Math.abs(offset) <= 2),
    [activeIndex, items]
  );

  if (items.length === 0) {
    return (
      <section className="flex min-h-[60vh] items-center justify-center bg-[#070707] text-[#f8f5ef]">
        <p className="text-lg text-[#f8f5ef]/60">
          Pronto vamos a publicar contenido en esta sección.
        </p>
      </section>
    );
  }

  return (
    <section
      id={sectionId}
      className="relative overflow-hidden bg-[#070707] py-20 text-[#f8f5ef] md:py-28 lg:py-36"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_18%,rgba(216,196,175,0.16),transparent_28%),linear-gradient(180deg,#151415_0%,#070707_62%,#151415_100%)]" />
      <div className="absolute inset-x-0 top-1/2 h-px bg-[#f8f5ef]/12" />
      <div className="absolute left-1/2 top-0 h-full w-px bg-[#f8f5ef]/8" />

      <div className="container-custom relative z-10">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
          <div>
            <p className="mb-5 text-[11px] uppercase tracking-[0.28em] text-[#d8c4af]/70">
              {eyebrow}
            </p>
            <h2 className="max-w-3xl font-display text-[clamp(2.8rem,6.5vw,6rem)] font-light leading-[0.92] tracking-[-0.04em] text-[#f8f5ef]">
              {heading}
            </h2>
          </div>
          <div className="max-w-xl lg:justify-self-end">
            <p className="text-base leading-relaxed text-[#f8f5ef]/64 md:text-lg">
              {description}
            </p>
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-12 h-[380px] overflow-visible md:mt-16 md:h-[500px]">
        <div className="absolute inset-x-0 top-0 h-full">
          {visibleItems.map(({ item, index, offset }) => {
            const style = positionStyles[String(offset) as keyof typeof positionStyles];
            const isActive = offset === 0;

            return (
              <motion.article
                key={item.id}
                className="absolute top-0 overflow-hidden rounded-[10px] border border-[#f8f5ef]/16 bg-[#151415] shadow-[0_28px_90px_rgba(0,0,0,0.46)]"
                initial={false}
                animate={{
                  left: style.left,
                  width: style.width,
                  height: style.height,
                  y: style.y,
                  scale: style.scale,
                  opacity: style.opacity,
                  rotate: style.rotate,
                  x: "-50%",
                  zIndex: style.zIndex,
                  filter: isActive ? "blur(0px)" : "blur(0.2px)",
                }}
                transition={{
                  duration: 0.9,
                  ease: [0.23, 1, 0.32, 1],
                }}
              >
                <Link
                  href={item.href}
                  className="group block h-full"
                  tabIndex={isActive ? 0 : -1}
                  aria-hidden={!isActive}
                >
                  {(item.image || item.video) && (
                    <DevelopmentCoverMedia
                      name={item.title}
                      image={item.image}
                      video={item.video}
                      priority={isActive}
                      className="object-cover transition-transform duration-[2200ms] ease-out group-hover:scale-[1.045]"
                      sizes={isActive ? "(max-width: 1024px) 90vw, 58vw" : "32vw"}
                    />
                  )}
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.08)_0%,rgba(0,0,0,0.18)_46%,rgba(0,0,0,0.76)_100%)]" />
                  <div className="absolute inset-0 opacity-0 transition-opacity duration-700 group-hover:opacity-100 bg-[#000]/12" />

                  {item.statusLabel && (
                    <span className="absolute left-5 top-5 rounded-full bg-[#f8f5ef]/12 px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-[#f8f5ef] backdrop-blur-md">
                      {item.statusLabel}
                    </span>
                  )}

                  <div className="absolute bottom-0 left-0 right-0 p-4 md:p-5">
                    <AnimatePresence mode="wait" custom={direction}>
                      {isActive && (
                        <motion.div
                          key={`${active.id}-content`}
                          initial={{ y: direction > 0 ? 28 : -28, opacity: 0, clipPath: "inset(0 0 100% 0)" }}
                          animate={{ y: 0, opacity: 1, clipPath: "inset(0 0 0% 0)" }}
                          exit={{ y: direction > 0 ? -20 : 20, opacity: 0 }}
                          transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
                        >
                          <div className="mb-3 flex items-center gap-2 text-[#f8f5ef]/62">
                            <MapPin className="h-3.5 w-3.5" />
                            <span className="text-[10px] uppercase tracking-[0.22em]">
                              {item.location}
                            </span>
                          </div>
                          <h3 className="max-w-md font-display text-[clamp(1.85rem,3.4vw,3.2rem)] font-light leading-[0.96] tracking-[-0.035em] text-[#f8f5ef]">
                            {item.title}
                          </h3>
                          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
                            {item.priceLabel && (
                              <DataPoint label="Desde" value={item.priceLabel} />
                            )}
                            {item.completionDate && (
                              <DataPoint label="Entrega" value={item.completionDate} />
                            )}
                            {item.extraStats?.slice(0, 2).map((stat) => (
                              <DataPoint key={stat.label} label={stat.label} value={stat.value} />
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {!isActive && (
                      <div>
                        <p className="text-[9px] uppercase tracking-[0.22em] text-[#f8f5ef]/45">
                          {item.location}
                        </p>
                        <h3 className="mt-2 truncate font-display text-2xl font-light tracking-[-0.03em] text-[#f8f5ef]/88">
                          {item.title}
                        </h3>
                      </div>
                    )}
                  </div>
                </Link>

                {!isActive && (
                  <button
                    type="button"
                    onClick={() => {
                      setDirection(index > activeIndex ? 1 : -1);
                      setActiveIndex(index);
                    }}
                    className="absolute inset-0 z-20"
                    aria-label={`Ver ${item.title}`}
                  />
                )}
              </motion.article>
            );
          })}
        </div>

        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-40 mx-auto flex max-w-[1180px] -translate-y-1/2 justify-between px-5">
          <button
            type="button"
            onClick={previous}
            className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#f8f5ef]/28 bg-[#070707]/70 text-[#f8f5ef] backdrop-blur-md transition-transform duration-300 hover:scale-105 active:scale-95 md:h-14 md:w-14"
            aria-label="Anterior"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={next}
            className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#f8f5ef]/28 bg-[#070707]/70 text-[#f8f5ef] backdrop-blur-md transition-transform duration-300 hover:scale-105 active:scale-95 md:h-14 md:w-14"
            aria-label="Siguiente"
          >
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="container-custom relative z-10 mt-8 flex flex-wrap items-center justify-between gap-5 border-t border-[#f8f5ef]/12 pt-7">
        <div className="font-display text-xl font-light tracking-widest text-[#f8f5ef]/62">
          {activeIndex + 1} / {items.length}
        </div>
        <Link
          href={ctaHref}
          className="inline-flex items-center gap-2 rounded-full border border-[#f8f5ef]/22 px-5 py-3 text-[11px] uppercase tracking-[0.2em] text-[#f8f5ef]/76 transition-colors hover:border-[#d8c4af]/60 hover:text-[#f8f5ef]"
        >
          {ctaText}
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

function DataPoint({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-[9px] uppercase tracking-[0.22em] text-[#f8f5ef]/45">
        {label}
      </p>
      <p className="font-display text-xl font-light text-[#d8c4af]">
        {value}
      </p>
    </div>
  );
}
