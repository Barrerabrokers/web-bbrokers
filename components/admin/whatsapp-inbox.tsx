"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Bot, Check, CircleUserRound, Facebook, Instagram, Loader2, LockKeyhole, MessageCircle, Send, UserPlus } from "lucide-react";
import type { WhatsAppConversation, WhatsAppMessage } from "@/lib/whatsapp-inbox";

type AgentOption = { id: string; name: string };

type Channel = "all" | "whatsapp" | "instagram" | "facebook";
type ChannelConfiguration = { whatsapp: boolean; instagram: boolean; facebook: boolean; ai: boolean };

const channelLabel = { whatsapp: "WhatsApp", instagram: "Instagram", facebook: "Facebook" } as const;

export function WhatsAppInbox({ initialConversations, agents, isAdmin, configured }: { initialConversations: WhatsAppConversation[]; agents: AgentOption[]; isAdmin: boolean; configured: ChannelConfiguration }) {
  const [conversations, setConversations] = useState(initialConversations);
  const [selectedId, setSelectedId] = useState(initialConversations[0]?.id || "");
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [channel, setChannel] = useState<Channel>("all");
  const selected = useMemo(() => conversations.find((item) => item.id === selectedId), [conversations, selectedId]);
  const visibleConversations = useMemo(() => channel === "all" ? conversations : conversations.filter((item) => item.channel === channel), [channel, conversations]);
  const selectedConfigured = selected ? configured[selected.channel] : false;

  useEffect(() => {
    if (visibleConversations.length && !visibleConversations.some((item) => item.id === selectedId)) setSelectedId(visibleConversations[0].id);
  }, [selectedId, visibleConversations]);

  const refreshConversations = useCallback(async () => {
    const response = await fetch("/api/crm/whatsapp/conversations", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    setConversations(data.conversations || []);
  }, []);

  const refreshMessages = useCallback(async (conversationId: string) => {
    const response = await fetch(`/api/crm/whatsapp/messages?conversationId=${encodeURIComponent(conversationId)}`, { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    setMessages(data.messages || []);
  }, []);

  useEffect(() => {
    if (selectedId) void refreshMessages(selectedId);
  }, [selectedId, refreshMessages]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshConversations();
      if (selectedId) void refreshMessages(selectedId);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [refreshConversations, refreshMessages, selectedId]);

  async function action(actionName: string, extra: Record<string, unknown> = {}) {
    setError("");
    const response = await fetch("/api/crm/whatsapp/conversations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selectedId, action: actionName, ...extra }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error || "No se pudo actualizar el chat"); return; }
    setConversations((current) => current.map((item) => item.id === selectedId ? data.conversation : item));
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!selectedId || !content) return;
    setLoading(true); setError("");
    const response = await fetch("/api/crm/whatsapp/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId: selectedId, content }) });
    const data = await response.json();
    if (response.ok) { setDraft(""); setMessages(data.messages || []); await refreshConversations(); }
    else setError(data.error || "No se pudo enviar el mensaje");
    setLoading(false);
  }

  return (
    <main className="bg-cream-100 px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-4 flex flex-col justify-between gap-3 border-b border-ink/12 bg-white p-5 sm:flex-row sm:items-center">
          <div><p className="text-xs font-semibold text-[#006b6b]">Atención en tiempo real</p><h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Bandeja omnicanal</h2><p className="mt-1 max-w-2xl text-sm text-ink/60">WhatsApp, Instagram y Facebook en un solo lugar, con IA y derivación al equipo.</p></div>
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ${configured.ai ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{configured.ai ? <Check className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}{configured.ai ? "IA disponible" : "IA pendiente"}</span>
        </div>
        <div className="grid min-h-[680px] overflow-hidden rounded-md border border-ink/12 bg-white lg:grid-cols-[360px_1fr]">
          <aside className="border-b border-ink/10 lg:border-b-0 lg:border-r">
            <div className="border-b border-ink/10 p-4"><strong className="text-sm text-ink">Conversaciones</strong><p className="text-xs text-ink/48">{visibleConversations.length} chats visibles</p><div className="mt-3 flex gap-1 overflow-x-auto">{(["all", "whatsapp", "instagram", "facebook"] as Channel[]).map((value) => <button key={value} onClick={() => setChannel(value)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${channel === value ? "bg-[#006b6b] text-white" : "bg-cream-100 text-ink/65"}`}>{value === "all" ? "Todos" : channelLabel[value]}</button>)}</div></div>
            <div className="max-h-[620px] overflow-y-auto">
              {!visibleConversations.length && <div className="p-8 text-center text-sm text-ink/50"><MessageCircle className="mx-auto mb-3 h-8 w-8 opacity-40" />No hay conversaciones en este canal.</div>}
              {visibleConversations.map((conversation) => <button key={conversation.id} onClick={() => setSelectedId(conversation.id)} className={`w-full border-b border-ink/8 p-4 text-left transition ${selectedId === conversation.id ? "bg-cream-100" : "hover:bg-cream-50"}`}><span className="flex items-start justify-between gap-3"><strong className="flex min-w-0 items-center gap-2 truncate text-sm text-ink">{conversation.channel === "instagram" ? <Instagram className="h-4 w-4 text-pink-600" /> : conversation.channel === "facebook" ? <Facebook className="h-4 w-4 text-blue-600" /> : <MessageCircle className="h-4 w-4 text-emerald-600" />}<span className="truncate">{conversation.contactName || conversation.phone}</span></strong><small className="shrink-0 text-[10px] text-ink/42">{new Date(conversation.lastMessageAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</small></span><span className="mt-1 block truncate text-xs text-ink/52">{conversation.lastMessage}</span><span className="mt-2 flex items-center gap-2 text-[11px] text-ink/48"><b className="font-medium text-[#006b6b]">{channelLabel[conversation.channel]}</b>{conversation.aiEnabled ? <><Bot className="h-3.5 w-3.5 text-accent" /> IA activa</> : <><CircleUserRound className="h-3.5 w-3.5" />{conversation.assignedAgentName || "Esperando agente"}</>}{conversation.unreadCount > 0 && <b className="ml-auto rounded-full bg-accent px-2 py-0.5 text-white">{conversation.unreadCount}</b>}</span></button>)}
            </div>
          </aside>
          <section className="flex min-w-0 flex-col">
            {!selected ? <div className="grid flex-1 place-items-center p-8 text-sm text-ink/50">Seleccioná una conversación.</div> : <>
              <header className="flex flex-wrap items-center gap-3 border-b border-ink/10 p-4"><div className="mr-auto"><strong className="block text-ink">{selected.contactName}</strong><span className="text-xs text-ink/50">+{selected.phone} · {selected.assignedAgentName || "Sin propietario"}</span></div>
                {!selected.assignedAgentId && <button onClick={() => action("take")} className="inline-flex items-center gap-2 rounded-md bg-ink px-3 py-2 text-xs font-semibold text-white"><UserPlus className="h-4 w-4" />Tomar chat</button>}
                <button onClick={() => action("toggle_ai", { aiEnabled: !selected.aiEnabled })} className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold ${selected.aiEnabled ? "border-accent bg-accent/8 text-accent" : "border-ink/15 text-ink/60"}`}><Bot className="h-4 w-4" />{selected.aiEnabled ? "IA activa" : "IA pausada"}</button>
                {isAdmin && <select value={selected.assignedAgentId || ""} onChange={(event) => action("assign", { agentId: event.target.value || undefined })} className="rounded-md border border-ink/15 bg-white px-3 py-2 text-xs"><option value="">Sin propietario</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select>}
              </header>
              <div className="flex-1 space-y-3 overflow-y-auto bg-[#f6f2eb] p-5">{messages.map((message) => <div key={message.id} className={`flex ${message.direction === "outbound" ? "justify-end" : "justify-start"}`}><div className={`max-w-[78%] rounded-xl px-4 py-3 shadow-sm ${message.direction === "outbound" ? "bg-[#d9fdd3] text-ink" : "bg-white text-ink"}`}><p className="whitespace-pre-wrap text-sm leading-5">{message.content}</p><span className="mt-1 flex items-center justify-end gap-1 text-[10px] text-ink/42">{message.senderType === "ai" && <Bot className="h-3 w-3" />}{message.senderName || (message.senderType === "ai" ? "Agente IA" : message.senderType === "customer" ? "Cliente" : "Equipo")} · {new Date(message.createdAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</span></div></div>)}</div>
              {error && <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">{error}</p>}
              <form onSubmit={send} className="flex gap-3 border-t border-ink/10 p-4"><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={selectedConfigured ? "Escribí un mensaje…" : `Conectá ${channelLabel[selected.channel]} para responder`} disabled={!selectedConfigured || loading} className="min-w-0 flex-1 rounded-md border border-ink/15 px-4 py-3 text-sm outline-none focus:border-accent" /><button disabled={!selectedConfigured || loading || !draft.trim()} className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Enviar</button></form>
            </>}
          </section>
        </div>
      </div>
    </main>
  );
}
