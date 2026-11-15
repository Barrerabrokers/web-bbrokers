import type { BlogPost } from "@/lib/blog";
import { absoluteUrl, SITE_NAME } from "@/lib/seo";
export function xmlEscape(value: string) {
  return value.replace(/[<>&"']/g, char => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[char]!);
}
export function blogRss(posts: BlogPost[]) {
  const published = posts.filter(post => post.status === "published" && post.publishedAt);
  const newest = published.reduce<string | null>((latest, post) => !latest || post.updatedAt > latest ? post.updatedAt : latest, null);
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${SITE_NAME}: noticias de real estate en Buenos Aires</title><link>${absoluteUrl("/blog")}</link><description>Desarrollos inmobiliarios, inversiones y actualidad del mercado de la Ciudad de Buenos Aires.</description><language>es-AR</language><atom:link href="${absoluteUrl("/blog/feed.xml")}" rel="self" type="application/rss+xml"/>${newest ? `<lastBuildDate>${new Date(newest).toUTCString()}</lastBuildDate>` : ""}${published.slice(0, 50).map(post => { const url = xmlEscape(absoluteUrl(`/blog/${post.slug}`)); return `<item><title>${xmlEscape(post.title)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid><description>${xmlEscape(post.excerpt)}</description><pubDate>${new Date(post.publishedAt!).toUTCString()}</pubDate></item>`; }).join("")}</channel></rss>`;
}
