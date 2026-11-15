'use client';
import { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { WhatsAppMessage } from '@/lib/whatsapp-inbox';
export function WhatsAppClearChat({conversationId,contactName,onCleared}:{conversationId:string;contactName:string;onCleared:(message:WhatsAppMessage)=>void}) {
  const [open,setOpen]=useState(false),[confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const input=useRef<HTMLInputElement>(null),trigger=useRef<HTMLButtonElement>(null);
  useEffect(()=>{if(open)input.current?.focus();},[open]);
  function close(){setOpen(false);setConfirmation('');setError('');trigger.current?.focus();}
  async function clear(){
    if(busy||confirmation!=='Borrar')return;
    setBusy(true);setError('');
    try{
      const response=await fetch('/api/crm/whatsapp/clear',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({conversationId,confirmation})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||'No se pudieron borrar los mensajes.');
      onCleared(data.message);close();
    }catch(e){setError(e instanceof Error?e.message:'No se pudo confirmar el borrado. Recargá el chat para verificarlo.');}
    finally{setBusy(false);}
  }
  return <div className="w-full border-t border-ink/10 pt-2"><button ref={trigger} type="button" onClick={()=>{if(!busy)setOpen(!open);}} aria-expanded={open} className="inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-red-700"><Trash2 className="h-4 w-4"/>Borrar chat</button>{open&&<div role="group" aria-label={`Confirmar borrado de mensajes de ${contactName}`} className="space-y-3 rounded-md border border-red-200 bg-red-50 p-4"><p className="text-sm text-ink">Se borrarán los mensajes de <strong>{contactName}</strong> en el CRM. El contacto seguirá en la lista. Este borrado no se puede deshacer y no elimina mensajes de WhatsApp.</p><label className="block text-sm font-medium text-ink">Escribí Borrar para confirmar<input ref={input} value={confirmation} onChange={e=>setConfirmation(e.target.value)} disabled={busy} autoComplete="off" className="mt-1 block w-full max-w-xs rounded-md border border-red-200 bg-white p-2"/></label><div className="flex gap-3"><button type="button" onClick={()=>void clear()} disabled={busy||confirmation!=='Borrar'} className="min-h-11 rounded-md bg-red-700 px-4 text-sm font-semibold text-white disabled:opacity-40">{busy?'Borrando…':'Borrar mensajes'}</button><button type="button" disabled={busy} onClick={close} className="min-h-11 rounded-md border border-ink/20 px-4 text-sm">Cancelar</button></div>{error&&<p role="alert" className="text-sm text-red-700">{error}</p>}</div>}</div>;
}
