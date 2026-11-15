import { miaSalesDb } from "@/lib/mia-sales-store";
import { signMiaMailTarget } from "@/lib/mia-sales-oauth";
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
  const miaSales=request.nextUrl.searchParams.get("miaSales")==="1";
  const session = await getServerSession(authOptions);
  if (!session || !canManageListings(session.user.role)) {
    return NextResponse.redirect(new URL("/login?from="+encodeURIComponent(miaSales?"/admin/crm/panel-agentes?miaPilot=1":"/admin/crm/correo"), request.url));
  }

  if(miaSales&&session.user.role!=="admin")return NextResponse.json({error:"Solo administradores."},{status:403});
  let target:{agent_id:string;email:string}|undefined;
  if(miaSales){const sql=miaSalesDb();try{[target]=await sql`SELECT c.agent_id,a.email FROM crm_mia_sales_control c JOIN agents a ON a.id=c.agent_id WHERE c.id=TRUE AND a.active`;}finally{await sql.end();}if(!target)return NextResponse.json({error:"Configurá el perfil de MIA."},{status:409});}
  const state = randomBytes(24).toString("hex");
  const origin = requestOrigin(request);
  const url = buildGoogleOAuthUrl({ origin, state, scopes:miaSales?["openid","email","profile","https://www.googleapis.com/auth/gmail.send","https://www.googleapis.com/auth/gmail.readonly"]:undefined });
  const response = NextResponse.redirect(url);
  response.cookies.set("bb_google_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: origin.startsWith("https://"),
    maxAge: 10 * 60,
    path: "/",
  });
  if(target)response.cookies.set("bb_google_oauth_mia",signMiaMailTarget(session.user.id,target.agent_id,target.email,state),{httpOnly:true,sameSite:"lax",secure:origin.startsWith("https://"),maxAge:600,path:"/"});
  else response.cookies.delete("bb_google_oauth_mia");
  return response;
}
