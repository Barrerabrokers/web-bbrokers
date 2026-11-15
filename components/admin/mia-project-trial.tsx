'use client';
import type { AgentMemory } from '@/lib/mia-agent-search';
import type { MeetingState } from '@/lib/mia-meeting-policy';
import { useState } from 'react';
type Message={role:'user'|'assistant';content:string};
export function MiaProjectTrial(){
 const [agentMemory,setAgentMemory]=useState<AgentMemory|null>(null);
 const [meetingState,setMeetingState]=useState<MeetingState|null>(null);
 const [messages,setMessages]=useState<Message[]>([]),[draft,setDraft]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function send(event:React.FormEvent){event.preventDefault();if(!draft.trim()||busy)return;const next:Message[]=[...messages,{role:'user',content:draft.trim()}];setBusy(true);setError('');
  try{const response=await fetch('/api/crm/whatsapp/mia-test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:next.slice(-32),meetingState,agentMemory})});const data=await response.json();if(!response.ok)throw Error(data.error||'No se pudo obtener la respuesta.');setMessages([...next,...(Array.isArray(data.messages)?data.messages:[data.reply]).map((content:string):Message=>({role:'assistant',content}))]);setMeetingState(data.meetingState||null);setAgentMemory(data.agentMemory||null);setDraft('');}
  catch(e){setError(e instanceof Error?e.message:'No se pudo realizar la prueba.');}finally{setBusy(false);}}
 return <section className="mt-5 border-t border-ink/15 pt-5" aria-labelledby="mia-trial-title">
  <h4 id="mia-trial-title" className="text-sm font-semibold text-ink">Probar conversación con MIA</h4>
  <p className="mt-2 max-w-prose text-sm text-ink/75">Solo Pablo Barrera. Catálogo público de Barrera Brokers y documentos de la planilla autorizada. Esta prueba no envía mensajes a clientes ni crea citas reales; permite simular la coordinación de reuniones.</p>
  <div aria-live="polite" aria-busy={busy} className="mt-3 max-h-96 space-y-3 overflow-y-auto">
   {!messages.length&&<p className="text-sm text-ink/75">Podés empezar con «Busco dos ambientes» o preguntar por alguno de los desarrollos publicados.</p>}
   {messages.map((m,i)=><div key={i} className="rounded-md border border-ink/15 p-3"><p className="text-xs font-semibold text-accent">{m.role==='user'?'Pablo':'MIA'}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">{m.content}</p></div>)}
   {busy&&<p role="status" className="text-sm text-ink/75">Consultando fichas y documentos…</p>}
  </div>
  <form onSubmit={event=>void send(event)} className="mt-3 space-y-2"><label htmlFor="mia-trial-message" className="block text-sm font-medium text-ink">Tu mensaje de prueba</label><textarea id="mia-trial-message" rows={2} maxLength={3500} value={draft} disabled={busy} onChange={e=>setDraft(e.target.value)} className="w-full rounded-md border border-ink/20 p-3 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"/><div className="flex gap-3"><button disabled={busy||!draft.trim()} className="min-h-11 rounded-md bg-accent px-4 text-sm font-semibold text-white disabled:opacity-50">{busy?'Consultando…':'Probar respuesta'}</button><button type="button" disabled={busy||!messages.length} onClick={()=>{setMessages([]);setError('');setMeetingState(null);setAgentMemory(null);setDraft('');}} className="min-h-11 rounded-md border border-ink/20 px-4 text-sm text-ink disabled:opacity-50">Nueva conversación de prueba</button></div></form>
  {error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
 </section>;
}
