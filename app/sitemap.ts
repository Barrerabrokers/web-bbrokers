import type { MetadataRoute } from "next";
import { listBlogPosts } from "@/lib/blog-store";
import { getDevelopments } from "@/lib/developments-db";
import { getProperties } from "@/lib/db";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [developments, properties, posts] = await Promise.all([
    getDevelopments({ visibility: "public" }),
    getProperties({ status: "disponible", visibility: "public" }),
    listBlogPosts(),
  ]);
  // Static pages have no reliable edit timestamp. Omit lastmod rather than report every crawl as an edit.
  const staticRoutes = ["/", "/desarrollos", "/inversiones-real-estate-buenos-aires", "/invertir-en-real-estate-argentina", "/ciudad-de-buenos-aires", "/propiedades", "/blog", "/blog/criterio-editorial", "/contacto"];
  return [
    ...staticRoutes.map(path => ({ url: absoluteUrl(path) })),
    { url: absoluteUrl("/blog/indice-cac"), lastModified: new Date("2026-10-28T00:00:00-03:00") },
    ...posts.map(post => ({ url: absoluteUrl(`/blog/${post.slug}`), lastModified: new Date(post.updatedAt) })),
    ...developments.map(dev => ({ url: absoluteUrl(`/desarrollos/${dev.slug}`), ...(dev.updatedAt ? { lastModified: new Date(dev.updatedAt) } : {}) })),
    ...properties.map(property => ({ url: absoluteUrl(`/propiedades/${property.id}`), ...(property.updatedAt ? { lastModified: new Date(property.updatedAt) } : {}) })),
  ];
}
