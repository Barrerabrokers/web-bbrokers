"use client";
import { useEffect, useState } from 'react';
import { MiaProjectTrial } from '@/components/admin/mia-project-trial';
import { DEFAULT_WHATSAPP_WELCOME } from '@/lib/whatsapp-welcome-only';

export function WhatsAppWelcomeEditor() {
  const [mode,setMode]=useState<string|null>(null);
  useEffect(()=>{const controller=new AbortController();fetch('/api/crm/whatsapp/welcome',{signal:controller.signal,cache:'no-store'}).then(async r=>{if(r.ok)setMode((await r.json()).mode);}).catch(()=>{});return ()=>controller.abort();},[]);
  return <section aria-labelledby="mia-mode-title" className="mb-4 rounded-md border border-ink/15 bg-white p-4">
    <h3 id="mia-mode-title" className="text-sm font-semibold text-accent">MIA · Atención a clientes</h3>
    <p className="my-3 max-w-prose text-sm text-ink/75">{mode==='conversational'?'MIA responde las nuevas consultas de los clientes con la información de los desarrollos publicados en la web. Los chats pausados siguen bajo atención del equipo.':mode==='welcome-only'?'Los leads reciben una única bienvenida. Después, la conversación continúa con un agente.':'Consultando el estado de MIA…'}</p>
    {mode==='welcome-only'&&<blockquote className="max-w-prose rounded-md bg-cream-50 p-4 text-sm leading-relaxed text-ink">{DEFAULT_WHATSAPP_WELCOME.replace('{{nombre}}', '[nombre del cliente]')}</blockquote>}
    <p className="mt-3 max-w-prose text-sm text-ink/75">MIA interpreta las consultas sobre el catálogo público de Barrera Brokers y recuerda las preferencias de cada conversación. Usa sus fichas web y las listas y brochures enlazados desde la planilla autorizada, y presenta cada unidad en un mensaje separado. El simulador privado permite probar las respuestas sin enviar mensajes a clientes.</p>
    <MiaProjectTrial />

  </section>;
}
