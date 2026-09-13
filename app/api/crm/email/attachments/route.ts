import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { randomUUID } from "crypto";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { canManageListings } from "@/lib/roles";
import { getServerSupabase } from "@/lib/supabase";
export const runtime = "nodejs";
const schema = z.object({ name: z.string().min(1).max(255), size: z.number().int().positive().max(10 * 1024 * 1024) });
const extensions = new Set(["pdf","doc","docx","xls","xlsx","csv","txt","ppt","pptx","jpg","jpeg","png","webp","gif"]);
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageListings(session.user.role)) return NextResponse.json({error:"No autorizado"},{status:403});
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({error:"Cada adjunto debe tener contenido y pesar como máximo 10 MB."},{status:400});
  const ext = parsed.data.name.split(".").pop()?.toLowerCase() || "";
  if (!extensions.has(ext)) return NextResponse.json({error:"Formato de adjunto no permitido."},{status:400});
  try {
    const storage = getServerSupabase().storage.from("properties");
    const path = `templates/email-attachments/${randomUUID()}.${ext}`;
    const { data, error } = await storage.createSignedUploadUrl(path);
    if (error || !data) throw new Error("No se pudo preparar la carga del adjunto.");
    return NextResponse.json({path:data.path,token:data.token,url:storage.getPublicUrl(path).data.publicUrl},{headers:{"Cache-Control":"private, no-store"}});
  } catch { return NextResponse.json({error:"No se pudo preparar la carga del adjunto. Volvé a intentar."},{status:500}); }
}
