import { BlogShare } from "@/components/blog-share";
import { blogPostSchema, breadcrumbSchema, serializeJsonLd } from "@/lib/seo-structured-data";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { BlogMasthead, BlogFooter } from "@/components/blog-masthead";
import "../journal.css";
import { BlogVideo } from "@/components/blog-video";
import { BlogBody } from "@/components/blog-body";
import { getPublishedBlogPost } from "@/lib/blog-store";
import { blogArticleContent, blogDate, blogReadMinutes } from "@/lib/blog";
import { absoluteUrl } from "@/lib/seo";
import { localizePublicMetadata } from "@/lib/i18n/metadata";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPublishedBlogPost((await params).slug);
  if (!post) return { title: "Artículo no encontrado", robots: { index: false, follow: false } };
  return localizePublicMetadata({ title: post.title, description: post.excerpt, alternates: { canonical: absoluteUrl(`/blog/${post.slug}`), types: { "application/rss+xml": absoluteUrl("/blog/feed.xml") } }, openGraph: { title: post.title, description: post.excerpt, type: "article", publishedTime: post.publishedAt!, modifiedTime: post.updatedAt, images: [{ url: post.image }, ...(post.gallery || []).map(url => ({url}))], url: absoluteUrl(`/blog/${post.slug}`) }, twitter: { card: "summary_large_image", title: post.title, description: post.excerpt, images: [post.image] } });
}
export default async function BlogArticle({ params }: Props) {
  const post = await getPublishedBlogPost((await params).slug);
  if (!post) notFound();
  const content = blogArticleContent(post.body);
  const schema = [blogPostSchema(post), breadcrumbSchema([{ name: "Inicio", path: "/" }, { name: "Noticias de real estate en Buenos Aires", path: "/blog" }, { name: post.title, path: `/blog/${post.slug}` }])];
  return <div className="journal"><div className="journal-shell"><BlogMasthead /><main>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }} />
    <article className="journal-article">
      <header className="journal-article-header">
        <Link href="/blog" className="journal-text-link"><ArrowLeft size={14} aria-hidden="true" />Prensa</Link>
        <p className="journal-kicker">Barrera Brokers · Perspectivas</p><h1>{post.title}</h1>
        <p className="journal-deck">{post.excerpt}</p><div className="journal-byline"><span>{post.author === "Barrera Brokers" ? <Link href="/#nosotros">{post.author}</Link> : post.author}</span><p><time dateTime={post.publishedAt || undefined}>{blogDate(post.publishedAt)}</time> · {blogReadMinutes(post.body)} min de lectura</p>{post.publishedAt && blogDate(post.updatedAt) !== blogDate(post.publishedAt) && <p>Actualizado: <time dateTime={post.updatedAt}>{blogDate(post.updatedAt)}</time></p>}</div>
        <BlogShare title={post.title} url={absoluteUrl(`/blog/${post.slug}`)} />
      </header>
      {content.videoUrl ? <BlogVideo url={content.videoUrl} title={post.title} poster={post.image} featured /> : <figure className="journal-article-cover"><img src={post.image} alt={post.title} width={1200} height={675} fetchPriority="high" /><figcaption>{post.sourceName ? `Fuente: ${post.sourceName}` : post.author}</figcaption></figure>}
      <div className="journal-reading"><BlogBody body={content.body} />{(post.gallery || []).length > 0 && <div className="journal-gallery">{post.gallery.filter(src => src !== post.image).map((src,index) => <img key={src} src={src} alt={`${post.title} · Imagen ${index+2}`} width={1200} height={900} loading="lazy" />)}</div>}{post.sourceUrl && <p className="journal-source">Síntesis elaborada a partir de información publicada por {post.sourceName || "el medio original"}. <a href={post.sourceUrl} target="_blank" rel="noopener noreferrer">Leer la fuente original ↗</a></p>}
      <BlogShare title={post.title} url={absoluteUrl(`/blog/${post.slug}`)} />
      <aside className="journal-article-cta"><h2>La próxima oportunidad, en Buenos Aires.</h2><p>Conocé nuestros proyectos y consultá sus condiciones vigentes con nuestro equipo.</p><Link href="/#contacto" className="journal-text-link">Consultar con Barrera Brokers <ArrowUpRight size={15} aria-hidden="true" /></Link></aside><Link href="/blog" className="journal-text-link"><ArrowLeft size={14} aria-hidden="true" />Volver a Prensa</Link></div>
    </article>
  </main><BlogFooter /></div></div>;
}
