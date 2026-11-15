"use client";

import { motion } from "framer-motion";
import { circularOffset, positionStyles } from "@/lib/stage-carousel-layout";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Newspaper, Pause, Play } from "lucide-react";
import type { PressItem } from "@/lib/press-links";

export function PressCarousel({ items }: { items: PressItem[] }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [visible, setVisible] = useState(true);
  const count = items.length;
  const current = count ? active % count : 0;
  const running = count > 1 && !paused && !focused && !reducedMotion && visible;

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => setActive(index => (index + 1) % count), 5000);
    return () => window.clearTimeout(timer);
  }, [running, active, count]);

  const move = (step: number) => setActive(index => (index + step + count) % count);
  if (!count) return null;

  return <div role="region" aria-roledescription="carrusel" aria-label="Barrera Brokers en medios"
    onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false); }}
    onKeyDown={event => {
      if (event.target instanceof HTMLInputElement || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "ArrowRight") { event.preventDefault(); move(1); }
      if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); }
    }}>
    <div className="relative z-10 mt-12 h-[380px] md:mt-16 md:h-[500px]">
      {items.map((item, index) => {
        const offset = circularOffset(index, current, count);
        const shown = Math.abs(offset) <= 2;
        const isActive = offset === 0;
        const position = positionStyles[String(Math.max(-2, Math.min(2, offset))) as keyof typeof positionStyles];
        return <motion.article key={`${item.url}-${index}`} role="group" aria-roledescription="diapositiva" aria-label={`${index + 1} de ${count}`} aria-hidden={!shown}
          className="absolute top-0 overflow-hidden rounded-[10px] border border-[#f8f5ef]/20 bg-[#151415]"
          initial={false}
          animate={{ left: position.left, width: position.width, height: position.height, y: position.y, scale: position.scale, opacity: shown ? position.opacity : 0, rotate: position.rotate, x: "-50%", zIndex: position.zIndex }}
          transition={{ duration: reducedMotion ? 0 : 0.9, ease: [0.23, 1, 0.32, 1] }}
          style={{ pointerEvents: shown ? "auto" : "none" }}>
          <PressImage src={item.image} title={item.label} eager={index === 0} />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.02)_20%,rgba(0,0,0,0.2)_44%,rgba(0,0,0,0.94)_100%)]" />
          <div className={`absolute inset-x-0 bottom-0 ${isActive ? "p-5 md:p-7" : "p-4"}`}>
            <p className="mb-3 truncate text-[10px] uppercase tracking-[0.18em] text-[#f8f5ef]/80">{item.host}</p>
            <h3 title={item.label} className={`font-display font-light tracking-[-0.025em] text-[#f8f5ef] [overflow-wrap:anywhere] ${isActive ? "line-clamp-5 text-[clamp(1.45rem,2.6vw,2.2rem)] leading-[1.06]" : "line-clamp-2 text-xl leading-[1.1]"}`}>{item.label}</h3>
            <span className={isActive ? "mt-4 inline-flex min-h-8 items-center gap-2 text-xs text-[#f8f5ef]/90" : "sr-only"}>{item.url ? "Leer la nota" : "Enlace pendiente"}{item.url && <ArrowUpRight className="h-4 w-4" aria-hidden="true" />}</span>
          </div>
          {item.url && <a href={item.url} tabIndex={shown ? 0 : -1} aria-hidden={!shown} aria-label={`Leer la nota: ${item.label}`} target={item.url.startsWith("/") ? undefined : "_blank"} rel={item.url.startsWith("/") ? undefined : "noopener noreferrer"} className="absolute inset-0 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white" />}
        </motion.article>;
      })}
      {count > 1 && <div className="pointer-events-none absolute inset-x-0 top-1/2 z-40 mx-auto flex max-w-[1180px] -translate-y-1/2 justify-between px-5">
        <button type="button" onClick={() => move(-1)} aria-label="Noticia anterior" className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#f8f5ef]/40 bg-[#070707]/80 text-[#f8f5ef] transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 md:h-14 md:w-14"><ArrowLeft className="h-5 w-5" aria-hidden="true" /></button>
        <button type="button" onClick={() => move(1)} aria-label="Noticia siguiente" className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#f8f5ef]/40 bg-[#070707]/80 text-[#f8f5ef] transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 md:h-14 md:w-14"><ArrowRight className="h-5 w-5" aria-hidden="true" /></button>
      </div>}
    </div>
    {count > 1 && <div className="container-custom relative z-10 mt-8 flex items-center justify-between gap-5 border-t border-[#f8f5ef]/15 pt-7 text-[#f8f5ef]">
      <p aria-live={running ? "off" : "polite"} aria-atomic="true" className="font-display text-xl font-light tracking-widest text-[#f8f5ef]/75">{current + 1} / {count}</p>
      {!reducedMotion && <button type="button" onClick={() => setPaused(value => !value)} aria-label={paused ? "Activar avance automático" : "Pausar avance automático"} aria-pressed={paused} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#f8f5ef]/30 px-5 text-xs hover:bg-white/10 focus-visible:outline focus-visible:outline-2">{paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}{paused ? "Reanudar" : "Pausar"}</button>}
    </div>}
  </div>;
}

function PressImage({ src, title, eager }: { src?: string; title: string; eager: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return <div className="absolute inset-0 overflow-hidden bg-[#272525]">
    {src && !failed ? <img src={src} alt={title} loading={eager ? "eager" : "lazy"} referrerPolicy="no-referrer" onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-cover" /> : <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-[#f8f5ef]"><Newspaper aria-hidden="true" className="h-12 w-12 stroke-1" /><span className="text-xs uppercase tracking-[0.18em]">Barrera Brokers · Prensa</span></div>}
  </div>;
}
