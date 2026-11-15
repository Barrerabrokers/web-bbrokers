import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canManageSiteSettings } from "@/lib/roles";
import { blogInputSchema } from "@/lib/blog";
import { listBlogPosts, saveBlogPost } from "@/lib/blog-store";
import { z, ZodError } from "zod";
import { revalidatePath } from "next/cache";
export const dynamic = "force-dynamic";
async function authorized() { const session = await getServerSession(authOptions); return !!session && canManageSiteSettings(session.user.role); }
export async function GET() {
  if (!await authorized()) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try { return NextResponse.json({ posts: await listBlogPosts(true) }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ error: "No se pudieron cargar los artículos." }, { status: 500 }); }
}
export async function POST(request: NextRequest) {
  if (!await authorized()) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    const body = await request.json();
    const input = blogInputSchema.parse(body);
    const id = body.id ? z.string().uuid().parse(body.id) : undefined;
    const expected = body.expectedUpdatedAt ? z.string().datetime().parse(body.expectedUpdatedAt) : undefined;
    const post = await saveBlogPost(input, id, expected);
    for (const path of ["/", "/blog", `/blog/${post.slug}`, "/sitemap.xml"]) revalidatePath(path);
    return NextResponse.json({ post });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Revisá el contenido enviado." }, { status: 400 });
    if (error instanceof Error && error.message === "BLOG_CONFLICT") return NextResponse.json({ error: "Otra persona modificó este artículo. Conservá tus cambios y recargá la lista antes de guardar." }, { status: 409 });
    console.error("No se pudo guardar el artículo de Prensa");
    return NextResponse.json({ error: "No se pudo guardar. Tu contenido sigue en el editor." }, { status: 500 });
  }
}
