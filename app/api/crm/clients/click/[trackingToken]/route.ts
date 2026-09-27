import { scheduleSalesAnalysis } from "@/lib/ai-sales/schedule";
export const maxDuration=60;
import { NextRequest,NextResponse } from "next/server";
import { registerClientMailEvent } from "@/lib/crm-clients";
import { safeTrackedUrl } from "@/lib/email-engagement";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(request:NextRequest,{params}:{params:Promise<{trackingToken:string}>}) {
  const {trackingToken}=await params;
  const target=safeTrackedUrl(request.nextUrl.searchParams.get("url")||"");
  if(!target)return NextResponse.redirect(new URL("/",request.url));
  const recorded=await registerClientMailEvent(trackingToken,"click",request.headers.get("user-agent")||"",target).catch(()=>false);
  if(recorded)scheduleSalesAnalysis();
  return NextResponse.redirect(target,302);
}
