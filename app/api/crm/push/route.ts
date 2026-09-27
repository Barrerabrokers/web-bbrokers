import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { randomUUID } from "crypto";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { canManageListings } from "@/lib/roles";
import { pushDb, ensurePush, validPushEndpoint, deliverPush } from "@/lib/crm-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const settings = z.object({ email_opens: z.boolean(), tasks: z.boolean(), meetings: z.boolean(), meeting_minutes: z.union([z.literal(60),z.literal(720),z.literal(1440)]) });
const input = z.object({
  action: z.enum(["status","subscribe","settings","test","delete"]),
  endpoint: z.string().max(4096).refine(validPushEndpoint),
  keys: z.object({ p256dh: z.string().regex(/^[A-Za-z0-9_-]+={0,2}$/).refine(v=>Buffer.from(v,"base64url").length===65), auth: z.string().regex(/^[A-Za-z0-9_-]+={0,2}$/).refine(v=>Buffer.from(v,"base64url").length===16) }).optional(),
  settings: settings.optional(),
});
const reply = (value: object, status=200) => NextResponse.json(value,{status,headers:{"Cache-Control":"no-store"}});

export async function GET() {
  const session=await getServerSession(authOptions);
  if(!session||!canManageListings(session.user.role))return reply({error:"No autorizado."},403);
  const sql=pushDb();
  try { const config=await ensurePush(sql); return reply({publicKey:config.public_key}); }
  catch {return reply({error:"No se pudo preparar las notificaciones."},500);}
  finally {await sql.end();}
}

export async function POST(request:NextRequest) {
  if(request.headers.get("origin")!==new URL(request.url).origin)return reply({error:"Origen no autorizado."},403);
  const session=await getServerSession(authOptions);
  if(!session||!canManageListings(session.user.role))return reply({error:"No autorizado."},403);
  const parsed=input.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return reply({error:"Suscripción inválida."},400);
  const data=parsed.data, agentId=session.user.id, sql=pushDb();
  try {
    const config=await ensurePush(sql);
    const [sub]=await sql`SELECT * FROM crm_push_subscriptions WHERE endpoint=${data.endpoint} AND agent_id=${agentId}`;
    if(data.action==="status")return reply({subscribed:!!sub,settings:sub?{email_opens:sub.email_opens,tasks:sub.tasks,meetings:sub.meetings,meeting_minutes:sub.meeting_minutes}:null});
    if(data.action==="subscribe"){
      if(!data.keys)return reply({error:"Faltan las claves del dispositivo."},400);
      // Never transfer an existing endpoint between accounts. The browser must replace it.
      const saved=await sql`INSERT INTO crm_push_subscriptions(id,agent_id,endpoint,p256dh,auth)
        SELECT ${randomUUID()},${agentId},${data.endpoint},${data.keys.p256dh},${data.keys.auth}
        WHERE (SELECT COUNT(*) FROM crm_push_subscriptions WHERE agent_id=${agentId})<20
        ON CONFLICT(endpoint) DO UPDATE SET p256dh=EXCLUDED.p256dh,auth=EXCLUDED.auth
        WHERE crm_push_subscriptions.agent_id=EXCLUDED.agent_id RETURNING id`;
      if(!saved.length)return reply({error:"No se pudo registrar este dispositivo. Desactivá la suscripción anterior o revisá el límite de 20 dispositivos."},409);
      return reply({subscribed:true});
    }
    if(!sub)return reply({error:"Este dispositivo no está activado para tu cuenta."},404);
    if(data.action==="delete"){
      await sql`DELETE FROM crm_push_subscriptions WHERE id=${sub.id} AND agent_id=${agentId}`;
      return reply({success:true});
    }
    if(data.action==="settings"){
      if(!data.settings)return reply({error:"Faltan las preferencias."},400);
      const s=data.settings;
      await sql`UPDATE crm_push_subscriptions SET email_opens=${s.email_opens},tasks=${s.tasks},meetings=${s.meetings},meeting_minutes=${s.meeting_minutes} WHERE id=${sub.id} AND agent_id=${agentId}`;
      return reply({success:true});
    }
    const reserved=await sql`UPDATE crm_push_subscriptions SET last_test_at=NOW() WHERE id=${sub.id}
      AND (last_test_at IS NULL OR last_test_at<NOW()-INTERVAL '1 minute') RETURNING id`;
    if(!reserved.length)return reply({error:"Esperá un minuto antes de enviar otra prueba."},429);
    try {
      await deliverPush(sub as {endpoint:string;p256dh:string;auth:string},config as {public_key:string;private_key:string},{title:"Notificaciones BB CRM",body:"Este dispositivo está listo para recibir avisos del CRM.",href:"/admin/crm",tag:"crm-test"});
      return reply({success:true});
    }catch(error){
      const code=(error as {statusCode?:number}).statusCode;
      if(code===404||code===410){await sql`DELETE FROM crm_push_subscriptions WHERE id=${sub.id}`;return reply({error:"La suscripción venció. Desactivá y volvé a activar las notificaciones."},410);}
      return reply({error:"El servicio no aceptó la prueba. Intentá nuevamente."},502);
    }
  }catch {return reply({error:"No se pudieron guardar las notificaciones."},500);}
  finally {await sql.end();}
}
