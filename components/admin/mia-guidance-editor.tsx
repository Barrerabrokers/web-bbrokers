'use client';
import { useEffect, useState } from 'react';
import type { MiaGuidance } from '@/lib/mia-guidance';

export function MiaGuidanceEditor() {
  const [report,setReport]=useState<{rows:{perfil:string;tipo_pregunta:string;generadas:number;enviadas:number;respondidas:number}[];objections:{tipo:string;cantidad:number}[];note:string}|null>(null);
  const [reportError,setReportError]=useState('');
  const [saved, setSaved] = useState<MiaGuidance | null>(null);
  const [instructions, setInstructions] = useState('');
  const [incorrect, setIncorrect] = useState(''), [corrected, setCorrected] = useState(''), [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/crm/whatsapp/guidance', { signal: controller.signal, cache: 'no-store' }).then(async response => {
      const data = await response.json(); if (!response.ok) throw Error(data.error);
      setSaved(data); setInstructions(data.instructions);
    }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'No se pudo cargar.'); });
    fetch('/api/crm/whatsapp/learnings',{signal:controller.signal,cache:'no-store'}).then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error);setReport(data);}).catch(e=>{if(!controller.signal.aborted)setReportError(e instanceof Error?e.message:'No se pudo cargar el resumen.');});
    return () => controller.abort();
  }, []);
  async function save(action: 'instructions' | 'correction') {
    if (!saved || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/crm/whatsapp/guidance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, revision: saved.revision, ...(action === 'instructions' ? { instructions } : { incorrect, corrected, instruction }) }) });
      const data = await response.json(); if (!response.ok) throw Error(data.error);
      setSaved(data);
      if (action === 'correction') { setIncorrect(''); setCorrected(''); setInstruction(''); }
      setNotice(action === 'instructions' ? 'Instrucciones guardadas para las próximas respuestas de MIA.' : 'Corrección guardada como referencia. No se envió ningún mensaje al cliente.');
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar.'); }
    finally { setBusy(false); }
  }
  const field = 'mt-2 w-full rounded-md border border-ink/20 bg-white p-3 text-sm text-ink outline-none focus:border-accent disabled:opacity-50';
  const button = 'min-h-11 rounded-md bg-accent px-4 text-sm font-semibold text-white disabled:opacity-50';
  return <div className="mt-5 space-y-5 border-t border-ink/15 pt-5">
    <p className="text-xs font-semibold text-ink/75">Configuración de respuestas · Administración</p>
    {!saved && !error && <p role="status" className="text-sm text-ink/75">Cargando instrucciones…</p>}
    <div>
      <label htmlFor="mia-instructions" className="block text-sm font-semibold text-ink">Instrucciones para MIA</label>
      <p id="mia-instructions-help" className="mt-2 max-w-prose text-sm text-ink/75">Estas instrucciones orientan el estilo y el proceso de atención de MIA. Los datos comerciales se verifican en las fuentes autorizadas; usá el simulador privado para revisar las respuestas antes de cambiar las reglas.</p>
      <textarea id="mia-instructions" aria-describedby="mia-instructions-help" rows={6} maxLength={6000} value={instructions} disabled={!saved || busy} onChange={e => setInstructions(e.target.value)} className={field} />
      <button type="button" disabled={!saved || busy || instructions.trim() === saved.instructions} onClick={() => void save('instructions')} className={'mt-3 ' + button}>Guardar instrucciones</button>
    </div>
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-ink">Corregir una respuesta incorrecta</h4>
      <p className="max-w-prose text-sm text-ink/75">Pegá lo que Mía respondió mal, escribí la respuesta correcta y explicá qué debe cambiar. La corrección orienta las próximas respuestas; no se reenvía automáticamente. Las correcciones aprobadas orientan las próximas respuestas. Las conversaciones aportan observaciones por perfil; no se convierten automáticamente en reglas ni comparten datos personales.</p>
      <label htmlFor="mia-incorrect" className="block text-sm font-medium text-ink">Respuesta incorrecta<textarea id="mia-incorrect" rows={3} maxLength={3000} value={incorrect} disabled={!saved || busy} onChange={e => setIncorrect(e.target.value)} className={field} /></label>
      <label htmlFor="mia-corrected" className="block text-sm font-medium text-ink">Respuesta correcta<textarea id="mia-corrected" rows={3} maxLength={3000} value={corrected} disabled={!saved || busy} onChange={e => setCorrected(e.target.value)} className={field} /></label>
      <label htmlFor="mia-correction-rule" className="block text-sm font-medium text-ink">Qué debe aprender de esta corrección<textarea id="mia-correction-rule" rows={3} maxLength={3000} value={instruction} disabled={!saved || busy} onChange={e => setInstruction(e.target.value)} className={field} /></label>
      <button type="button" disabled={!saved || busy || !incorrect.trim() || !corrected.trim()} onClick={() => void save('correction')} className={button}>Guardar corrección</button>
    </div>
    {!!saved?.corrections.length && <details><summary className="cursor-pointer text-sm font-semibold text-ink">Correcciones guardadas ({saved.corrections.length})</summary><ol className="mt-3 divide-y divide-ink/15">{[...saved.corrections].reverse().slice(0,10).map(c => <li key={c.id} className="py-3 text-sm text-ink"><p className="font-semibold">Respuesta aprobada</p><p className="mt-1 whitespace-pre-wrap">{c.corrected}</p>{c.instruction && <p className="mt-2 whitespace-pre-wrap text-ink/75">{c.instruction}</p>}</li>)}</ol></details>}
    <section aria-labelledby="mia-weekly-learning" className="space-y-3 border-t border-ink/15 pt-4">
      <h4 id="mia-weekly-learning" className="text-sm font-semibold text-ink">Aprendizaje · Últimos 7 días</h4>
      {reportError&&<p role="alert" className="text-sm text-red-700">{reportError}</p>}
      {!report&&!reportError&&<p role="status" className="text-sm">Cargando resumen…</p>}
      {report&&<>{!!report.objections?.length&&<p className="text-sm text-ink/75">Objeciones observadas: {report.objections.map(o=>o.tipo+' ('+o.cantidad+')').join(' · ')}.</p>}<p className="text-xs text-ink/75">{report.note}</p>{report.rows.length?<div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Respuestas observadas por perfil y tipo de pregunta</caption><thead><tr>{['Perfil','Pregunta','Generadas','Enviadas','Con respuesta'].map(h=><th key={h} scope="col" className="p-2">{h}</th>)}</tr></thead><tbody>{report.rows.map(r=><tr key={r.perfil+':'+r.tipo_pregunta} className="border-t border-ink/10"><td className="p-2">{r.perfil}</td><td className="p-2">{r.tipo_pregunta}</td><td className="p-2">{r.generadas}</td><td className="p-2">{r.enviadas}</td><td className="p-2">{r.respondidas}</td></tr>)}</tbody></table></div>:<p className="text-sm text-ink/75">Todavía no hay conversaciones registradas en este período.</p>}</>}
    </section>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="text-sm text-emerald-800">{notice}</p>}
  </div>;
}
