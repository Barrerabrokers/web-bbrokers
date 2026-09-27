import { NextRequest,NextResponse } from "next/server";
import { z } from "zod";
import { processPendingClientCampaigns,resumeClientCampaign } from "@/lib/crm-client-campaigns";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=300;

export async function GET(request:NextRequest) {
  const secret=process.env.CRON_SECRET;
  if(!secret||request.headers.get("authorization")!==`Bearer ${secret}`)
    return NextResponse.json({error:"No autorizado."},{status:401});
  return NextResponse.json(await processPendingClientCampaigns(12));
}

export async function POST(request:NextRequest) {
  const secret=process.env.CRM_CAMPAIGN_RETRY_SECRET||process.env.CRON_SECRET;
  if(!secret||request.headers.get("authorization")!==`Bearer ${secret}`)
    return NextResponse.json({error:"No autorizado."},{status:401});
  const parsed=z.object({campaignId:z.string().uuid(),limit:z.number().int().min(1).max(25).optional()}).safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json({error:"Solicitud inválida."},{status:400});
  const result=await resumeClientCampaign(parsed.data.campaignId,parsed.data.limit);
  return NextResponse.json(result,{status:("error" in result&&result.error)&&result.sent===0?502:200});
}
