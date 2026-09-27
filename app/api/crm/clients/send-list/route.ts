import {NextRequest,NextResponse} from "next/server";
import {getServerSession} from "next-auth";
import {z} from "zod";
import {authOptions} from "@/lib/auth";
import {clientDb,ensureClients,getClientEmailTemplate} from "@/lib/crm-clients";
export const dynamic="force-dynamic";
export const maxDuration=30;
const schema=z.object({listName:z.string().trim().min(1).max(120),campaignId:z.string().uuid(),templateId:z.string().uuid(),
  confirmed:z.literal(true),confirmList:z.string().trim().min(1).max(120)}).strict();
export async function POST(request:NextRequest) {
  const session=await getServerSession(authOptions);
  if(session?.user.role!=="admin")return NextResponse.json({error:"Solo administradores."},{status:403});
  const parsed=schema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success||parsed.data.confirmList!==parsed.data.listName)return NextResponse.json({error:"Confirmá el nombre exacto de la lista antes de enviar."},{status:400});
  const data=parsed.data,template=await getClientEmailTemplate(parsed.data.templateId);
  if(!template)return NextResponse.json({error:"Elegí una plantilla de correo existente."},{status:400});
  const sql=clientDb();
  try {
    await ensureClients(sql);
    const [sender]=await sql`SELECT email FROM agents WHERE id=${session.user.id}`;
    const recipients=await sql`INSERT INTO crm_client_mail_history(id,client_id,agent_id,recipient,subject,body,status,campaign_id,tracking_token,list_name,template_id,owner_agent_id,reply_to_email)
      SELECT gen_random_uuid(),c.id,${session.user.id},c.email,${template.subject},${template.body},'uncertain',${data.campaignId},gen_random_uuid(),${data.listName},${template.id},l.assigned_agent_id,COALESCE(a.email,${String(sender?.email||"")})
      FROM crm_private_clients c LEFT JOIN crm_leads l ON l.id=c.lead_id LEFT JOIN agents a ON a.id=l.assigned_agent_id
      WHERE c.list_name=${data.listName} AND c.subscribed AND c.email<>'' AND c.email_status='active'
      ON CONFLICT(campaign_id,client_id) WHERE campaign_id IS NOT NULL DO NOTHING RETURNING id`;
    if(!recipients.length)return NextResponse.json({error:"No hay destinatarios autorizados nuevos en esta lista, o esta campaña ya fue procesada."},{status:409});
    return NextResponse.json({ok:true,queued:recipients.length,campaignId:data.campaignId},{status:202});
  }catch(error){console.error("CRM client campaign error:",error);return NextResponse.json({error:"No se pudo procesar la campaña. Revisá Enviados antes de repetirla."},{status:500});}
  finally{await sql.end();}
}
