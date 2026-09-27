import { getMetaCrmAppId, getMetaCrmAppSecret } from "@/lib/meta-app-config";
import { socialConnectionStore } from "@/lib/meta-social-store";

// Lead Ads must not depend on Instagram or Messenger permissions.
export async function configureMetaLeadWebhook() {
  const appId = getMetaCrmAppId();
  const secret = getMetaCrmAppSecret();
  const verifyToken = process.env.META_VERIFY_TOKEN;
  const saved = await socialConnectionStore();
  const connection = saved?.appId === appId ? saved : null;
  const pageId = connection?.pageId || process.env.META_CRM_PAGE_ID || process.env.META_PAGE_ID || process.env.META_SOCIAL_PAGE_ID;
  const token = connection?.token || process.env.META_PAGE_ACCESS_TOKEN || process.env.META_CRM_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;
  if (!secret || !verifyToken || !pageId || !token) throw new Error("Falta configurar la conexión de formularios de la app Barrera Brokers CRM.");
  const base = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || "v26.0"}`;
  async function request(path: string, bearer: string, body?: URLSearchParams) {
    const response = await fetch(`${base}/${path}`, { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${bearer}` }, body, cache: "no-store", signal: AbortSignal.timeout(15000) });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || data.error || (body && !data.success)) {
      throw new Error(`Meta no pudo configurar la recepción de formularios (código ${Number(data?.error?.code) || response.status}). Revisá las credenciales de la app CRM y el acceso a leads de la página.`);
    }
    return data;
  }
  const appToken = `${appId}|${secret}`;
  const subscriptions = await request(`${appId}/subscriptions`, appToken);
  const existing = subscriptions.data?.find((entry: { object: string }) => entry.object === "page");
  const callbackUrl = "https://barrerabrokers.com/api/crm/meta/webhook";
  if (existing?.callback_url && existing.callback_url !== callbackUrl) throw new Error("La app CRM tiene otra URL de recepción de formularios. Revisala en Meta antes de reemplazarla.");
  const fields = Array.from(new Set<string>([...(existing?.fields || []).map((field: { name: string }) => field.name), "leadgen"])).join(",");
  await request(`${appId}/subscriptions`, appToken, new URLSearchParams({ object: "page", callback_url: callbackUrl, verify_token: verifyToken, fields }));
  const pageSubscriptions = await request(`${pageId}/subscribed_apps`, token);
  const current = pageSubscriptions.data?.find((entry: { id: string }) => String(entry.id) === appId);
  const subscribedFields = Array.from(new Set<string>([...(current?.subscribed_fields || []), "leadgen"])).join(",");
  await request(`${pageId}/subscribed_apps`, token, new URLSearchParams({ subscribed_fields: subscribedFields }));
  return { configured: true, leadgenConfigured: true };
}
