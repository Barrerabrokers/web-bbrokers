import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canManageSiteSettings } from "@/lib/roles";
import { listBlogPosts } from "@/lib/blog-store";
import { BlogEditor } from "@/components/admin/blog-editor";
export const dynamic = "force-dynamic";
export default async function BlogAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || !canManageSiteSettings(session.user.role)) redirect("/admin");
  return <div className="max-w-7xl"><header className="mb-8"><p className="mb-2 text-xs uppercase tracking-wider text-ink/70">Administración</p><h1 className="font-display text-4xl text-ink">Prensa y blog</h1><p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/75">Creá artículos propios para barrerabrokers.com/blog. Los artículos publicados que marques para el inicio aparecerán en el carrusel de Prensa.</p></header><BlogEditor initial={await listBlogPosts(true)} /></div>;
}
