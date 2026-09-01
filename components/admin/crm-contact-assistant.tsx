"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, ChevronLeft, History, Loader2, MessageSquarePlus, Send, Sparkles, Trash2, X } from "lucide-react";

type Contact = { id: string; name: string; email: string; development: string };
type Message = { id: string; role: "user" | "assistant"; content: string; contacts: Contact[]; createdAt: string };
type Conversation = { id: string; title: string; preview: string; messageCount: number; updatedAt: string };

async function readResponse(response: Response) {
  if ((response.headers.get("content-type") || "").includes("application/json")) return response.json();
  await response.text();
  throw new Error(`El asistente no está disponible (${response.status}). Probá nuevamente en unos instantes.`);
}

export function CrmContactAssistant({ canViewAll }: { canViewAll: boolean }) {
  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  async function loadList() {
    setHistoryLoading(true);
    try {
      const response = await fetch("/api/crm/contact-assistant", { cache: "no-store" });
      const data = await readResponse(response);
      if (!response.ok) throw new Error(data.error || "No se pudo cargar el historial");
      setConversations(data.conversations || []);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo cargar el historial"); }
    finally { setHistoryLoading(false); }
  }

  useEffect(() => { if (open) void loadList(); }, [open]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  function startNew() { setConversationId(null); setMessages([]); setQuestion(""); setError(""); setHistoryOpen(false); }

  async function selectConversation(id: string) {
    setHistoryLoading(true); setError("");
    try {
      const response = await fetch(`/api/crm/contact-assistant?conversationId=${encodeURIComponent(id)}`, { cache: "no-store" });
      const data = await readResponse(response);
      if (!response.ok) throw new Error(data.error || "No se pudo abrir la conversación");
      setConversationId(id); setMessages(data.conversation.messages || []); setHistoryOpen(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo abrir la conversación"); }
    finally { setHistoryLoading(false); }
  }

  async function removeConversation(id: string) {
    try {
      const response = await fetch(`/api/crm/contact-assistant?conversationId=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await readResponse(response);
      if (!response.ok) throw new Error(data.error || "No se pudo eliminar");
      setConversations((items) => items.filter((item) => item.id !== id));
      if (conversationId === id) startNew();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo eliminar"); }
  }

  async function ask(event: FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!text || loading) return;
    const pending: Message = { id: `pending-${Date.now()}`, role: "user", content: text, contacts: [], createdAt: new Date().toISOString() };
    setMessages((items) => [...items, pending]); setQuestion(""); setLoading(true); setError("");
    try {
      const response = await fetch("/api/crm/contact-assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: text, conversationId: conversationId || undefined }) });
      const data = await readResponse(response);
      if (!response.ok) throw new Error(data.error || "No se pudo realizar la consulta");
      setConversationId(data.conversationId);
      setMessages((items) => [...items, { id: `answer-${Date.now()}`, role: "assistant", content: data.answer, contacts: data.contacts || [], createdAt: new Date().toISOString() }]);
      void loadList();
    } catch (reason) {
      setMessages((items) => items.filter((message) => message.id !== pending.id)); setQuestion(text);
      setError(reason instanceof Error ? reason.message : "No se pudo realizar la consulta");
    } finally { setLoading(false); }
  }

  return <>
    <button type="button" onClick={() => setOpen(true)} className="fixed bottom-24 right-5 z-40 inline-flex min-h-12 items-center gap-2 rounded-full bg-[#005c5c] px-4 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(0,92,92,0.25)] transition-transform hover:-translate-y-0.5 hover:bg-[#004949] lg:bottom-6 lg:right-7"><Sparkles className="h-4 w-4" />Consultar IA</button>
    {open && <div className="fixed inset-0 z-[70] bg-ink/20 p-3 backdrop-blur-[2px] sm:flex sm:items-end sm:justify-end sm:p-6">
      <section className="ml-auto flex h-full max-h-[780px] w-full max-w-[680px] flex-col overflow-hidden rounded-2xl bg-[#f7f7f5] shadow-2xl sm:h-[min(780px,calc(100vh-3rem))]" role="dialog" aria-modal="true" aria-label="Asistente de contactos">
        <header className="flex items-center justify-between bg-[#143f4e] px-4 py-3.5 text-white sm:px-5"><div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10"><Bot className="h-5 w-5" /></span><div className="min-w-0"><h2 className="truncate font-semibold">Asistente de contactos</h2><p className="truncate text-xs text-white/75">{canViewAll ? "Toda la cartera autorizada" : "Tus contactos asignados"} · historial privado</p></div></div><div className="flex"><button type="button" onClick={() => setHistoryOpen(!historyOpen)} className="rounded-lg p-2 text-white/80 hover:bg-white/10" aria-label="Historial"><History className="h-5 w-5" /></button><button type="button" onClick={startNew} className="rounded-lg p-2 text-white/80 hover:bg-white/10" aria-label="Nueva conversación"><MessageSquarePlus className="h-5 w-5" /></button><button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-white/80 hover:bg-white/10" aria-label="Cerrar"><X className="h-5 w-5" /></button></div></header>

        {historyOpen ? <div className="flex min-h-0 flex-1 flex-col bg-white"><div className="flex items-center justify-between border-b border-ink/10 px-5 py-4"><div><h3 className="font-semibold text-ink">Conversaciones guardadas</h3><p className="text-xs text-ink/55">Seleccioná una para continuar.</p></div><button type="button" onClick={() => setHistoryOpen(false)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-[#005c5c] hover:bg-[#edf7f6]"><ChevronLeft className="h-4 w-4" />Volver</button></div><div className="flex-1 overflow-y-auto p-4">{historyLoading && !conversations.length ? <p className="py-10 text-center text-sm text-ink/50">Cargando…</p> : conversations.length ? <div className="divide-y divide-ink/10">{conversations.map((conversation) => <div key={conversation.id} className="group flex items-start gap-2 py-2"><button type="button" onClick={() => void selectConversation(conversation.id)} className="min-w-0 flex-1 rounded-xl p-3 text-left hover:bg-[#f1f7f6]"><p className="truncate text-sm font-semibold text-ink">{conversation.title}</p><p className="mt-1 line-clamp-1 text-xs text-ink/50">{conversation.preview}</p><p className="mt-1 text-[11px] text-ink/40">{new Date(conversation.updatedAt).toLocaleString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p></button><button type="button" onClick={() => void removeConversation(conversation.id)} className="mt-3 rounded-lg p-2 text-ink/35 hover:bg-red-50 hover:text-red-600" aria-label="Eliminar conversación"><Trash2 className="h-4 w-4" /></button></div>)}</div> : <div className="py-14 text-center"><History className="mx-auto h-7 w-7 text-ink/25" /><p className="mt-3 text-sm font-medium">Todavía no hay conversaciones</p><p className="mt-1 text-xs text-ink/50">La primera consulta se guardará automáticamente.</p></div>}</div></div> : <>
          <div className="flex-1 overflow-y-auto p-4 sm:p-5">{!messages.length && !error && <div className="mx-auto max-w-lg py-4 text-sm text-ink/65"><p className="font-semibold text-ink">Consultá y retomá la conversación cuando quieras.</p><p className="mt-1 text-xs text-ink/50">Cada respuesta queda guardada automáticamente.</p><div className="mt-4 flex flex-wrap gap-2">{["¿Cuántos contactos nuevos tengo?", "Buscá interesados en Alpha Place", "¿A quién debería llamar hoy?", ...(canViewAll ? ["¿Cuántos contactos tiene cada agente?"] : [])].map((example) => <button key={example} type="button" onClick={() => setQuestion(example)} className="rounded-full border border-[#005c5c]/20 bg-white px-3 py-2 text-xs text-[#005c5c] hover:bg-[#edf7f6]">{example}</button>)}</div></div>}
            <div className="space-y-4">{messages.map((message) => <div key={message.id} className={message.role === "user" ? "ml-auto max-w-[84%]" : "mr-auto max-w-[94%]"}><div className={message.role === "user" ? "rounded-2xl rounded-br-md bg-[#005c5c] px-4 py-3 text-sm leading-6 text-white" : "rounded-2xl rounded-bl-md bg-white px-4 py-3 text-sm leading-6 text-ink shadow-sm"}><p className="whitespace-pre-wrap">{message.content}</p></div>{message.contacts.length > 0 && <div className="mt-2 flex gap-2 overflow-x-auto pb-1">{message.contacts.map((contact) => <Link key={contact.id} href={`/admin/crm/${contact.id}`} className="min-w-[190px] rounded-xl border border-ink/10 bg-white p-3 hover:border-[#005c5c]/35"><p className="truncate text-sm font-semibold">{contact.name}</p><p className="truncate text-xs text-[#005c5c]">{contact.email}</p>{contact.development && <p className="truncate text-xs text-ink/50">{contact.development}</p>}</Link>)}</div>}</div>)}</div>{loading && <div className="mt-4 flex w-fit items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm text-ink/60"><Loader2 className="h-4 w-4 animate-spin text-[#005c5c]" />Analizando…</div>}{error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div ref={endRef} /></div>
          <form onSubmit={ask} className="border-t border-ink/10 bg-white p-3 sm:p-4"><div className="flex items-end gap-2 rounded-xl border border-ink/15 p-2 focus-within:border-[#005c5c] focus-within:ring-2 focus-within:ring-[#005c5c]/10"><textarea value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} rows={2} placeholder="Escribí una consulta o continuá el tema…" className="min-h-11 flex-1 resize-none border-0 px-2 py-2 text-sm outline-none placeholder:text-ink/45" /><button type="submit" disabled={loading || !question.trim()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#005c5c] text-white hover:bg-[#004949] disabled:opacity-45" aria-label="Enviar">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button></div><p className="mt-2 text-center text-[11px] text-ink/45">Enter para enviar · solo lectura · no modifica el CRM</p></form>
        </>}
      </section>
    </div>}
  </>;
}
