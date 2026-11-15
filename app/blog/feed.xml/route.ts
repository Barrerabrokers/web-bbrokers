import { listBlogPosts } from "@/lib/blog-store";
import { blogRss } from "@/lib/blog-feed";
export const dynamic = "force-dynamic";
export async function GET() {
  return new Response(blogRss(await listBlogPosts()), { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
}
