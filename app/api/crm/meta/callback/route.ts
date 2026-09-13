import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { configureMetaSocialWebhook, getMetaSocialAppId, resetMetaSocialCredentials } from "@/lib/meta-social";
import { socialConnectionStore } from "@/lib/meta-social-store";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
function finish(result: string) {
  const response = NextResponse.redirect(`https://barrerabrokers.com/admin/crm/marketing?metaConnection=${result}`);
  response.cookies.set("crm_meta_social_state", "", { path: "/api/crm/meta", maxAge: 0 });
  return response;
}
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const state = request.nextUrl.searchParams.get("state");
  if (!session || session.user.role !== "admin" || !state || state !== request.cookies.get("crm_meta_social_state")?.value || !state.endsWith(`.${session.user.id}`)) return finish("invalid");
  const code = request.nextUrl.searchParams.get("code");
  if (!code || request.nextUrl.searchParams.has("error")) return finish("cancelled");
  try {
    const appId = await getMetaSocialAppId();
    const secret = process.env.META_APP_SECRET;
    if (!secret) return finish("unavailable");
    const base = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || "v26.0"}`;
    const tokenResponse = await fetch(`${base}/oauth/access_token`, { method: "POST", body: new URLSearchParams({ client_id: appId, client_secret: secret, redirect_uri: "https://barrerabrokers.com/api/crm/meta/callback", code }), cache: "no-store", signal: AbortSignal.timeout(15000) });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) return finish("token_denied");
    const longResponse = await fetch(`${base}/oauth/access_token`, { method: "POST", body: new URLSearchParams({ grant_type: "fb_exchange_token", client_id: appId, client_secret: secret, fb_exchange_token: tokenData.access_token }), cache: "no-store", signal: AbortSignal.timeout(15000) });
    const longToken = await longResponse.json();
    if (!longResponse.ok || !longToken.access_token) return finish("token_expiry");
    // Resolve only the Page already configured for this CRM, never another business.
    const pageId = process.env.META_SOCIAL_PAGE_ID || process.env.META_PAGE_ID;
    if (!pageId) return finish("unavailable");
    const pageResponse = await fetch(`${base}/${pageId}?fields=id,name,access_token,instagram_business_account{id}`, { headers: { Authorization: `Bearer ${longToken.access_token}` }, cache: "no-store", signal: AbortSignal.timeout(15000) });
    const page = await pageResponse.json();
    if (!pageResponse.ok || !page.access_token) return finish("page_denied");
    if (!page.instagram_business_account?.id) return finish("instagram_missing");
    const headers = { Authorization: `Bearer ${page.access_token}` };
    const check = await fetch(`${base}/${pageId}/conversations?platform=instagram&limit=1&fields=id`, { headers, cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!check.ok) return finish("messages_denied");
    await socialConnectionStore({ token: page.access_token, pageId, appId });
    resetMetaSocialCredentials();
    // Instagram webhooks are configured on the app, not Page subscribed_fields.
    try {
      await configureMetaSocialWebhook();
      return finish("connected");
    } catch { return finish("webhook_pending"); }
  } catch { return finish("unavailable"); }
}
