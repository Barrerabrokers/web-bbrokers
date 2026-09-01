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

  try {
    const origin = requestOrigin(request);
    const token = await exchangeGoogleCode({ origin, code });
    if (!token.refresh_token) {
      redirectUrl.searchParams.set("google", "missing_refresh_token");
      return NextResponse.redirect(redirectUrl);
    }

    const profile = await getGoogleUserInfo(token.access_token);
    const { account } = await upsertCrmEmailAccount({
      agentId: session.user.id,
      provider: "google-oauth",
      email: profile.email,
      fromName: profile.name || session.user.name || "",
      smtpHost: "gmail.googleapis.com",
      smtpPort: 443,
      smtpSecure: true,
      smtpUser: profile.email,
      smtpPassword: token.refresh_token,
      googleScopes: token.scope || "",
    });

    redirectUrl.searchParams.set("google", account ? "connected" : "error");
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    redirectUrl.searchParams.set("google", "error");
  }

  const response = NextResponse.redirect(redirectUrl);
  response.cookies.delete("bb_google_oauth_state");
  return response;
}
