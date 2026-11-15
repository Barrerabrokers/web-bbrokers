'use client';
import { useState } from 'react';
export function WhatsAppAdminRecontact({ conversationId, onSent }: { conversationId: string; onSent: () => Promise<void> }) {
  const [topic, setTopic] = useState('');
  const [draft, setDraft] = useState<{id:string;content:string;mode:string}|null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function run(action: 'prepare'|'send') {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/crm/whatsapp/recontact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action === 'prepare' ? { action, conversationId, topic } : { action, draftId: draft?.id }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      if (action === 'prepare') setDraft(data);
      else { setDraft(null); setNotice('Seguimiento enviado. Mía continuará cuando el cliente responda.'); await onSent(); }
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo preparar el seguimiento.'); }
    finally { setBusy(false); }
  }
  return <details className="my-3 rounded-md border border-ink/15 bg-white p-3">
    <summary className="cursor-pointer text-sm font-semibold text-accent">Pedir a Mía que retome el contacto</summary>
    <p className="my-3 text-sm text-ink/70">Mía revisa el historial y prepara el seguimiento. Solo se envía cuando lo revisás y elegís enviar. Las conversaciones antiguas requieren una plantilla aprobada por WhatsApp.</p>
    <label htmlFor={`recontact-topic-${conversationId}`} className="mb-2 block text-sm font-medium text-ink">¿Sobre qué querés retomar la consulta?</label>
    <input id={`recontact-topic-${conversationId}`} value={topic} maxLength={300} disabled={busy} onChange={e => { setTopic(e.target.value); setDraft(null); setError(''); setNotice(''); }} className="min-h-11 w-full rounded-md border border-ink/20 px-3 text-sm text-ink focus:border-accent" />
    <button type="button" disabled={busy || topic.trim().length < 3} onClick={() => void run('prepare')} className="mt-3 min-h-11 rounded-md border border-accent px-3 text-sm font-semibold text-accent disabled:opacity-50">{busy ? 'Procesando…' : 'Preparar seguimiento'}</button>
    {draft && <div className="mt-4">
      <p className="mb-2 text-sm font-semibold text-ink">{draft.mode === 'template' ? 'Vista previa de la plantilla aprobada' : 'Mensaje preparado por Mía'}</p>
      <p className="whitespace-pre-wrap text-sm text-ink">{draft.content}</p>
      <button type="button" disabled={busy} onClick={() => void run('send')} className="mt-3 min-h-11 rounded-md bg-accent px-4 text-sm font-semibold text-white disabled:opacity-50">Enviar seguimiento y activar Mía</button>
    </div>}
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="mt-3 text-sm text-emerald-800">{notice}</p>}
  </details>;
}
