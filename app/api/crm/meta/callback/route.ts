import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { configureMetaSocialWebhook, getMetaSocialAppId, resetMetaSocialCredentials } from "@/lib/meta-social";
import { socialConnectionStore } from "@/lib/meta-social-store";
import { getMetaCrmAppSecret } from "@/lib/meta-app-config";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
function finish(result: string, errorCode?: number) {
  const params = new URLSearchParams({ metaConnection: result });
  if (errorCode) params.set("metaErrorCode", String(errorCode));
  const response = NextResponse.redirect(`https://barrerabrokers.com/admin/crm/marketing?${params}`);
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
    const secret = getMetaCrmAppSecret();
    if (!secret) return finish("unavailable");
    const base = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || "v26.0"}`;
    const tokenParams = new URLSearchParams({ client_id: appId, client_secret: secret, redirect_uri: "https://barrerabrokers.com/api/crm/meta/callback", code });
    const tokenResponse = await fetch(`${base}/oauth/access_token?${tokenParams}`, { cache: "no-store", signal: AbortSignal.timeout(15000) });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      // Log identifiers only: never OAuth codes, tokens or app secrets.
      console.error("meta_oauth_exchange_failed", { appId, status: tokenResponse.status, code: tokenData.error?.code, subcode: tokenData.error?.error_subcode, traceId: tokenData.error?.fbtrace_id });
      return finish("token_denied", Number(tokenData.error?.code) || tokenResponse.status);
    }
    const exchangeParams = new URLSearchParams({ grant_type: "fb_exchange_token", client_id: appId, client_secret: secret, fb_exchange_token: tokenData.access_token });
    const longResponse = await fetch(`${base}/oauth/access_token?${exchangeParams}`, { cache: "no-store", signal: AbortSignal.timeout(15000) });
    const longToken = await longResponse.json();
    if (!longResponse.ok || !longToken.access_token) return finish("token_expiry");
    // A partial consent must never replace the existing working Lead Ads token.
    const permissionsResponse = await fetch(`${base}/me/permissions`, { headers: { Authorization: `Bearer ${longToken.access_token}` }, cache: "no-store", signal: AbortSignal.timeout(15000) });
    const permissions = await permissionsResponse.json();
    if (!permissionsResponse.ok || !Array.isArray(permissions.data) || !permissions.data.some((item: { permission?: string; status?: string }) => item.permission === "leads_retrieval" && item.status === "granted")) return finish("leads_denied");
    // Resolve only the Page already configured for this CRM, never another business.
    const pageId = process.env.META_CRM_PAGE_ID || process.env.META_PAGE_ID || process.env.META_SOCIAL_PAGE_ID;
    if (!pageId) return finish("unavailable");
    const pageResponse = await fetch(`${base}/${pageId}?fields=id,name,access_token`, { headers: { Authorization: `Bearer ${longToken.access_token}` }, cache: "no-store", signal: AbortSignal.timeout(15000) });
    const page = await pageResponse.json();
    if (!pageResponse.ok || !page.access_token) return finish("page_denied");
    const formsResponse = await fetch(`${base}/${pageId}/leadgen_forms?fields=id&limit=1`, { headers: { Authorization: `Bearer ${page.access_token}` }, cache: "no-store", signal: AbortSignal.timeout(15000) });
    const forms = await formsResponse.json();
    if (!formsResponse.ok || !Array.isArray(forms.data)) return finish("leads_denied");
    if (forms.data[0]?.id) {
      const leadsResponse = await fetch(`${base}/${encodeURIComponent(forms.data[0].id)}/leads?fields=id&limit=1`, { headers: { Authorization: `Bearer ${page.access_token}` }, cache: "no-store", signal: AbortSignal.timeout(15000) });
      const leads = await leadsResponse.json();
      if (!leadsResponse.ok || !Array.isArray(leads.data)) return finish("leads_denied");
    }
    await socialConnectionStore({ token: page.access_token, pageId, appId, userToken: longToken.access_token });
    resetMetaSocialCredentials();
    // Persist the lead connection even when optional messaging is unavailable.
    try {
      await configureMetaSocialWebhook();
      return finish("connected");
    } catch { return finish("webhook_pending"); }
  } catch { return finish("unavailable"); }
}
