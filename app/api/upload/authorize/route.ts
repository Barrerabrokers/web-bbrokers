import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase";
import { canManageListings } from "@/lib/roles";
import { getMobileUploadSessionFiles } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema=z.object({
  path:z.string().min(1).max(240).regex(/^[a-zA-Z0-9_/-]+\.[a-zA-Z0-9]+$/).refine(p=>!p.startsWith('/')&&!p.includes('..')&&!p.includes('//')),
  size:z.number().int().positive().max(50*1024*1024),
  sessionId:z.string().uuid().optional(),
});
export async function POST(request:NextRequest){
  if(request.headers.get('origin')!==request.nextUrl.origin)return NextResponse.json({error:'Origen no autorizado.'},{status:403});
  const parsed=schema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json({error:'Archivo inválido.'},{status:400});
  const {path,size,sessionId}=parsed.data;
  const ext=path.split('.').pop()!.toLowerCase();
  const media=['jpg','jpeg','png','webp','gif','mp4','mov','m4v','webm'];
  if(![...media,'pdf','xls','xlsx','csv'].includes(ext))return NextResponse.json({error:'Formato no permitido.'},{status:400});
  try {
    if(sessionId){
      const mobile=await getMobileUploadSessionFiles(sessionId);
      if(mobile.expired||mobile.error||!mobile.files||mobile.files.length>=100||!path.startsWith('mobile-')||path.includes('/')||!media.includes(ext))return NextResponse.json({error:'Enlace de carga inválido o vencido.'},{status:403});
    }else{
      const session=await getServerSession(authOptions);
      if(!session||!canManageListings(session.user.role))return NextResponse.json({error:'Iniciá sesión para subir archivos.'},{status:401});
    }
    if(size>50*1024*1024)return NextResponse.json({error:'Archivo demasiado grande.'},{status:400});
    const storage=getServerSupabase().storage.from('properties');
    const {data,error}=await storage.createSignedUploadUrl(path,{upsert:false});
    if(error||!data)return NextResponse.json({error:'No se pudo autorizar la carga.'},{status:500});
    return NextResponse.json({path:data.path,token:data.token},{headers:{'Cache-Control':'private, no-store'}});
  }catch{return NextResponse.json({error:'No se pudo preparar la carga.'},{status:500});}
}
