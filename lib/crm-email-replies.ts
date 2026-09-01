import { createCrmActivity, getCrmActivities, getCrmEmailAccountWithSecret, type CrmLead } from "@/lib/db";
import { getAccessTokenForGoogleAccount } from "@/lib/google-oauth";

type GmailHeader = { name?: string; value?: string };
type GmailPart = { mimeType?: string; body?: { data?: string }; parts?: GmailPart[] };
type GmailMessage = { id?: string; internalDate?: string; payload?: GmailPart & { headers?: GmailHeader[] } };

function decodeBase64Url(value = "") {
  if (!value) return "";
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function findBody(part?: GmailPart): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) return decodeBase64Url(part.body.data);
  for (const child of part.parts || []) {
    const text = findBody(child);
    if (text) return text;
  }
  if (part.mimeType === "text/html" && part.body?.data) {
    return decodeBase64Url(part.body.data).replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+\n/g, "\n").trim();
  }
  return "";
}

function header(message: GmailMessage, name: string) {
  return message.payload?.headers?.find((item) => item.name?.toLowerCase() === name.toLowerCase())?.value || "";
}

export async function syncLeadEmailReplies({ lead, agentId, origin }: { lead: CrmLead; agentId: string; origin: string }) {
  const account = await getCrmEmailAccountWithSecret(agentId);
  if (!account || account.provider !== "google-oauth") return { imported: 0, available: false, error: "La cuenta del propietario debe estar conectada con Google." };
  if (!account.googleScopes?.includes("gmail.readonly")) return { imported: 0, available: false, error: "Reconectá Google para habilitar la lectura de respuestas." };

  const accessToken = await getAccessTokenForGoogleAccount({ origin, account });
  const query = encodeURIComponent(`from:${lead.email} newer_than:1y`);
  const listResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=40`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  const list = await listResponse.json().catch(() => null) as { messages?: { id: string }[]; error?: { message?: string } } | null;
  if (!listResponse.ok) throw new Error(list?.error?.message || "No se pudieron consultar las respuestas de Gmail.");

  let imported = 0;
  const existingIds = new Set((await getCrmActivities([lead.id])).filter((activity) => activity.externalSource === "gmail_inbound").map((activity) => activity.externalId));
  for (const item of list?.messages || []) {
    if (existingIds.has(item.id)) continue;
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=full`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
    const message = await response.json().catch(() => null) as GmailMessage | null;
    if (!response.ok || !message?.id) continue;
    const subject = header(message, "Subject") || "Sin asunto";
    const body = findBody(message.payload).trim() || "El cliente respondió el correo. Abrí Gmail para consultar el contenido completo.";
    const { activity, error } = await createCrmActivity({
      leadId: lead.id,
      type: "correo",
      title: `Respuesta por correo: ${subject}`,
      body,
      scheduledAt: message.internalDate ? new Date(Number(message.internalDate)).toISOString() : undefined,
      createdBy: agentId,
      externalSource: "gmail_inbound",
      externalId: message.id,
    });
    if (activity && !error) imported += 1;
  }
  return { imported, available: true, error: "" };
}
