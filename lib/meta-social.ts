import { socialConnectionStore } from "@/lib/meta-social-store";
// Facebook Login: messaging uses the token of the connected Facebook Page.
let credentials: { token: string; pageId: string; name: string; instagramId?: string; instagramName?: string; expires: number } | null = null;
export async function getMetaSocialCredentials() {
  if (credentials && credentials.expires > Date.now()) return credentials;
  const saved = await socialConnectionStore();
  const token = saved?.token || process.env.META_PAGE_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;
  const pageId = saved?.pageId || process.env.META_SOCIAL_PAGE_ID || process.env.META_PAGE_ID;
  if (!token || !pageId) throw new Error("Falta conectar la página de Meta para recibir y responder mensajes.");
  const version = process.env.META_GRAPH_VERSION || "v26.0";
  const response = await fetch(`https://graph.facebook.com/${version}/${pageId}?fields=id,name,access_token,instagram_business_account{id,username}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(15000) });
  const data = await response.json();
  if (!response.ok) throw new Error(`Meta no permite acceder a la página conectada (código ${Number(data.error?.code) || response.status}). Revisá el token y los permisos de la página.`);
  credentials = { token: data.access_token || token, pageId, name: data.name || "Página de Meta", instagramId: data.instagram_business_account?.id, instagramName: data.instagram_business_account?.username, expires: Date.now() + 300000 };
  return credentials;
}

export async function inspectMetaSocialConnection() {
  try {
    const connection = await getMetaSocialCredentials();
    const version = process.env.META_GRAPH_VERSION || "v26.0";
    const headers = { Authorization: `Bearer ${connection.token}` };
    const appId = await getMetaSocialAppId();
    const [subscriptionCheck, messages] = await Promise.all([
      fetch(`https://graph.facebook.com/${version}/${appId}/subscriptions`, { headers: { Authorization: `Bearer ${appId}|${process.env.META_APP_SECRET || ""}` }, cache: "no-store", signal: AbortSignal.timeout(15000) }).then(async r => ({ ok: r.ok, data: await r.json() })),
      connection.instagramId ? fetch(`https://graph.facebook.com/${version}/${connection.pageId}/conversations?platform=instagram&limit=1&fields=id`, { headers, cache: "no-store", signal: AbortSignal.timeout(15000) }).then(r => r.json()) : Promise.resolve(null),
    ]);
    const instagram = subscriptionCheck.data.data?.find((item: any) => item.object === "instagram");
    const fields = (instagram?.fields || []).map((field: any) => field.name);
    return { connected: true, pageName: connection.name, instagramName: connection.instagramName || null, instagramLinked: Boolean(connection.instagramId), canReadInstagram: Boolean(messages && !messages.error), subscribed: subscriptionCheck.ok ? fields.includes("messages") : null, subscriptionCheckAvailable: subscriptionCheck.ok, message: !connection.instagramId ? "La página conectada no tiene una cuenta profesional de Instagram vinculada." : messages?.error ? "Instagram está vinculado, pero Meta no autoriza leer sus conversaciones. Revisá instagram_basic e instagram_manage_messages en la app conectada." : "Instagram permite consultar las conversaciones. Los mensajes nuevos se reciben mediante el webhook de Meta." };
  } catch (error) {
    return { connected: false, canReadInstagram: false, instagramLinked: false, subscribed: null, message: error instanceof Error ? error.message : "No se pudo verificar Meta." };
  }
}

export async function getMetaSocialContactName(channel: "instagram" | "facebook", id: string) {
  try {
    const { token } = await getMetaSocialCredentials();
    const fields = channel === "instagram" ? "name,username" : "first_name,last_name";
    const response = await fetch(`https://graph.facebook.com/${process.env.META_GRAPH_VERSION || "v26.0"}/${encodeURIComponent(id)}?fields=${fields}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!response.ok) return "";
    const data = await response.json();
    return String(data.name || data.username || [data.first_name, data.last_name].filter(Boolean).join(" ") || "");
  } catch { return ""; }
}

export async function getMetaSocialAppId() {
  if (process.env.META_APP_ID) return process.env.META_APP_ID;
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) throw new Error("Falta la conexión de Meta.");
  const response = await fetch(`https://graph.facebook.com/${process.env.META_GRAPH_VERSION || "v26.0"}/debug_token?input_token=${encodeURIComponent(token)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(10000) });
  const data = await response.json();
  if (!response.ok || !data.data?.app_id) throw new Error("No se pudo identificar la app conectada con Meta.");
  return String(data.data.app_id);
}
export function resetMetaSocialCredentials() { credentials = null; }

export async function configureMetaSocialWebhook() {
  const appId = await getMetaSocialAppId();
  const secret = process.env.META_APP_SECRET;
  const verifyToken = process.env.META_VERIFY_TOKEN;
  if (!secret || !verifyToken) throw new Error("Faltan las credenciales para verificar la recepción de Meta.");
  const base = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || "v26.0"}/${appId}/subscriptions`;
  const headers = { Authorization: `Bearer ${appId}|${secret}` };
  const existingResponse = await fetch(base, { headers, cache: "no-store", signal: AbortSignal.timeout(15000) });
  const existing = await existingResponse.json();
  if (!existingResponse.ok) throw new Error("No se pudo administrar el webhook. Verificá que la clave secreta corresponda a la app conectada.");
  const instagram = existing.data?.find((item: any) => item.object === "instagram");
  const callback = instagram?.callback_url || "https://barrerabrokers.com/api/crm/meta/webhook";
  if (!["https://barrerabrokers.com/api/crm/meta/webhook", "https://barrerabrokers.com/api/meta/messages/webhook"].includes(callback)) throw new Error("La app de Instagram ya tiene otra URL de recepción configurada. Revisala en Meta antes de reemplazarla.");
  const fields = Array.from(new Set([...(instagram?.fields || []).map((field: any) => field.name), "messages", "messaging_postbacks"])).join(",");
  const response = await fetch(base, { method: "POST", headers, body: new URLSearchParams({ object: "instagram", callback_url: callback, verify_token: verifyToken, fields }), signal: AbortSignal.timeout(20000) });
  if (!response.ok || !(await response.json()).success) throw new Error("Meta no pudo verificar la recepción de Instagram. Revisá los permisos y el webhook de la app.");
  return { configured: true };
}
