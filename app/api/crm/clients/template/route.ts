import {NextRequest,NextResponse} from "next/server";
import {getServerSession} from "next-auth";
import {z} from "zod";
import {authOptions} from "@/lib/auth";
import {getClientDraft,saveClientDraft} from "@/lib/crm-clients";
export const dynamic="force-dynamic";
export async function GET() {
  const session=await getServerSession(authOptions);
  if(session?.user.role!=="admin")return NextResponse.json({error:"Solo administradores."},{status:403});
  try{return NextResponse.json({draft:await getClientDraft()},{headers:{"Cache-Control":"no-store"}});}
  catch{return NextResponse.json({error:"No se pudo cargar la plantilla."},{status:500});}
}
export async function POST(request:NextRequest) {
  const session=await getServerSession(authOptions);
  if(session?.user.role!=="admin")return NextResponse.json({error:"Solo administradores."},{status:403});
  const parsed=z.object({subject:z.string().trim().min(1).max(200).refine(s=>!/[\r\n]/.test(s)),body:z.string().trim().min(1).max(20000)}).strict().safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json({error:"Completá asunto y contenido de la plantilla."},{status:400});
  try{await saveClientDraft(parsed.data,session.user.id);return NextResponse.json({ok:true});}
  catch{return NextResponse.json({error:"No se pudo guardar la plantilla."},{status:500});}
}
