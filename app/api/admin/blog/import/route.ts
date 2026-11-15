import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canManageSiteSettings } from "@/lib/roles";
import { importArticleDraft } from "@/lib/blog-import";
import { saveBlogPost } from "@/lib/blog-store";
import { z, ZodError } from "zod";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  const session=await getServerSession(authOptions);
  if(!session||!canManageSiteSettings(session.user.role))return NextResponse.json({error:"No autorizado"},{status:401});
  try {
    const {url}=z.object({url:z.string().trim().url().max(2048).refine(value=>value.startsWith("https://"),"Usá el enlace https del artículo.")}).parse(await request.json());
    const input=await importArticleDraft(url);
    const post=await saveBlogPost({...input,status:"draft"});
    return NextResponse.json({post,message:post.image ? "Borrador creado. Revisá texto, fechas e imágenes antes de publicarlo." : "Borrador creado. El medio no entregó una portada: agregá una imagen y revisá el texto antes de publicar."},{headers:{"Cache-Control":"no-store"}});
  } catch(error) {
    if(error instanceof ZodError)return NextResponse.json({error:"No se pudo preparar un artículo válido. Revisá el enlace o volvé a intentarlo."},{status:400});
    const raw=error instanceof Error?error.message:"";
    const safe=/^El artículo|^No se pudo leer|^La IA agregó|^La IA no devolvió|^Ingresá|^Usá|^El enlace|^El portal|^La página/.test(raw)?raw:"No se pudo generar el borrador ahora. Probá nuevamente o completá el artículo manualmente.";
    return NextResponse.json({error:safe},{status:422});
  }
}
