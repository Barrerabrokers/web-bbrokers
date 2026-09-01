import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildGoogleOAuthUrl } from "@/lib/google-oauth";
import { canManageListings } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requestOrigin(request: NextRequest) {
  return process.env.NEXTAUTH_URL || new URL(request.url).origin;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageListings(session.user.role)) {
    return NextResponse.redirect(new URL("/login?from=/admin/crm/correo", request.url));
  }

  const state = randomBytes(24).toString("hex");
  const origin = requestOrigin(request);
  const url = buildGoogleOAuthUrl({ origin, state });
  const response = NextResponse.redirect(url);
  response.cookies.set("bb_google_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: origin.startsWith("https://"),
    maxAge: 10 * 60,
    path: "/",
  });
  return response;
}
