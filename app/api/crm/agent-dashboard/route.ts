import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { canManageListings } from "@/lib/roles";
import { CRM_LEAD_STATUS_VALUES } from "@/lib/crm-statuses";
import { dashboardScope } from "@/lib/crm-agent-dashboard";
import { getAgentDashboard } from "@/lib/crm-agent-dashboard-db";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store, max-age=0"};
export async function GET(request:NextRequest) {
  const session=await getServerSession(authOptions);
  if(!session || !canManageListings(session.user.role)) return NextResponse.json({error:"No autorizado"},{status:403,headers});
  const parsed=z.union([z.string().uuid(),z.literal("all")]).optional().safeParse(request.nextUrl.searchParams.get("agent")||undefined);
  if(!parsed.success)return NextResponse.json({error:"Agente no válido."},{status:400,headers});
  const status=request.nextUrl.searchParams.get("status")||"all";
  if(status!=="all"&&!CRM_LEAD_STATUS_VALUES.includes(status as typeof CRM_LEAD_STATUS_VALUES[number]))return NextResponse.json({error:"Estado no válido."},{status:400,headers});
  let scope:string|null;
  try{scope=dashboardScope(session.user,parsed.data);}catch{return NextResponse.json({error:"Solo podés consultar tu propio dashboard."},{status:403,headers});}
  try{return NextResponse.json(await getAgentDashboard(scope,session.user.role==="admin",new Date(),status),{headers});}
  catch(error){console.error("Dashboard de agente",error instanceof Error?error.message:"Error de datos");return NextResponse.json({error:"No se pudo cargar el dashboard. Reintentá en unos instantes."},{status:500,headers});}
}
