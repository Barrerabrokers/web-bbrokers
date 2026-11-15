import { z } from "zod";

export type BlogPost = {
  id: string; slug: string; title: string; excerpt: string; image: string; body: string;
  status: "draft" | "published" | "archived"; featured: boolean; author: string;
  sourceUrl: string; sourceName: string; gallery: string[];
  publishedAt: string | null; createdAt: string; updatedAt: string;
};
export function blogSlug(title: string) {
  return title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100).replace(/-$/, "");
}
const imageUrl = z.string().trim().max(2048).refine(value => {
  if (!value) return true;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password && url.hostname.includes("."); } catch { return false; }
}, "La imagen debe ser un enlace https válido.");
export const blogInputSchema = z.object({
  title: z.string().trim().min(3, "Escribí un título de al menos 3 caracteres.").max(200),
  excerpt: z.string().trim().max(500), image: imageUrl,
  body: z.string().trim().max(80000),
  status: z.enum(["draft", "published", "archived"]), featured: z.boolean(),
  sourceUrl: imageUrl.optional(), sourceName: z.string().trim().max(120).optional(),
  gallery: z.array(imageUrl).max(20).transform(values => [...new Set(values.filter(Boolean))]).refine(values => values.length <= 6, "Podés agregar hasta 6 imágenes adicionales.").optional(),
}).superRefine((post, ctx) => {
  if (!blogSlug(post.title)) ctx.addIssue({ code: "custom", path: ["title"], message: "El título debe incluir letras o números." });
  if (post.status !== "published") return;
  for (const [field, message] of [["excerpt", "Completá la bajada antes de publicar."], ["image", "Agregá una imagen antes de publicar."], ["body", "Escribí el contenido antes de publicar."]] as const) {
    if (!post[field]) ctx.addIssue({ code: "custom", path: [field], message });
  }
});
export type BlogInput = z.infer<typeof blogInputSchema>;
export function blogDate(date: string | null) {
  return date ? new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(date)) : "Borrador";
}
export function blogReadMinutes(body: string) { return Math.max(1, Math.ceil(body.trim().split(/\s+/).length / 200)); }
export function safeBlogHref(href: string) {
  if (/^\/(?!\/)/.test(href) && !/[\\\u0000-\u0020]/.test(href)) return href;
  try { const url = new URL(href); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.toString() : null; } catch { return null; }
}

export function blogVideo(href: string): { kind: "embed" | "file"; src: string } | null {
  const safe = safeBlogHref(href);
  if (!safe || !safe.startsWith("https://")) return null;
  const url = new URL(safe);
  const host = url.hostname.replace(/^www\./, "");
  if (["youtube.com", "m.youtube.com", "youtu.be", "youtube-nocookie.com"].includes(host)) {
    const id = host === "youtu.be" ? url.pathname.slice(1) : url.pathname === "/watch" ? url.searchParams.get("v") : url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)\/?$/)?.[1];
    if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) return { kind: "embed", src: `https://www.youtube-nocookie.com/embed/${id}` };
  }
  if (["vimeo.com", "player.vimeo.com"].includes(host)) {
    const match = url.pathname.match(/^\/(?:video\/)?(\d+)(?:\/([a-zA-Z0-9]+))?\/?$/);
    if (match) {
      const hash = url.searchParams.get("h") || match[2];
      return { kind: "embed", src: `https://player.vimeo.com/video/${match[1]}${hash ? `?h=${encodeURIComponent(hash)}` : ""}` };
    }
  }
  return /\.(mp4|webm|ogg)$/i.test(url.pathname) ? { kind: "file", src: safe } : null;
}

export function blogVideoUrl(block: string) {
  const text = block.trim();
  const match = text.match(/^\[video\]\((https:\/\/[^\s]+)\)$/i);
  const url = match ? match[1] : text;
  return blogVideo(url) ? url : null;
}

export function blogArticleContent(body: string) {
  const blocks = body.split(/\n\s*\n/).filter(Boolean);
  const index = blocks.findIndex(block => blogVideoUrl(block) !== null);
  if (index < 0) return { videoUrl: null, body };
  return { videoUrl: blogVideoUrl(blocks[index]), body: blocks.filter((_, i) => i !== index).join("\n\n") };
}
