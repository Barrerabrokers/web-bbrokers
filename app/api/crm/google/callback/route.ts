import { readMiaMailTarget } from "@/lib/mia-sales-oauth";
import { startMiaSalesPilot } from "@/lib/mia-sales-store";
import { miaSalesDb } from "@/lib/mia-sales-store";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { exchangeGoogleCode, getGoogleUserInfo } from "@/lib/google-oauth";
import { upsertCrmEmailAccount } from "@/lib/db";
import { canManageListings } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requestOrigin(request: NextRequest) {
  return process.env.NEXTAUTH_URL || new URL(request.url).origin;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const redirectUrl = new URL("/admin/crm/correo", request.url);

  if (!session || !canManageListings(session.user.role)) {
    return NextResponse.redirect(new URL("/login?from=/admin/crm/correo", request.url));
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = request.cookies.get("bb_google_oauth_state")?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    redirectUrl.searchParams.set("google", "invalid_state");
    return NextResponse.redirect(redirectUrl);
  }

  const targetCookie=request.cookies.get("bb_google_oauth_mia")?.value;
  let target:ReturnType<typeof readMiaMailTarget>|undefined;
  if(targetCookie){
    redirectUrl.pathname="/admin/crm/panel-agentes";
    redirectUrl.searchParams.set("miaPilot","1");
    try{target=readMiaMailTarget(targetCookie,session.user,state);const sql=miaSalesDb();try{const [current]=await sql`SELECT a.email FROM crm_mia_sales_control c JOIN agents a ON a.id=c.agent_id WHERE c.id=TRUE AND c.agent_id=${target.target} AND a.active`;if(!current||current.email.toLowerCase()!==target.email.toLowerCase())throw Error("Perfil cambiado");}finally{await sql.end();}}catch{redirectUrl.searchParams.set("google","invalid_mia_target");const response=NextResponse.redirect(redirectUrl);response.cookies.delete("bb_google_oauth_mia");response.cookies.delete("bb_google_oauth_state");return response;}
  }
  try {
    const origin = requestOrigin(request);
    const token = await exchangeGoogleCode({ origin, code });
    if (!token.refresh_token) {
      redirectUrl.searchParams.set("google", "missing_refresh_token");
      return NextResponse.redirect(redirectUrl);
    }

    const profile = await getGoogleUserInfo(token.access_token);
    if(target&&profile.email.toLowerCase()!==target.email.toLowerCase())throw Error("Elegí la cuenta de correo configurada para MIA.");
    const { account } = await upsertCrmEmailAccount({
      agentId: target?.target || session.user.id,
      provider: "google-oauth",
      email: profile.email,
      fromName: target ? "MIA · Barrera Brokers" : profile.name || session.user.name || "",
      smtpHost: "gmail.googleapis.com",
      smtpPort: 443,
      smtpSecure: true,
      smtpUser: profile.email,
      smtpPassword: token.refresh_token,
      googleScopes: token.scope || "",
    });

    redirectUrl.searchParams.set("google", account ? "connected" : "error");
    if(target&&account){const sql=miaSalesDb();let control;try{[control]=await sql`SELECT run_id,approved_lead_ids FROM crm_mia_sales_control WHERE id=TRUE`;}finally{await sql.end();}if(!control?.run_id)await startMiaSalesPilot(session.user.id,control?.approved_lead_ids||[]);}
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    redirectUrl.searchParams.set("google", "error");
  }

  const response = NextResponse.redirect(redirectUrl);
  response.cookies.delete("bb_google_oauth_state");
  response.cookies.delete("bb_google_oauth_mia");
  return response;
}
