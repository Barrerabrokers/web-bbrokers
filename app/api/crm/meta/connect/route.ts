import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMetaSocialAppId } from "@/lib/meta-social";
export const dynamic = "force-dynamic";
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const appId = await getMetaSocialAppId();
    const state = `${randomUUID()}.${session.user.id}`;
    const redirectUri = "https://barrerabrokers.com/api/crm/meta/callback";
    const params = new URLSearchParams({ client_id: appId, redirect_uri: redirectUri, state, response_type: "code", auth_type: "rerequest", scope: "instagram_basic,instagram_manage_messages,pages_show_list,pages_read_engagement,pages_manage_metadata" });
    if (process.env.META_SOCIAL_LOGIN_CONFIG_ID) params.set("config_id", process.env.META_SOCIAL_LOGIN_CONFIG_ID);
    const response = NextResponse.redirect(`https://www.facebook.com/${process.env.META_GRAPH_VERSION || "v26.0"}/dialog/oauth?${params}`);
    response.cookies.set("crm_meta_social_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/api/crm/meta" });
    return response;
  } catch { return NextResponse.redirect("https://barrerabrokers.com/admin/crm/marketing?metaConnection=unavailable"); }
}
