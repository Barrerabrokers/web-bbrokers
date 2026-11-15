"use client";

import { useState } from "react";
import { normalizePressUrl, readPressEntries, type PressEntry } from "@/lib/press-links";

export function PressLinksEditor({ value, onChange, disabled = false }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const entries = readPressEntries(value);
  const [loading, setLoading] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const update = (index: number, key: keyof PressEntry, value: string) => onChange(JSON.stringify(entries.map((entry, i) => i === index ? { ...entry, [key]: value } : entry)));
  const importPreview = async (index: number) => {
    setLoading(index); setNotice("");
    try {
      const response = await fetch("/api/press/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: entries[index].url }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo importar la nota.");
      onChange(JSON.stringify(entries.map((entry, i) => i === index ? { ...entry, title: data.title || entry.title, image: data.image || entry.image || "" } : entry)));
      setNotice(data.image ? "Vista previa importada. Revisá el título y la imagen antes de guardar." : "El portal no publicó una imagen. Podés agregar su enlace manualmente.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se pudo importar. Completá la nota manualmente."); }
    finally { setLoading(null); }
  };
  const reorder = (index: number, step: number) => {
    const next = [...entries];
    [next[index], next[index + step]] = [next[index + step], next[index]];
    onChange(JSON.stringify(next));
  };
  return <fieldset disabled={disabled || loading !== null} className="space-y-4">
    <p className="text-sm leading-relaxed text-ink/75">Estos enlaces externos se muestran en «En los medios», dentro del blog. Para crear artículos propios y elegir cuáles aparecen en el carrusel, entrá a Administración → Prensa.</p>
    {entries.length === 0 && <p className="text-sm text-ink/75">Todavía no hay notas cargadas. La sección se mostrará cuando agregues una.</p>}
    <p role="status" aria-live="polite" className="text-sm text-[#006b6b]">{loading !== null ? `Importando nota ${loading + 1}…` : notice}</p>
    {entries.map((entry, index) => {
      const href = normalizePressUrl(entry.url);
      return <div key={index} className="space-y-3 border-t border-ink/15 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-medium text-ink">Nota {index + 1}</p><div className="flex gap-1">
          <button type="button" disabled={index === 0} onClick={() => reorder(index, -1)} aria-label={`Subir nota ${index + 1}`} className="min-h-11 rounded-lg px-3 text-sm hover:bg-cream-200 disabled:opacity-40">↑</button>
          <button type="button" disabled={index === entries.length - 1} onClick={() => reorder(index, 1)} aria-label={`Bajar nota ${index + 1}`} className="min-h-11 rounded-lg px-3 text-sm hover:bg-cream-200 disabled:opacity-40">↓</button>
          <button type="button" onClick={() => onChange(JSON.stringify(entries.filter((_, i) => i !== index)))} aria-label={`Quitar nota ${index + 1}`} className="min-h-11 rounded-lg px-3 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50">Quitar</button>
        </div></div>
        <label className="block text-sm font-medium text-ink">Link de la nota<input required type="url" maxLength={2048} value={entry.url} onChange={event => update(index, "url", event.target.value)} placeholder="https://www.medio.com/nota" className="form-input mt-1 font-normal" /></label>
        <button type="button" disabled={!href || disabled || loading !== null} onClick={() => importPreview(index)} className="min-h-11 rounded-lg bg-ink px-4 text-sm font-medium text-white disabled:opacity-50">{loading === index ? "Importando…" : "Importar título e imagen"}</button>
        <label className="block text-sm font-medium text-ink">Título de la nota<input required maxLength={300} value={entry.title} onChange={event => update(index, "title", event.target.value)} placeholder="Título que se mostrará en Prensa" className="form-input mt-1 font-normal" /></label>
        <label className="block text-sm font-medium text-ink">Imagen de la noticia<input type="url" maxLength={2048} value={entry.image || ""} onChange={event => update(index, "image", event.target.value)} placeholder="https://www.medio.com/imagen.jpg" className="form-input mt-1 font-normal" /></label>
        <p className="text-xs text-ink/75">Si el portal bloquea la importación, pegá el enlace https de la imagen. Sin imagen se mostrará la portada de Prensa.</p>
        {entry.image && normalizePressUrl(entry.image)?.startsWith("https://") && <img key={entry.image} src={entry.image} alt={`Vista previa de ${entry.title || `nota ${index + 1}`}`} referrerPolicy="no-referrer" onError={event => { event.currentTarget.style.display = "none"; }} className="aspect-video w-full max-w-sm rounded-lg object-cover" />}
        {href && <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded text-sm font-medium text-[#006b6b] hover:underline focus-visible:outline focus-visible:outline-2">Abrir nota en una pestaña nueva ↗</a>}
      </div>;
    })}
    <button type="button" disabled={disabled || loading !== null} onClick={() => onChange(JSON.stringify([...entries, { title: "", url: "", image: "" }]))} className="min-h-11 rounded-lg border border-ink/20 px-4 text-sm font-medium text-ink hover:bg-cream-200 disabled:opacity-50">Agregar nota</button>
    <p className="text-xs text-ink/75">Guardá los cambios con el botón Guardar cambios al final de la página.</p>
  </fieldset>;
}
