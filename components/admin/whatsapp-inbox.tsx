"use client";
import { WhatsAppMessageContent } from "@/components/admin/whatsapp-message-content";

import { WhatsAppClearChat } from "@/components/admin/whatsapp-clear-chat";
import { mergeWhatsAppMessageHistory } from "@/lib/whatsapp-message-history";

import Link from "next/link";
import Image from "next/image";
import { WHATSAPP_ATTACHMENT_MAX_BYTES } from "@/lib/whatsapp-attachment-policy";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Check, CircleUserRound, Facebook, Instagram, Loader2, LockKeyhole, MessageCircle, Send, UserPlus, Paperclip, X, FileText } from "lucide-react";
import type { WhatsAppConversation, WhatsAppMessage } from "@/lib/whatsapp-inbox";

type AgentOption = { id: string; name: string };

type Channel = "all" | "whatsapp" | "instagram" | "facebook";
type ChannelConfiguration = { whatsapp: boolean; instagram: boolean; facebook: boolean; ai: boolean };

const channelLabel = { whatsapp: "WhatsApp", instagram: "Instagram", facebook: "Facebook" } as const;

export function WhatsAppInbox({ initialConversations, agents, isAdmin, configured, initialChannel = "all", initialSelectedId }: { initialChannel?: Channel; initialSelectedId?: string; initialConversations: WhatsAppConversation[]; agents: AgentOption[]; isAdmin: boolean; configured: ChannelConfiguration }) {
  const [conversations, setConversations] = useState(initialConversations);
  const [selectedId, setSelectedId] = useState(initialSelectedId || initialConversations.find(c => initialChannel === "all" || c.channel === initialChannel)?.id || "");
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [olderCursor,setOlderCursor]=useState<string|null>(null);
  const historyExpanded=useRef(false);
  const [loadingOlder,setLoadingOlder]=useState(false);
  const [aiStatus,setAiStatus]=useState<{state:string;attempts:number}|null>(null);
  const [loadError, setLoadError] = useState("");
  const [draft, setDraft] = useState("");
  const [attachment,setAttachment]=useState<File|null>(null);
  const [attachmentPreview,setAttachmentPreview]=useState<string|null>(null);
  const fileInput=useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [channel, setChannel] = useState<Channel>(initialChannel);
  const activeId = useRef(selectedId);
  activeId.current = selectedId;
  const selected = useMemo(() => conversations.find((item) => item.id === selectedId), [conversations, selectedId]);
  const visibleConversations = useMemo(() => channel === "all" ? conversations : conversations.filter((item) => item.channel === channel), [channel, conversations]);
  const selectedConfigured = selected ? configured[selected.channel] : false;

  useEffect(()=>{
    if(!attachment?.type.startsWith('image/')){setAttachmentPreview(null);return;}
    const url=URL.createObjectURL(attachment);setAttachmentPreview(url);return()=>URL.revokeObjectURL(url);
  },[attachment]);
  function chooseAttachment(file?:File) {
    if(!file)return;
    if(!['application/pdf','image/jpeg','image/png'].includes(file.type)){setError('Elegí un PDF o una imagen JPG o PNG.');return;}
    if(!file.size||file.size>WHATSAPP_ATTACHMENT_MAX_BYTES){setError('El archivo debe pesar hasta 4 MB.');return;}
    setAttachment(file);setError('');
  }
  useEffect(() => {
    if (!visibleConversations.some((item) => item.id === selectedId)) setSelectedId(visibleConversations[0]?.id || "");
  }, [selectedId, visibleConversations]);

  const refreshConversations = useCallback(async () => {
    const response = await fetch("/api/crm/whatsapp/conversations", { cache: "no-store" });
    if (!response.ok) throw new Error("No se pudieron cargar las conversaciones. Reintentá en unos segundos.");
    const data = await response.json().catch(() => { throw new Error(response.redirected || response.status === 401 ? 'Tu sesión venció. Volvé a iniciar sesión antes de continuar.' : `El servidor no confirmó la operación (HTTP ${response.status}). Revisá el chat en Instagram o WhatsApp antes de reintentar el envío.`); });
    setConversations(data.conversations || []);
    setLoadError("");
  }, []);

  const refreshMessages = useCallback(async (conversationId: string) => {
    const response = await fetch(`/api/crm/whatsapp/messages?conversationId=${encodeURIComponent(conversationId)}`, { cache: "no-store" });
    if (!response.ok) throw new Error("No se pudieron cargar los mensajes de esta conversación.");
    const data = await response.json().catch(() => { throw new Error(response.redirected || response.status === 401 ? 'Tu sesión venció. Volvé a iniciar sesión antes de continuar.' : `El servidor no confirmó la operación (HTTP ${response.status}). Revisá el chat en Instagram o WhatsApp antes de reintentar el envío.`); });
    if (activeId.current === conversationId) {
      if(data.messages?.some((message:WhatsAppMessage)=>message.status==='cleared'))historyExpanded.current=false;
      setMessages(current=>{const recent=data.messages || [];return mergeWhatsAppMessageHistory(current,recent);});
      if(!historyExpanded.current)setOlderCursor(data.nextCursor || null);
      setAiStatus(data.aiStatus || null);
    }
  }, []);

  useEffect(() => {
    historyExpanded.current=false; setMessages([]); setOlderCursor(null); setAiStatus(null); setDraft(""); setAttachment(null);if(fileInput.current)fileInput.current.value=""; setError("");
    if (selectedId) void refreshMessages(selectedId).catch(cause => setLoadError(cause.message));
  }, [selectedId, refreshMessages]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void refreshConversations().catch(cause => setLoadError(cause.message));
      if (selectedId) void refreshMessages(selectedId).catch(cause => setLoadError(cause.message));
    }, 10000);
    return () => window.clearInterval(timer);
  }, [refreshConversations, refreshMessages, selectedId]);

  async function loadOlder() {
    if(!selectedId || !olderCursor)return;
    const id=selectedId;setLoadingOlder(true);
    try{const r=await fetch(`/api/crm/whatsapp/messages?conversationId=${encodeURIComponent(id)}&before=${encodeURIComponent(olderCursor)}`);const data=await r.json();if(!r.ok)throw new Error(data.error);if(activeId.current===id){historyExpanded.current=true;setMessages(current=>{return mergeWhatsAppMessageHistory(current,data.messages);});setOlderCursor(data.nextCursor || null);}}catch(e){setLoadError(e instanceof Error?e.message:"No se pudo cargar el historial.");}finally{setLoadingOlder(false);}
  }

  async function action(actionName: string, extra: Record<string, unknown> = {}) {
    setError("");
    const response = await fetch("/api/crm/whatsapp/conversations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selectedId, action: actionName, ...extra }) });
    const data = await response.json().catch(() => { throw new Error(response.redirected || response.status === 401 ? 'Tu sesión venció. Volvé a iniciar sesión antes de continuar.' : `El servidor no confirmó la operación (HTTP ${response.status}). Revisá el chat en Instagram o WhatsApp antes de reintentar el envío.`); });
    if (!response.ok) { setError(data.error || "No se pudo actualizar el chat"); return; }
    setConversations((current) => current.map((item) => item.id === selectedId ? data.conversation : item));
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!selectedId || (!content&&!attachment)) return;
    if(attachment&&content.length>1024){setError("El mensaje del adjunto puede tener hasta 1024 caracteres.");return;}
    setLoading(true); setError("");
    const conversationId = selectedId;
    try {
      const form=attachment?new FormData():undefined;
      if(form&&attachment){form.set('conversationId',conversationId);form.set('content',content);form.set('file',attachment);}
      const response=await fetch('/api/crm/whatsapp/messages',{method:'POST',...(form?{body:form}:{headers:{'Content-Type':'application/json'},body:JSON.stringify({conversationId,content})})});
      const data = await response.json().catch(() => { throw new Error(response.redirected || response.status === 401 ? 'Tu sesión venció. Volvé a iniciar sesión antes de continuar.' : `El servidor no confirmó la operación (HTTP ${response.status}). Revisá el chat en Instagram o WhatsApp antes de reintentar el envío.`); });
      if (!response.ok) throw new Error(data.error || "No se pudo enviar el mensaje");
      if(activeId.current===conversationId){setDraft('');setAttachment(null);if(fileInput.current)fileInput.current.value='';setMessages(current=>{return mergeWhatsAppMessageHistory(current,data.messages||[]);});}
      if(data.conversation)setConversations(current=>current.map(c=>c.id===conversationId?data.conversation:c));
      await refreshConversations();
    } catch (cause) {
      if (activeId.current === conversationId) setError(cause instanceof Error ? cause.message : "No se pudo enviar. Revisá la conexión.");
    } finally { setLoading(false); }
  }

  return (
    <main className="bg-cream-100 px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-4 flex flex-col justify-between gap-3 border-b border-ink/12 bg-white p-5 sm:flex-row sm:items-center">
          <div><p className="text-xs font-semibold text-[#006b6b]">Atención en tiempo real</p><h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Mensajes de clientes</h2><p className="mt-1 max-w-2xl text-sm text-ink/60">WhatsApp e Instagram en una misma bandeja. Historial compartido con el equipo.</p></div>
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ${configured.ai ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{configured.ai ? <Check className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}{configured.ai ? "Solo bienvenida" : "Bienvenida automática"}</span>
        </div>

        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar por canal">
          {(["all", "whatsapp", "instagram"] as const).map(value => <button key={value} type="button" aria-pressed={channel === value} onClick={() => {setChannel(value); const next=conversations.find(c=>value === "all" || c.channel === value); setSelectedId(next?.id || ""); setAttachment(null); setDraft('');}} className={`min-h-11 rounded-md border px-4 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${channel === value ? "border-accent bg-accent text-white" : "border-ink/20 bg-white text-ink"}`}>{value === "all" ? "Todos" : channelLabel[value]}</button>)}
        </div>
        {loadError && <p role="alert" className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{loadError}</p>}
        <div className="grid min-h-[680px] overflow-hidden rounded-md border border-ink/12 bg-white lg:grid-cols-[360px_1fr]">
          <aside className="border-b border-ink/10 lg:border-b-0 lg:border-r">
            <div className="border-b border-ink/10 p-4"><strong className="text-sm text-ink">Conversaciones</strong><p className="text-xs text-ink/48">{visibleConversations.length} chats visibles</p></div>
            <div className="max-h-[300px] overflow-y-auto lg:max-h-[620px]">
              {!visibleConversations.length && <div className="p-8 text-center text-sm text-ink/50"><MessageCircle className="mx-auto mb-3 h-8 w-8 opacity-40" />No hay conversaciones en este canal.</div>}
              {visibleConversations.map((conversation) => <button key={conversation.id} onClick={() => setSelectedId(conversation.id)} className={`w-full border-b border-ink/8 p-4 text-left transition ${selectedId === conversation.id ? "bg-cream-100" : "hover:bg-cream-50"}`}><span className="flex items-start justify-between gap-3"><strong className="flex min-w-0 items-center gap-2 truncate text-sm text-ink">{conversation.channel === "instagram" ? <Instagram className="h-4 w-4 text-pink-600" /> : conversation.channel === "facebook" ? <Facebook className="h-4 w-4 text-blue-600" /> : <MessageCircle className="h-4 w-4 text-emerald-600" />}<span className="truncate">{conversation.contactName || conversation.phone}</span></strong><small className="shrink-0 text-[10px] text-ink/42">{new Date(conversation.lastMessageAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</small></span><span className="mt-1 block truncate text-xs text-ink/52">{conversation.lastMessage}</span><span className="mt-2 flex items-center gap-2 text-[11px] text-ink/48"><b className="font-medium text-[#006b6b]">{channelLabel[conversation.channel]}</b>{conversation.aiEnabled ? <><Bot className="h-3.5 w-3.5 text-accent" /> IA activa</> : <><CircleUserRound className="h-3.5 w-3.5" />{conversation.assignedAgentName || "Esperando agente"}</>}{conversation.unreadCount > 0 && <b className="ml-auto rounded-full bg-accent px-2 py-0.5 text-white">{conversation.unreadCount}</b>}</span></button>)}
            </div>
          </aside>
          <section className="flex min-w-0 flex-col">
            {!selected ? <div className="grid flex-1 place-items-center p-8 text-sm text-ink/50">Seleccioná una conversación.</div> : <>
              <header className="flex flex-wrap items-center gap-3 border-b border-ink/10 p-4"><div className="mr-auto"><strong className="block text-ink">{selected.contactName}</strong><span className="text-xs text-ink/50">{selected.channel === "whatsapp" ? `+${selected.phone}` : channelLabel[selected.channel]} · {selected.assignedAgentName || "Sin propietario"}</span></div>
                {selected.leadId && <Link href={`/admin/crm/${selected.leadId}`} className="rounded-md border border-ink/15 px-3 py-2 text-xs font-semibold text-accent">Ver contacto</Link>}
                {!selected.assignedAgentId && <button onClick={() => action("take")} className="inline-flex items-center gap-2 rounded-md bg-ink px-3 py-2 text-xs font-semibold text-white"><UserPlus className="h-4 w-4" />Tomar chat</button>}
                <button onClick={() => action("toggle_ai", { aiEnabled: !selected.aiEnabled })} className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold ${selected.aiEnabled ? "border-accent bg-accent/8 text-accent" : "border-ink/15 text-ink/60"}`}><Bot className="h-4 w-4" />{selected.aiEnabled ? "IA activa" : "IA pausada"}</button>
                {isAdmin && <select value={selected.assignedAgentId || ""} onChange={(event) => action("assign", { agentId: event.target.value || undefined })} className="rounded-md border border-ink/15 bg-white px-3 py-2 text-xs"><option value="">Sin propietario</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select>}
              {isAdmin && selected.channel === "whatsapp" && <WhatsAppClearChat key={selected.id} conversationId={selected.id} contactName={selected.contactName || selected.phone} onCleared={message=>{if(activeId.current===message.conversationId){setMessages([message]);historyExpanded.current=false;setOlderCursor(null);setAiStatus(null);setDraft('');setAttachment(null);}setConversations(current=>current.map(c=>c.id===message.conversationId?{...c,lastMessage:message.content,lastMessageAt:message.createdAt,unreadCount:0}:c));}}/>}
              </header>
              {aiStatus && ["pending","processing","review"].includes(aiStatus.state) && <p role="status" className="border-b border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{aiStatus.state==="review"?"No se pudo confirmar el envío. Revisá WhatsApp antes de responder para evitar duplicados.":aiStatus.attempts>=5?"La IA no pudo responder después de varios intentos. Un agente debe continuar este chat.":"La IA tuvo un problema con el proveedor. La respuesta quedó pendiente y se reintentará automáticamente."}</p>}
              <div className="flex-1 space-y-3 overflow-y-auto bg-[#f6f2eb] p-5">{olderCursor && <button type="button" disabled={loadingOlder} onClick={()=>void loadOlder()} className="min-h-11 w-full rounded-md border border-ink/20 bg-white px-4 text-sm text-ink disabled:opacity-50">{loadingOlder?"Cargando historial…":"Cargar mensajes anteriores"}</button>}{messages.map((message) => message.status==='cleared'?<p key={message.id} role="status" className="mx-auto w-fit rounded-md bg-white/80 px-4 py-2 text-center text-xs text-ink/60">Mensajes anteriores borrados</p>:<div key={message.id} className={`flex ${message.direction === "outbound" ? "justify-end" : "justify-start"}`}><div className={`max-w-[78%] rounded-xl px-4 py-3 shadow-sm ${message.direction === "outbound" ? "bg-[#d9fdd3] text-ink" : "bg-white text-ink"}`}><WhatsAppMessageContent content={message.content} attachment={message.attachment}/><span className="mt-1 flex items-center justify-end gap-1 text-[10px] text-ink/42">{message.senderType === "ai" && <Bot className="h-3 w-3" />}{message.status === 'recovered' && 'Historial recuperado · '}{message.senderName || (message.senderType === "ai" ? "Agente IA" : message.senderType === "customer" ? "Cliente" : message.senderType === "history" ? "Registro histórico · dirección no confirmada" : "Equipo")} · {new Date(message.createdAt).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}</span></div></div>)}</div>
              {error && <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">{error}</p>}
              <form onSubmit={send} className="border-t border-ink/10 p-4">
              {isAdmin&&selected.aiEnabled&&<p className="mb-2 text-xs text-ink/60">Con MIA habilitada para atención pública, la IA responde consultas, propone unidades y coordina reuniones. Podés pausarla para continuar personalmente.</p>}
                {attachment&&<div className="mb-3 flex items-center gap-3 rounded-md border border-ink/15 bg-cream-50 p-3">
                  {attachmentPreview?<Image src={attachmentPreview} width={56} height={56} alt={`Vista previa de ${attachment.name}`} unoptimized className="h-14 w-14 rounded object-cover"/>:<FileText className="h-8 w-8 shrink-0 text-accent"/>}
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-ink">{attachment.name}</p><p className="text-xs text-ink/50">{(attachment.size/1024/1024).toLocaleString('es-AR',{maximumFractionDigits:1})} MB</p></div>
                  <button type="button" disabled={loading} onClick={()=>{setAttachment(null);if(fileInput.current)fileInput.current.value='';}} aria-label="Quitar adjunto" className="grid min-h-11 min-w-11 place-items-center rounded-md hover:bg-ink/5 disabled:opacity-40"><X className="h-4 w-4"/></button>
                </div>}
                <div className="flex items-end gap-2 sm:gap-3">
                  <input ref={fileInput} type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" onChange={event=>{chooseAttachment(event.target.files?.[0]);event.target.value='';}}/>
                  <button type="button" disabled={!selectedConfigured||loading||selected.channel!=="whatsapp"} onClick={()=>fileInput.current?.click()} aria-label="Adjuntar PDF o imagen" title="Adjuntar PDF o imagen (hasta 4 MB)" className="grid min-h-11 min-w-11 place-items-center rounded-md border border-ink/15 text-accent hover:bg-cream-50 disabled:opacity-40"><Paperclip className="h-5 w-5"/></button>
                  <textarea value={draft} onChange={event=>setDraft(event.target.value)} rows={2} maxLength={attachment?1024:4000} aria-label={attachment?'Mensaje del adjunto':'Mensaje para el cliente'} placeholder={selectedConfigured?(attachment?'Agregá un mensaje al archivo…':'Escribí un mensaje…'):`Conectá ${channelLabel[selected.channel]} para responder`} disabled={!selectedConfigured||loading} className="min-w-0 flex-1 resize-y rounded-md border border-ink/15 px-3 py-2 text-sm outline-none focus:border-accent"/>
                  <button disabled={!selectedConfigured||loading||(!draft.trim()&&!attachment)} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-3 py-3 text-sm font-semibold text-white disabled:opacity-40">{loading?<Loader2 className="h-4 w-4 animate-spin"/>:<Send className="h-4 w-4"/>}<span className="hidden sm:inline">Enviar</span><span className="sr-only sm:hidden">Enviar</span></button>
                </div>
                <p className="mt-2 text-xs text-ink/45">PDF, JPG o PNG · Hasta 4 MB por archivo.</p>
              </form>
            </>}
          </section>
        </div>
      </div>
    </main>
  );
}
