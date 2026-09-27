import {NextRequest,NextResponse} from "next/server";
import {getServerSession} from "next-auth";
import {z} from "zod";
import {authOptions} from "@/lib/auth";
import {clientDb,ensureClients} from "@/lib/crm-clients";
import {newsletterHasPlaceholders} from "@/lib/crm-clients-content";
import {sendPrivateClientEmail} from "@/lib/crm-email-sender";
export const dynamic="force-dynamic";
export const maxDuration=60;
export async function POST(request:NextRequest) {
  const session=await getServerSession(authOptions);
  if(session?.user.role!=="admin")return NextResponse.json({error:"Solo administradores."},{status:403});
  const parsed=z.object({clientId:z.string().uuid(),requestId:z.string().uuid(),
    subject:z.string().trim().min(1).max(200).refine(s=>!/[\r\n]/.test(s)),body:z.string().trim().min(1).max(20000),
    confirmed:z.literal(true)}).strict().safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json({error:"Revisá el correo y confirmá el envío."},{status:400});
  const data=parsed.data;
  if(newsletterHasPlaceholders(data.subject,data.body))return NextResponse.json({error:"Reemplazá los textos entre corchetes y las variables antes de enviar."},{status:400});
  const footer="Si preferís no recibir estas novedades, respondé BAJA y dejaremos de enviártelas.";
  const body=data.body.includes(footer)?data.body:data.body+"\n\n"+footer;
  const sql=clientDb();
  try {
    await ensureClients(sql);
    const claim=await sql.begin(async tx=>{
      const [client]=await tx`SELECT email,subscribed FROM crm_private_clients WHERE id=${data.clientId} FOR UPDATE`;
      if(!client?.email || !client.subscribed)return {error:"El cliente debe tener correo y autorización para recibir novedades."};
      const [attempt]=await tx`INSERT INTO crm_client_mail_history(id,client_id,agent_id,recipient,subject,body,status)
        VALUES(${data.requestId},${data.clientId},${session.user.id},${client.email},${data.subject},${body},'sending')
        ON CONFLICT(id) DO NOTHING RETURNING id`;
      if(!attempt)return {error:"Este envío ya fue procesado o está en curso. No se enviará otra vez."};
      return {email:String(client.email)};
    });
    if("error" in claim)return NextResponse.json({error:claim.error},{status:409});
    try {
      await sendPrivateClientEmail({agentId:session.user.id,email:claim.email,subject:data.subject,body});
      await sql`UPDATE crm_client_mail_history SET status='sent',sent_at=NOW() WHERE id=${data.requestId}`;
      return NextResponse.json({ok:true});
    }catch{
      await sql`UPDATE crm_client_mail_history SET status='uncertain' WHERE id=${data.requestId}`;
      return NextResponse.json({error:"No se pudo confirmar el envío. Revisá Enviados en tu correo y la conexión de Correo de CRM antes de intentar nuevamente; no se reintentó automáticamente."},{status:502});
    }
  }catch{return NextResponse.json({error:"No se pudo procesar el envío. Revisá Enviados antes de repetirlo."},{status:500});}
  finally{await sql.end();}
}
