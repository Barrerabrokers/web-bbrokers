'use client';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import type { AiTrainingExample } from '@/lib/crm-ai-training-prompt';
const control = 'mt-1 w-full rounded-md border border-ink/25 bg-white p-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-[#006b6b]';
const button = 'min-h-11 rounded-md bg-[#006b6b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#005858] focus-visible:outline focus-visible:outline-2 disabled:opacity-50';
export function AiTrainingForm({example, question = '', onSaved}: {example?: AiTrainingExample; question?: string; onSaved?: () => void}) {
  const [q, setQ] = useState(example?.question || question);
  const [answer, setAnswer] = useState(example?.answer || '');
  const [context, setContext] = useState(example?.context || '');
  const [expires, setExpires] = useState(example?.expiresAt?.slice(0,10) || '');
  const [enabled, setEnabled] = useState(example?.enabled ?? true);
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState(''); const [error, setError] = useState('');
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/crm/ai-training', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:example?.id,question:q,answer,context,enabled,expiresAt:expires ? `${expires}T23:59:59.000Z` : null})});
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'No se pudo guardar.');
      setNotice('Ejemplo guardado. La IA lo podrá usar en sus próximas respuestas.');
      if (!example) {setQ('');setAnswer('');setContext('');setExpires('');}
      onSaved?.();
    } catch(cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar.'); } finally {setBusy(false);}
  }
  return <form onSubmit={save} className="space-y-4">
    <label className="block text-sm font-medium text-ink">Pregunta del cliente<textarea required maxLength={1500} rows={2} value={q} onChange={e=>setQ(e.target.value)} className={control}/></label>
    <label className="block text-sm font-medium text-ink">Respuesta correcta<textarea required maxLength={3000} rows={4} value={answer} onChange={e=>setAnswer(e.target.value)} className={control}/></label>
    <label className="block text-sm font-medium text-ink">Desarrollo o contexto<textarea maxLength={1000} rows={2} value={context} onChange={e=>setContext(e.target.value)} className={control}/><span className="mt-1 block text-xs font-normal text-ink/75">Indicá a qué desarrollo aplica y cuándo usar esta respuesta. Evitá datos personales del cliente.</span></label>
    <label className="block text-sm font-medium text-ink">Válido hasta (opcional)<input type="date" value={expires} onChange={e=>setExpires(e.target.value)} className={control}/><span className="mt-1 block text-xs font-normal text-ink/75">Usá una fecha para precios, disponibilidad o estado de obra que deban revisarse.</span></label>
    <label className="flex min-h-11 items-center gap-2 text-sm text-ink"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/>Usar este ejemplo en las respuestas de la IA</label>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}{notice && <p role="status" className="text-sm text-[#006b6b]">{notice}</p>}
    <button disabled={busy} className={button}>{busy ? 'Guardando…' : 'Guardar ejemplo'}</button><p className="text-xs text-ink/75">Guardar enseña a la IA. No envía mensajes al cliente.</p>
  </form>;
}
export function CrmAiTraining() {
  const [examples,setExamples] = useState<AiTrainingExample[]>([]); const [error,setError]=useState(''); const [loading,setLoading]=useState(true); const [deleting,setDeleting]=useState('');
  async function refresh() {try {const r=await fetch('/api/crm/ai-training',{cache:'no-store'});const data=await r.json();if(!r.ok)throw new Error(data.error);setExamples(data.examples);setError('');}catch(e){setError(e instanceof Error?e.message:'No se pudieron cargar los ejemplos.');}finally{setLoading(false);}}
  useEffect(()=>{void refresh();},[]);
  async function remove(id:string) {setDeleting(id);try{const r=await fetch('/api/crm/ai-training',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});if(!r.ok)throw new Error('No se pudo eliminar el ejemplo.');await refresh();}catch(e){setError(e instanceof Error?e.message:'No se pudo eliminar.');}finally{setDeleting('');}}
  return <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6"><Link href="/admin/crm/mia" className="text-sm font-medium text-[#006b6b] underline">Volver a conversaciones</Link><h3 className="mt-5 text-2xl font-semibold text-ink">Entrenar respuestas de la IA</h3><p className="mt-2 max-w-2xl text-sm text-ink/75">Enseñale cómo responder con ejemplos concretos. Se aplican a WhatsApp, Instagram y Facebook cuando la IA está activa. Revisá los datos de cada desarrollo antes de guardarlos.</p>
    <section className="mt-6 rounded-md border border-ink/15 bg-white p-5"><h2 className="mb-4 text-lg font-semibold text-ink">Nuevo ejemplo</h2><AiTrainingForm onSaved={()=>void refresh()}/></section>
    <section className="mt-8"><h2 className="text-lg font-semibold text-ink">Ejemplos guardados ({examples.length}/200)</h2>{error && <p role="alert" className="mt-3 text-sm text-red-700">{error} <button onClick={()=>void refresh()} className="underline">Reintentar</button></p>}{loading ? <p role="status" className="mt-4 text-sm text-ink">Cargando ejemplos…</p> : !examples.length && !error ? <p className="mt-4 text-sm text-ink/75">Agregá la pregunta de un cliente y escribí cómo debería responder la IA. También podés corregir un mensaje desde la bandeja.</p> : examples.map(e=><details key={e.id} className="mt-3 rounded-md border border-ink/15 bg-white p-4"><summary className="cursor-pointer break-words text-sm font-semibold text-ink">{e.question} <span className="ml-2 font-normal text-ink/75">{!e.enabled ? 'Pausado' : e.expiresAt && Date.parse(e.expiresAt)<=Date.now() ? 'Vencido' : 'Activo'}</span></summary><div className="mt-4"><AiTrainingForm example={e} onSaved={()=>void refresh()}/><button disabled={deleting===e.id} onClick={()=>void remove(e.id)} className="mt-4 min-h-11 rounded-md border border-red-700 px-4 text-sm text-red-700 disabled:opacity-50">{deleting===e.id?'Eliminando…':'Eliminar ejemplo'}</button></div></details>)}</section>
  </section>;
}
