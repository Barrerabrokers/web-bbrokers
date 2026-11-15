import { CAC_HISTORY, cacNumber, cacPercent, cacPeriod } from "@/lib/cac";
import { serializeJsonLd } from "@/lib/seo-structured-data";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { BlogMasthead, BlogFooter } from "@/components/blog-masthead";
import "./journal.css";
import "./indice-cac/cac.css";
import { listBlogPosts } from "@/lib/blog-store";
import { blogDate, blogReadMinutes } from "@/lib/blog";
import { getFullSiteSettings } from "@/lib/db";
import { parsePressLinks } from "@/lib/press-links";
import { absoluteUrl } from "@/lib/seo";
import { localizePublicMetadata } from "@/lib/i18n/metadata";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return localizePublicMetadata({ title: "Prensa: noticias de real estate en Buenos Aires", description: "Noticias y análisis del mercado inmobiliario de CABA: desarrollos, inversiones, barrios y transformación urbana. La mirada de Barrera Brokers.", alternates: { canonical: absoluteUrl("/blog"), types: { "application/rss+xml": absoluteUrl("/blog/feed.xml") } }, openGraph: { title: "Noticias de real estate en Buenos Aires | Barrera Brokers", description: "Desarrollos, inversiones y actualidad inmobiliaria de la Ciudad de Buenos Aires.", url: absoluteUrl("/blog"), type: "website" } });
}
export default async function BlogPage() {
  const [posts, settings] = await Promise.all([listBlogPosts(), getFullSiteSettings()]);
  const media = parsePressLinks(settings.pressLinks).filter(item => item.url);
  const [lead, ...rest] = posts;
  const cac = CAC_HISTORY.rows[CAC_HISTORY.rows.length - 1];
  const schema = { "@context": "https://schema.org", "@type": "CollectionPage", "@id": absoluteUrl("/blog#webpage"), name: "Noticias de real estate en Buenos Aires", url: absoluteUrl("/blog"), inLanguage: "es-AR", isPartOf: { "@id": absoluteUrl("/#website") }, about: { "@type": "Place", name: "Ciudad de Buenos Aires, Argentina" }, mainEntity: { "@type": "Blog", "@id": absoluteUrl("/blog#publication"), name: "Noticias de real estate en Buenos Aires", publisher: { "@id": absoluteUrl("/#organization") }, blogPost: posts.map(post => ({ "@type": "BlogPosting", "@id": absoluteUrl(`/blog/${post.slug}#article`), url: absoluteUrl(`/blog/${post.slug}`), headline: post.title, datePublished: post.publishedAt, dateModified: post.updatedAt })) } };
  return <div className="journal">
    <div className="journal-shell"><BlogMasthead />
    <main id="contenido">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }} />
      <div className="journal-section-heading"><h1>Noticias de real estate en Buenos Aires</h1><p>Actualidad y análisis de desarrollos, inversiones y barrios de la Ciudad de Buenos Aires.</p></div>
      <aside className="cac-pin" aria-label="Consulta permanente del índice CAC"><div><span>Consulta permanente</span><h2><Link href="/blog/indice-cac">Índice CAC · Costo de la construcción</Link></h2><p>{cacPeriod(cac.period)}: {cacNumber(cac.general)} puntos · {cacPercent(cac.generalMonthly)} mensual. Datos, componentes e histórico desde 2011.</p></div><Link href="/blog/indice-cac" className="cac-primary-link">Consultar índice e histórico ↗</Link></aside>
      <section id="publicaciones" className="journal-edition" aria-label="Publicaciones de Barrera Brokers">
        {lead ? <>
          <article className="journal-lead">
            <div className="journal-lead-copy"><p className="journal-kicker">Barrera Brokers</p><h2><Link href={`/blog/${lead.slug}`}>{lead.title}</Link></h2><p className="journal-deck">{lead.excerpt}</p><p className="journal-meta">{blogDate(lead.publishedAt)} · {blogReadMinutes(lead.body)} min de lectura</p><Link href={`/blog/${lead.slug}`} className="journal-text-link">Leer artículo <ArrowUpRight size={15} aria-hidden="true" /></Link></div>
            <Link href={`/blog/${lead.slug}`} tabIndex={-1} aria-hidden="true" className="journal-lead-image"><img src={lead.image} alt="" width={1200} height={900} fetchPriority="high" /></Link>
          </article>
          {rest.length > 0 && <div className="journal-news-grid">{rest.map(post => <article key={post.id} className="journal-story">
            <Link href={`/blog/${post.slug}`} tabIndex={-1} aria-hidden="true">{post.image && <img src={post.image} alt="" width={1200} height={750} loading="lazy" />}</Link><p className="journal-kicker">Barrera Brokers</p><h2><Link href={`/blog/${post.slug}`}>{post.title}</Link></h2><p className="journal-story-deck">{post.excerpt}</p><p className="journal-meta">{blogDate(post.publishedAt)} · {blogReadMinutes(post.body)} min</p>
          </article>)}</div>}
        </> : <div className="journal-opening"><div><p className="journal-kicker">Nuestra publicación</p><h2>Una mirada propia sobre la ciudad y sus oportunidades.</h2><p className="journal-deck">Estamos preparando nuestras primeras notas sobre el mercado inmobiliario de Buenos Aires.</p></div><aside><h3>El próximo capítulo</h3><p>Actualidad, proyectos y perspectivas de Barrera Brokers, reunidos en un solo lugar.</p><Link href="/desarrollos" className="journal-text-link">Conocé nuestros desarrollos <ArrowUpRight size={15} aria-hidden="true" /></Link></aside></div>}
      </section>
      <section id="en-los-medios" className="journal-media">
        <div className="journal-section-heading"><h2>En los medios</h2><p>Notas y lecturas seleccionadas. Cada enlace abre la publicación original.</p></div>
        {media.length > 0 ? <div className="journal-news-grid">{media.map((item,index) => <article key={`${item.url}-${index}`} className="journal-story"><a href={item.url} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true">{item.image && <img src={item.image} alt="" width={1200} height={750} loading="lazy" />}</a><p className="journal-kicker">{item.host}</p><h3><a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a></h3><a href={item.url} target="_blank" rel="noopener noreferrer" className="journal-text-link" aria-label={`Leer en ${item.host}: ${item.title}`}>Leer en {item.host} <ArrowUpRight size={14} aria-hidden="true" /></a></article>)}</div> : <p className="journal-empty">Próximamente compartiremos nuevas lecturas y apariciones en medios.</p>}
      </section>
    </main><BlogFooter /></div>
  </div>;
}
