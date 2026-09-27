import {NextRequest,NextResponse} from "next/server";
import {getServerSession} from "next-auth";
import {z} from "zod";
import {authOptions} from "@/lib/auth";
import {getClientCampaignReport,getClientCampaigns} from "@/lib/crm-clients";

export const dynamic="force-dynamic";

export async function GET(request:NextRequest) {
  const session=await getServerSession(authOptions);
  if(session?.user.role!=="admin")return NextResponse.json({error:"Solo administradores."},{status:403});
  try {
    const campaignId=request.nextUrl.searchParams.get("campaignId");
    if(!campaignId)return NextResponse.json({campaigns:await getClientCampaigns()},{headers:{"Cache-Control":"no-store"}});
    const parsed=z.string().uuid().safeParse(campaignId);
    if(!parsed.success)return NextResponse.json({error:"Campaña inválida."},{status:400});
    const report=await getClientCampaignReport(parsed.data);
    return report?NextResponse.json({report},{headers:{"Cache-Control":"no-store"}}):NextResponse.json({error:"No encontramos la campaña."},{status:404});
  } catch(error) {
    console.error("CRM campaign report error:",error);
    return NextResponse.json({error:"No se pudo cargar el informe de campañas. Intentá actualizar la página."},{status:503});
  }
}
