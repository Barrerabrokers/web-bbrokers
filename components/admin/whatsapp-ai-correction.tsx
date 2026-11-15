'use client';
import { useRef, useState } from 'react';
export function WhatsAppAiCorrection({conversationId,messageId,original,onSent}:{conversationId:string;messageId:string;original:string;onSent:()=>Promise<void>}) {
  const [open,setOpen]=useState(false),[answer,setAnswer]=useState(original),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[blocked,setBlocked]=useState(false),[attempted,setAttempted]=useState(false);
  const requestId=useRef<string>();
  async function send(){
    if(busy||blocked||!answer.trim())return;
    setBusy(true);setAttempted(true);setNotice('');requestId.current ||= crypto.randomUUID();
    try{
      const response=await fetch('/api/crm/whatsapp/corrections',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:requestId.current,conversationId,sourceMessageId:messageId,answer})});
      const data=await response.json();
      if(!response.ok){if(data.uncertain)setBlocked(true);throw new Error(data.error||'No se pudo enviar.');}
      setBlocked(true);setNotice('Respuesta corregida, enviada y guardada para esta consulta.');
      await onSent().catch(()=>{});
    }catch(e){setNotice(e instanceof Error?e.message:'No se pudo confirmar el envío. Volvé a intentar con el mismo texto.');}
    finally{setBusy(false);}
  }
  return <div className="mt-3 border-t border-ink/15 pt-2"><button type="button" onClick={()=>setOpen(!open)} aria-expanded={open} className="min-h-11 text-left text-xs font-semibold text-[#006b6b]">Editar respuesta y volver a enviar</button>{open&&<div className="mt-2 space-y-2"><label className="block text-xs font-semibold">Respuesta corregida<textarea value={answer} onChange={e=>{setAnswer(e.target.value);}} maxLength={3000} disabled={busy||blocked||attempted} rows={4} className="mt-1 w-full rounded-md border border-ink/20 bg-white p-2 text-sm text-ink"/></label><p className="text-xs text-ink/65">Se enviará al cliente y se guardará como ejemplo para la consulta original. La IA seguirá activa.</p><button type="button" disabled={busy||blocked||!answer.trim()} onClick={()=>void send()} className="min-h-11 rounded-md bg-[#006b6b] px-3 text-sm text-white disabled:opacity-50">{busy?'Enviando y guardando…':'Guardar corrección y enviar'}</button><p role="status" className="text-xs text-ink">{notice}</p></div>}</div>;
}
