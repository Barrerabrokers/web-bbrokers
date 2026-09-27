// The CRM/Lead Ads app and WhatsApp app are separate Meta applications.
// Keep the legacy secret as a migration fallback; never use one app's
// dedicated secret as the other app's fallback.
export function getMetaCrmAppId() {
  return process.env.META_CRM_APP_ID?.trim() || process.env.META_APP_ID?.trim() || "1113448051007765";
}

export function getMetaCrmAppSecret() {
  return process.env.META_CRM_APP_SECRET?.trim() || process.env.META_APP_SECRET?.trim();
}

export function getWhatsAppAppId() {
  return process.env.NEXT_PUBLIC_WHATSAPP_APP_ID?.trim() || process.env.NEXT_PUBLIC_META_APP_ID?.trim() || "1735228224390278";
}

export function getWhatsAppAppSecret() {
  return process.env.WHATSAPP_APP_SECRET?.trim() || process.env.META_APP_SECRET?.trim();
}

export async function inspectMetaCrmAppConfiguration() {
  const appId = getMetaCrmAppId();
  const secret = getMetaCrmAppSecret();
  if (!secret) return { appId, valid: false, reason: "missing_secret" };
  try {
    const response = await fetch(`https://graph.facebook.com/${process.env.META_GRAPH_VERSION || "v26.0"}/app?fields=id`, {
      headers: { Authorization: `Bearer ${appId}|${secret}` }, cache: "no-store", signal: AbortSignal.timeout(10000),
    });
    const data = await response.json();
    return { appId, valid: response.ok && String(data.id) === appId, code: data.error?.code as number | undefined, secretSource: process.env.META_CRM_APP_SECRET ? "META_CRM_APP_SECRET" : "META_APP_SECRET" };
  } catch {
    return { appId, valid: false, reason: "verification_unavailable" };
  }
}
