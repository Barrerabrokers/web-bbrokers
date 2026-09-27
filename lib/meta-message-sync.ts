import { getMetaSocialCredentials } from "@/lib/meta-social";
import { ensureSocialContact, saveWhatsAppMessage } from "@/lib/whatsapp-inbox";

// Import only. Historical conversations must never trigger automatic replies.
export async function syncMetaMessages(channel: "instagram" | "facebook", after?: string) {
  const credentials = await getMetaSocialCredentials();
  const params = new URLSearchParams({
    platform: channel === "instagram" ? "instagram" : "messenger",
    limit: "1",
    fields: "id",
  });
  if (after) params.set("after", after);
  const response = await fetch(`https://graph.facebook.com/${process.env.META_GRAPH_VERSION || "v26.0"}/${credentials.pageId}/conversations?${params}`, {
    headers: { Authorization: `Bearer ${credentials.token}` }, cache: "no-store", signal: AbortSignal.timeout(60000),
  });
  const data = await response.json().catch(() => { throw new Error(`Meta devolvió una respuesta no válida al listar ${channel} (HTTP ${response.status}). Reintentá la sincronización.`); });
  if (!response.ok || !Array.isArray(data.data)) throw new Error(`Meta no permite recuperar ${channel === "instagram" ? "Instagram" : "Facebook"} (código ${Number(data.error?.code) || response.status}). Revisá los permisos de mensajes de la cuenta conectada.`);
  let imported = 0;
  let conversations = 0;
  for (const thread of data.data) {
    const detailResponse = await fetch(`https://graph.facebook.com/${process.env.META_GRAPH_VERSION || "v26.0"}/${encodeURIComponent(thread.id)}?fields=participants`, {
      headers: { Authorization: `Bearer ${credentials.token}` }, cache: "no-store", signal: AbortSignal.timeout(20000),
    });
    const detail = await detailResponse.json();
    if (!detailResponse.ok) throw new Error(`Meta no permite leer los participantes de ${channel} (código ${Number(detail.error?.code) || detailResponse.status}).`);
    const participant = detail.participants?.data?.find((person: { id: string }) => person.id !== credentials.pageId && person.id !== credentials.instagramId);
    if (!participant?.id) continue;
    const conversation = await ensureSocialContact(channel, participant.id, participant.name || participant.username || "");
    if (!conversation) throw new Error("No se pudo guardar una conversación en el CRM. Volvé a sincronizar.");
    conversations++;
    const messageParams = new URLSearchParams({ fields: "id,message,from,created_time", limit: "20" });
    const messageResponse = await fetch(`https://graph.facebook.com/${process.env.META_GRAPH_VERSION || "v26.0"}/${encodeURIComponent(thread.id)}/messages?${messageParams}`, {
      headers: { Authorization: `Bearer ${credentials.token}` }, cache: "no-store", signal: AbortSignal.timeout(20000),
    });
    const messageData = await messageResponse.json().catch(() => { throw new Error(`Meta devolvió una respuesta no válida al leer mensajes de ${channel} (HTTP ${messageResponse.status}).`); });
    if (!messageResponse.ok || !Array.isArray(messageData.data)) throw new Error(`Meta no permite leer el contenido de ${channel} (código ${Number(messageData.error?.code) || messageResponse.status}). Revisá los permisos de mensajes.`);
    const messages = [...messageData.data].sort((a, b) => Date.parse(a.created_time) - Date.parse(b.created_time));
    for (const message of messages) {
      if (!message.id || !message.from?.id || !Number.isFinite(Date.parse(message.created_time))) continue;
      const inbound = message.from.id === participant.id;
      if (await saveWhatsAppMessage({ conversationId: conversation.id, whatsappMessageId: message.id,
        direction: inbound ? "inbound" : "outbound", senderType: inbound ? "customer" : "agent",
        content: message.message || "[Archivo adjunto o contenido no disponible en Meta]",
        createdAt: new Date(message.created_time).toISOString(), historical: true,
      })) imported++;
    }
  }
  return { imported, conversations, nextCursor: data.paging?.next ? data.paging?.cursors?.after || null : null };
}
