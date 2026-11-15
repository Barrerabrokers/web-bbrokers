import { cache } from "react";
import { randomUUID } from "crypto";
import { getSharedDatabase, releaseSharedDatabase } from "@/lib/database-pool";
import { blogSlug, type BlogInput, type BlogPost } from "@/lib/blog";

function post(row: any): BlogPost {
  const iso = (value: any) => value ? new Date(value).toISOString() : null;
  return { id: row.id, slug: row.slug, title: row.title, excerpt: row.excerpt, image: row.image,
    sourceUrl: row.source_url || "", sourceName: row.source_name || "", gallery: Array.isArray(row.gallery) ? row.gallery : [],
    body: row.body, status: row.status, featured: row.featured, author: row.author,
    publishedAt: iso(row.published_at), createdAt: iso(row.created_at)!, updatedAt: iso(row.updated_at)! };
}
export async function listBlogPosts(admin = false, featuredOnly = false): Promise<BlogPost[]> {
  const sql = getSharedDatabase();
  try {
    const rows = await sql`SELECT * FROM blog_posts WHERE (${admin} OR status='published') AND (${!featuredOnly} OR featured) ORDER BY published_at DESC NULLS LAST, created_at DESC`;
    return rows.map(post);
  } finally { await releaseSharedDatabase(sql); }
}
export const getPublishedBlogPost = cache(async (slug: string): Promise<BlogPost | null> => {
  const sql = getSharedDatabase();
  try { const [row] = await sql`SELECT * FROM blog_posts WHERE slug=${slug} AND status='published'`; return row ? post(row) : null; }
  finally { await releaseSharedDatabase(sql); }
});
export async function saveBlogPost(input: BlogInput, id?: string, expectedUpdatedAt?: string) {
  const sql = getSharedDatabase();
  try {
    if (id) {
      if (!expectedUpdatedAt) throw new Error("BLOG_CONFLICT");
      const [row] = await sql`UPDATE blog_posts SET title=${input.title}, excerpt=${input.excerpt}, image=${input.image}, body=${input.body}, status=${input.status}, featured=${input.featured}, source_url=CASE WHEN ${input.sourceUrl===undefined} THEN source_url ELSE ${input.sourceUrl||""} END, source_name=CASE WHEN ${input.sourceName===undefined} THEN source_name ELSE ${input.sourceName||""} END, gallery=CASE WHEN ${input.gallery===undefined} THEN gallery ELSE ${sql.json(input.gallery||[])} END, published_at=CASE WHEN ${input.status}='published' THEN COALESCE(published_at,NOW()) ELSE published_at END, updated_at=GREATEST(clock_timestamp(),updated_at+INTERVAL '1 millisecond') WHERE id=${id} AND updated_at=${expectedUpdatedAt}::timestamptz RETURNING *`;
      if (!row) throw new Error("BLOG_CONFLICT");
      return post(row);
    }
    const newId = randomUUID(), slug = `${blogSlug(input.title)}-${newId.slice(0, 8)}`;
    const [row] = await sql`INSERT INTO blog_posts(id,slug,title,excerpt,image,body,status,featured,source_url,source_name,gallery,published_at) VALUES(${newId},${slug},${input.title},${input.excerpt},${input.image},${input.body},${input.status},${input.featured},${input.sourceUrl||""},${input.sourceName||""},${sql.json(input.gallery||[])},CASE WHEN ${input.status}='published' THEN NOW() ELSE NULL END) RETURNING *`;
    return post(row);
  } finally { await releaseSharedDatabase(sql); }
}
