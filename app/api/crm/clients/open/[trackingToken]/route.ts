import { scheduleSalesAnalysis } from "@/lib/ai-sales/schedule";
export const maxDuration=60;
import { NextRequest } from "next/server";
import { registerClientMailEvent } from "@/lib/crm-clients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PIXEL=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/atpX5QAAAAASUVORK5CYII=","base64");

export async function GET(request:NextRequest,{params}:{params:Promise<{trackingToken:string}>}) {
  const {trackingToken}=await params;
  const recorded=trackingToken&&await registerClientMailEvent(trackingToken.replace(/\.png$/i,""),"open",request.headers.get("user-agent")||"").catch(()=>false);
  if(recorded)scheduleSalesAnalysis();
  return new Response(PIXEL,{headers:{"Content-Type":"image/png","Content-Length":String(PIXEL.length),"Cache-Control":"no-store, no-cache, max-age=0, must-revalidate",Pragma:"no-cache",Expires:"0"}});
}
