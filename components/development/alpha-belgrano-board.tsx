"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, FileText, Mail, MessageCircle, Search, X, Maximize2, ExternalLink } from "lucide-react";
import { ALPHA_BROCHURE, alphaMoney, alphaPlan, alphaPlanNote, alphaShareText, type AlphaCatalog, type AlphaUnit } from "@/lib/alpha-belgrano-catalog";
import { SITE_URL } from "@/lib/seo";
import styles from "./alpha-belgrano-board.module.css";

export function AlphaBelgranoBoard({ catalog }: { catalog: AlphaCatalog }) {
  const available = useMemo(() => catalog.units.filter(u => u.status === "disponible"), [catalog.units]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("floor");
  const [active, setActive] = useState<AlphaUnit | null>(null);
  const [notice, setNotice] = useState("");
  const [copyFallback, setCopyFallback] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const fallback = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    function readUnit() {
      const number = new URL(window.location.href).searchParams.get("unidad");
      setActive(available.find(u => u.number === number) || null);
      if (number && !available.some(u => u.number === number)) setNotice("Esta unidad ya no figura como disponible. Podés consultar las otras opciones del desarrollo.");
    }
    readUnit();
    window.addEventListener("popstate", readUnit);
    return () => window.removeEventListener("popstate", readUnit);
  }, [available]);

  useEffect(() => {
    const element = dialog.current;
    if (active && element && !element.open) element.showModal();
    if (!active && element?.open) element.close();
    if (!active) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [active]);

  useEffect(() => { if (copyFallback) fallback.current?.select(); }, [copyFallback]);

  function select(unit: AlphaUnit | null) {
    setActive(unit); setCopyFallback(""); setNotice("");
    const url = new URL(window.location.href);
    if (unit) url.searchParams.set("unidad", unit.number);
    else url.searchParams.delete("unidad");
    window.history.replaceState(null, "", url);
  }

  function message(unit: AlphaUnit) { return alphaShareText(unit, catalog, SITE_URL); }
  async function copy(unit: AlphaUnit) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(message(unit));
      setNotice(`Ficha de la unidad ${unit.number} copiada. Ya podés pegarla en WhatsApp o en un mail.`);
    } catch {
      if (!active || active.number !== unit.number) select(unit);
      setCopyFallback(message(unit));
      setNotice("Seleccionamos el texto: copiá con Ctrl+C o ⌘C.");
    }
  }

  const filtered = available.filter(u => `${u.number} ${u.id} ${u.floor} ${u.typology} ${u.total}`.toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => sort === "price" ? a.price - b.price : sort === "area" ? a.total - b.total : a.floor - b.floor || a.number.localeCompare(b.number));

  function shareActions(unit: AlphaUnit) {
    return <div className={styles.actions}>
      <a className={styles.whatsapp} href={`https://wa.me/?text=${encodeURIComponent(message(unit))}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={18} aria-hidden="true" />WhatsApp</a>
      <a href={`mailto:?subject=${encodeURIComponent(`Alpha Place Belgrano · Unidad ${unit.number}`)}&body=${encodeURIComponent(message(unit))}`}><Mail size={18} aria-hidden="true" />Mail</a>
      <button type="button" onClick={() => copy(unit)} aria-label={`Copiar ficha de unidad ${unit.number}`}><Copy size={18} aria-hidden="true" />Copiar ficha</button>
    </div>;
  }

  return <section id="unidades" className={styles.board} aria-labelledby="alpha-board-title" data-no-translate="">
    <div className={styles.inner}>
      <header className={styles.heading}>
        <div><p className={styles.project}>Alpha Place Belgrano · Manuel Ugarte 1576</p><h2 id="alpha-board-title">Encontrá tu próxima unidad.</h2><p>Explorá las opciones disponibles y abrí su ficha para ver el plano y la financiación.</p></div>
        <a className={styles.brochure} href={ALPHA_BROCHURE} target="_blank" rel="noopener noreferrer"><FileText size={19} aria-hidden="true" />Ver brochure</a>
      </header>

      <div className={styles.summary}>
        <p><strong>{available.length}</strong> {catalog.live ? "unidades disponibles" : "unidades en la lista de referencia"}</p>
        {available.length > 0 && <p>Desde <strong>{alphaMoney(Math.min(...available.map(u => u.price)))}</strong></p>}
        <p>{catalog.list} · {catalog.date}<span>{catalog.live ? "Vinculado a la lista de precios" : "Disponibilidad a confirmar"}</span></p>
      </div>
      {!catalog.live && <p className={styles.warning} role="status">No pudimos consultar la lista en línea. Mostramos la lista de referencia indicada arriba; confirmá precio y disponibilidad antes de avanzar.</p>}

      <div className={styles.toolbar}>
        <label className={styles.search}><Search size={20} aria-hidden="true" /><span className={styles.srOnly}>Buscar unidad, piso o superficie</span><input type="search" placeholder="Buscar unidad, piso o superficie" value={search} onChange={e => setSearch(e.target.value)} /></label>
        <label className={styles.sort}>Ordenar por<select value={sort} onChange={e => setSort(e.target.value)}><option value="floor">Piso</option><option value="price">Menor precio</option><option value="area">Menor superficie</option></select></label>
      </div>
      <p className={styles.resultCount} aria-live="polite">{filtered.length} de {available.length} unidades</p>
      <p className={styles.notice} role="status">{!active && notice}</p>

      <div className={styles.grid}>
        {filtered.map(unit => <article key={unit.id} className={styles.card}>
          <button type="button" className={styles.cardPreview} onClick={() => select(unit)} aria-label={`Ver ficha de unidad ${unit.number}`}>
            <span className={styles.badge}>{catalog.live ? "Disponible" : "A confirmar"}</span>
            {alphaPlan(unit) ? <img src={alphaPlan(unit)} alt={`Plano ${unit.plan} de la unidad ${unit.number}`} loading="lazy" width={720} height={720} /> : <span className={styles.noPlan}>Plano a confirmar</span>}
            <span className={styles.previewHint}><Maximize2 size={16} aria-hidden="true" /> Ver ficha y plano</span>
          </button>
          <div className={styles.cardBody}>
            <div className={styles.unitTitle}><h3><button type="button" onClick={() => select(unit)}>Unidad {unit.number}</button></h3><span>Piso {unit.floor}°</span></div>
            <p className={styles.unitMeta}>{unit.typology} · {unit.orientation} · Plano #{unit.plan}</p>
            <dl className={styles.areas}><div><dt>Total propio</dt><dd>{unit.total} m²</dd></div><div><dt>Cubiertos</dt><dd>{unit.covered} m²</dd></div><div><dt>Balcón</dt><dd>{unit.balcony} m²</dd></div></dl>
            <p className={styles.price}>{alphaMoney(unit.price)}<span>Precio de lista</span></p>
            <p className={styles.payment}>{unit.downPayment > 0 && <>Anticipo <strong>{alphaMoney(unit.downPayment)}</strong></>}{unit.installment > 0 && <span>24 cuotas de <strong>{alphaMoney(unit.installment)}</strong></span>}</p>
            {shareActions(unit)}
          </div>
        </article>)}
      </div>
      {filtered.length === 0 && <div className={styles.empty}><h3>{available.length ? "No hay unidades con esa búsqueda." : "No hay unidades disponibles en esta lista."}</h3><p>{available.length ? "Probá con otro piso, superficie o número de unidad." : "Consultanos para conocer próximas oportunidades."}</p>{search && <button type="button" onClick={() => setSearch("")}>Limpiar búsqueda</button>}</div>}
      <p className={styles.legal}>Precios expresados en dólares estadounidenses. Precio, disponibilidad y condiciones sujetos a confirmación con el desarrollador. Las superficies son las informadas en la lista de precios.</p>
    </div>

    <dialog ref={dialog} className={styles.dialog} aria-labelledby="alpha-unit-title" onCancel={e => { e.preventDefault(); select(null); }} onClick={e => { if (e.target === dialog.current) select(null); }}>
      {active && <>
        <header className={styles.dialogHeader}><div><p>Ficha de unidad · Alpha Place Belgrano</p><h2 id="alpha-unit-title">Unidad {active.number} <span>{catalog.live ? "Disponible" : "A confirmar"}</span></h2></div><button type="button" onClick={() => select(null)} aria-label="Cerrar ficha" autoFocus><X size={24} /></button></header>
        <div className={styles.dialogBody}>
          <dl className={styles.specs}><div><dt>Piso</dt><dd>{active.floor}°</dd></div><div><dt>Tipología</dt><dd>{active.typology}</dd></div><div><dt>Orientación</dt><dd>{active.orientation}</dd></div><div><dt>Plano asociado</dt><dd>#{active.plan}</dd></div></dl>
          <h3>Superficies de la unidad</h3>
          <dl className={styles.detailAreas}><div><dt>Propia total</dt><dd>{active.total} m²</dd></div><div><dt>Superficie cubierta</dt><dd>{active.covered} m²</dd></div><div><dt>Balcón / terraza</dt><dd>{active.balcony} m²</dd></div></dl>
          <h3>Precio y financiación</h3>
          <div className={styles.financing}><div className={styles.totalPrice}><span>Precio total de lista<small>{catalog.list} · {catalog.date}</small></span><strong>{alphaMoney(active.price)}</strong></div><dl><div><dt>Anticipo</dt><dd>{active.downPayment > 0 ? alphaMoney(active.downPayment) : "Consultar"}</dd></div><div><dt>Plan de 24 cuotas</dt><dd>{active.installment > 0 ? `${alphaMoney(active.installment)} / mes` : "Consultar"}</dd></div></dl></div>
          <div className={styles.planHeading}><h3>Plano de la unidad</h3>{alphaPlan(active) && <a href={alphaPlan(active)} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} aria-hidden="true" />Ampliar plano</a>}</div>
          {alphaPlanNote(active) && <p className={styles.warning}>{alphaPlanNote(active)}</p>}
          {alphaPlan(active) ? <img className={styles.detailPlan} src={alphaPlan(active)} alt={`Plano #${active.plan} correspondiente a unidad ${active.number}`} width={1000} height={1000} /> : <p>El plano de esta unidad está pendiente de confirmación. Consultá el brochure o a tu asesor.</p>}
          <p className={styles.planCaption}>Plano genérico de la tipología #{active.plan}. Las superficies de esta ficha corresponden a la unidad {active.number} de la lista de precios.</p>
          <a className={styles.brochure} href={ALPHA_BROCHURE} target="_blank" rel="noopener noreferrer"><FileText size={18} aria-hidden="true" />Ver brochure del desarrollo</a>
          <p className={styles.legal}>Manuel Ugarte 1576 · Belgrano, CABA. Precios y disponibilidad sujetos a confirmación. Los botones preparan el mensaje para que elijas el destinatario y lo envíes.</p>
          <p className={styles.notice} role="status">{notice}</p>
          {copyFallback && <label className={styles.fallback}>Texto de la ficha<textarea ref={fallback} value={copyFallback} readOnly rows={10} onFocus={e => e.target.select()} /></label>}
        </div>
        <footer className={styles.dialogFooter}><span>Compartir esta unidad</span>{shareActions(active)}</footer>
      </>}
    </dialog>
  </section>;
}
