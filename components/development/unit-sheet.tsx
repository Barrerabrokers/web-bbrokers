"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { X, MessageCircle, Mail, FileText } from "lucide-react";
import type { Unit } from "@/types";
import { formatPrice } from "@/lib/utils";
import { isAccessoryUnit, accessoryUnitLabel } from "@/lib/unit-kind";
import { ViewportVideo } from "@/components/viewport-video";
import styles from "./unit-sheet.module.css";

interface Props {
  unit: Unit; developmentName: string; developmentLocation?: string; canSeePrices: boolean;
  features: string[]; imageIndex: number; onImageChange: (index: number) => void;
  comments: string; onCommentsChange: (value: string) => void;
  pdfHref: string; whatsAppHref: string; mailHref: string; onClose: () => void;
}

export function UnitSheet(p: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef(p.onClose); close.current = p.onClose;
  const [section, setSection] = useState("resumen");
  const [failedImage, setFailedImage] = useState<string>();
  const { unit } = p;
  const parking = isAccessoryUnit(unit);
  const image = unit.images[p.imageIndex] || unit.images[0];
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);
  const payment = Boolean(unit.downPayment || unit.installmentCount || unit.installmentValue);
  const facts = [
    p.canSeePrices ? ["Precio final", formatPrice(unit.price)] : null,
    unit.area > 0 ? ["Cubiertos", `${unit.area} m²`] : null,
    unit.balconyArea ? ["Balcón", `${unit.balconyArea} m²`] : null,
    unit.totalArea ? ["Totales", `${unit.totalArea} m²`] : null,
    unit.expenses ? ["Expensas", `$${unit.expenses.toLocaleString("es-AR")}`] : null,
  ].filter((fact): fact is string[] => Boolean(fact));
  return createPortal(
    <dialog ref={dialog} className={styles.sheet} aria-labelledby="unit-sheet-title"
      data-native-scroll data-lenis-prevent
      onCancel={(event) => { event.preventDefault(); close.current(); }}
      onClick={(event) => { if (event.target === event.currentTarget) close.current(); }}>
      <div className={styles.frame}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>{p.developmentName}</p>
            <h2 id="unit-sheet-title">{parking ? unit.unitNumber : `Unidad ${unit.unitNumber}`}</h2>
            <p className={styles.subtitle}>
              {parking ? accessoryUnitLabel(unit) : `${unit.bedrooms || 1} ambiente${unit.bedrooms > 1 ? "s" : ""} · ${unit.bathrooms} baño${unit.bathrooms > 1 ? "s" : ""}`}
              {unit.floor ? ` · Piso ${unit.floor}` : ""}{unit.orientation ? ` · ${unit.orientation}` : ""}
            </p>
          </div>
          <button type="button" className={styles.close} onClick={p.onClose} aria-label="Cerrar ficha"><X size={22}/></button>
        </header>
        <div className={styles.body}>
          <section className={styles.media} aria-label="Plano e imágenes de la unidad">
            <div className={styles.image}>
              {p.imageIndex === -1 && unit.videoUrl ? <ViewportVideo src={unit.videoUrl} controls playsInline preload="none" className="h-full w-full object-contain" />
                : image && failedImage !== image.url ? <Image src={image.url} alt={`${unit.unitNumber} — ${image.type === "plano" ? "plano" : "imagen"}`} fill sizes="(max-width: 700px) 90vw, 60vw" className="object-contain" onError={() => setFailedImage(image.url)} />
                : <p className={styles.empty}>Imagen no disponible. Podés consultar la ficha PDF.</p>}
            </div>
            <div className={styles.imageTabs} aria-label="Elegir imagen">
              {unit.images.map((item, index) => <button type="button" key={item.id || index} aria-pressed={p.imageIndex === index} onClick={() => p.onImageChange(index)}>{item.type === "plano" ? "Plano" : "Imagen"} {unit.images.length > 1 ? index + 1 : ""}</button>)}
              {unit.videoUrl && <button type="button" aria-pressed={p.imageIndex === -1} onClick={() => p.onImageChange(-1)}>Video</button>}
            </div>
          </section>
          <section className={styles.info} aria-label="Información de la unidad">
            <div className={styles.tabs} aria-label="Secciones de la ficha">
              {[['resumen','Resumen'],['detalles','Detalles'],['notas','Comentarios']].map(([key,label]) => <button key={key} type="button" aria-pressed={section === key} onClick={() => setSection(key)}>{label}</button>)}
            </div>
            <div className={styles.content} data-native-scroll data-lenis-prevent>
              {section === 'resumen' && <>
                {payment && <div className={styles.payment}>
                  {unit.downPayment ? <div><span>Anticipo</span><strong>{formatPrice(unit.downPayment)}</strong></div> : null}
                  {unit.installmentValue ? <div><span>{unit.installmentCount || ""} cuotas de</span><strong>{formatPrice(unit.installmentValue)}</strong></div> : null}
                </div>}
                <dl className={styles.facts}>{facts.map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
                {unit.description?.includes('se pesifican') && unit.description?.includes('CAC') && <p className={styles.note}>Cuotas de referencia en USD, pesificadas al reservar y ajustadas por CAC. Condiciones completas en Detalles.</p>}
                <p className={styles.location}>{p.developmentLocation}</p>
                <p className={styles.status}>{unit.status === 'disponible' ? 'Disponible' : unit.status === 'reservada' ? 'Reservada' : 'Vendida'}</p>
              </>}
              {section === 'detalles' && <><p className={styles.description}>{unit.description || 'Consultá las condiciones con un agente comercial.'}</p>{p.features.length > 0 && <ul className={styles.features}>{p.features.map(f => <li key={f}>{f}</li>)}</ul>}</>}
              {section === 'notas' && <><label htmlFor="unit-share-comments">Comentarios para el cliente</label><textarea id="unit-share-comments" value={p.comments} onChange={e => p.onCommentsChange(e.target.value)} maxLength={900} rows={4} placeholder="Agregá una observación a la ficha…"/><p className={styles.note}>Se incluyen en el mensaje y en el PDF compartido.</p></>}
            </div>
          </section>
        </div>
        <footer className={styles.actions}>
          <a href={p.whatsAppHref} target="_blank" rel="noopener noreferrer" className={styles.whatsapp}><MessageCircle size={18}/><span>WhatsApp</span></a>
          <a href={p.mailHref}><Mail size={18}/><span>Email</span></a>
          <a href={p.pdfHref} target="_blank" rel="noopener noreferrer"><FileText size={18}/><span>Ficha PDF</span></a>
        </footer>
      </div>
    </dialog>, document.body
  );
}
