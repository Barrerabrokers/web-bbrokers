import {NextRequest,NextResponse} from "next/server";
import {getServerSession} from "next-auth";
import {z} from "zod";
import {authOptions} from "@/lib/auth";
import {findClientContacts,getClientEmailTemplates,getClientLeadStatuses,getClientLeadSegments,getClientListRecipients,getClientLists,getPrivateClients,importClientsByLeadStatus,importClientsByLeadSegment,markClientEmailInvalid,saveClient} from "@/lib/crm-clients";
export const dynamic="force-dynamic";
const schema=z.object({
  id:z.string().uuid().optional(),leadId:z.string().uuid().nullable().optional(),
  name:z.string().trim().min(1).max(200),email:z.union([z.string().trim().email(),z.literal("")]),
  phone:z.string().trim().max(50),purchase:z.string().trim().max(500),notes:z.string().trim().max(5000),subscribed:z.boolean(),emailStatus:z.enum(["active","invalid"]).optional(),
}).strict().refine(d=>Boolean(d.email||d.phone),"Ingresá un correo o teléfono.");
export async function GET(request:NextRequest) {
  const session=await getServerSession(authOptions);
  if(session?.user.role!=="admin")return NextResponse.json({error:"Solo administradores."},{status:403});
  const q=(request.nextUrl.searchParams.get("q")||"").slice(0,100);
  const listName=(request.nextUrl.searchParams.get("list")||"").trim().slice(0,120);
  try {
    if(request.nextUrl.searchParams.get("contacts")==="1")return NextResponse.json({contacts:q.length>=2?await findClientContacts(q):[]},{headers:{"Cache-Control":"no-store"}});
    if(request.nextUrl.searchParams.get("statuses")==="1")return NextResponse.json({statuses:await getClientLeadStatuses(),segments:await getClientLeadSegments()},{headers:{"Cache-Control":"no-store"}});
    if(request.nextUrl.searchParams.get("templates")==="1")return NextResponse.json({templates:await getClientEmailTemplates()},{headers:{"Cache-Control":"no-store"}});
    if(request.nextUrl.searchParams.get("lists")==="1")return NextResponse.json({lists:await getClientLists()},{headers:{"Cache-Control":"no-store"}});
    if(request.nextUrl.searchParams.get("recipients")==="1")return NextResponse.json({recipients:listName?await getClientListRecipients(listName):[]},{headers:{"Cache-Control":"no-store"}});
    const page=Math.max(0,Math.min(100000,Number(request.nextUrl.searchParams.get("page"))||0));
    return NextResponse.json(await getPrivateClients(q,Math.floor(page),listName),{headers:{"Cache-Control":"no-store"}});
  }catch{return NextResponse.json({error:"No se pudo cargar el listado."},{status:500});}
}
export async function POST(request:NextRequest) {
  const session=await getServerSession(authOptions);
  if(session?.user.role!=="admin")return NextResponse.json({error:"Solo administradores."},{status:403});
  const raw=await request.json().catch(()=>null);
  const importParsed=z.object({action:z.literal("import-status"),status:z.string().trim().min(1).max(120),confirmed:z.literal(true)}).strict().safeParse(raw);
  if(importParsed.success) {
    try {return NextResponse.json({ok:true,...await importClientsByLeadStatus(importParsed.data.status,session.user.id)});}
    catch{return NextResponse.json({error:"No se pudieron incorporar los contactos de ese estado."},{status:500});}
  }
  const segmentParsed=z.object({action:z.literal("import-segment"),status:z.string().trim().max(120),development:z.string().trim().max(200),occupation:z.string().trim().max(200).optional().default(""),listName:z.string().trim().min(1).max(120),confirmed:z.literal(true)}).strict().refine(d=>Boolean(d.status||d.development||d.occupation)).safeParse(raw);
  if(segmentParsed.success) {
    try {return NextResponse.json({ok:true,...await importClientsByLeadSegment(segmentParsed.data,session.user.id)});}
    catch{return NextResponse.json({error:"No se pudo crear la lista con esos filtros."},{status:500});}
  }
  if(raw?.action==="import-segment")return NextResponse.json({error:"Elegí una actividad, estado o desarrollo y completá el nombre de la lista (hasta 120 caracteres)."},{status:400});
  const invalidParsed=z.object({action:z.literal("mark-email-invalid"),id:z.string().uuid(),reason:z.string().trim().max(500).optional()}).strict().safeParse(raw);
  if(invalidParsed.success) {
    try {await markClientEmailInvalid(invalidParsed.data.id,session.user.id,invalidParsed.data.reason||undefined);return NextResponse.json({ok:true});}
    catch{return NextResponse.json({error:"No se pudo excluir este correo de marketing."},{status:500});}
  }
  const parsed=schema.safeParse(raw);
  if(!parsed.success)return NextResponse.json({error:"Revisá nombre, correo y teléfono. Completá al menos un medio de contacto."},{status:400});
  try{await saveClient(parsed.data,session.user.id);return NextResponse.json({ok:true});}
  catch(e){return NextResponse.json({error:(e as {code?:string}).code==="23505"?"Ese contacto ya está en una lista de marketing.":"No se pudo guardar el contacto."},{status:409});}
}
