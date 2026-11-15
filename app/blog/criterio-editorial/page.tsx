import Link from "next/link";
import type { Metadata } from "next";
import { BlogMasthead, BlogFooter } from "@/components/blog-masthead";
import { localizePublicMetadata } from "@/lib/i18n/metadata";
import { absoluteUrl } from "@/lib/seo";
import "../journal.css";
export async function generateMetadata(): Promise<Metadata> {
  return localizePublicMetadata({ title: "Sobre nuestras noticias y criterio editorial", description: "Quién publica el Blog de Barrera Brokers, cómo distinguir fuentes, análisis inmobiliario y proyectos comercializados en Buenos Aires.", alternates: { canonical: absoluteUrl("/blog/criterio-editorial") } });
}
export default function EditorialPage() {
  return <div className="journal"><div className="journal-shell"><BlogMasthead /><main><article className="journal-article">
    <header className="journal-article-header"><Link href="/blog" className="journal-text-link">← Noticias de real estate</Link><h1>Quiénes publicamos y cómo leer nuestras noticias</h1><p className="journal-deck">Una mirada de Barrera Brokers sobre los desarrollos, las inversiones y la transformación de la Ciudad de Buenos Aires.</p></header>
    <div className="journal-reading editorial-copy">
      <h2>La publicación</h2><p>El Blog es una publicación de Barrera Brokers, firma que asesora y comercializa desarrollos y propiedades en Buenos Aires. Reúne noticias del sector, información sobre barrios y proyectos, y perspectivas vinculadas con la actividad inmobiliaria. <Link href="/#nosotros">Conocé al equipo de Barrera Brokers</Link>.</p>
      <h2>Fuentes y análisis</h2><p>Cuando una nota parte de información publicada por una universidad, un organismo u otro medio, la fuente enlazada permite consultar el documento original. Las conclusiones sobre el posible impacto inmobiliario son una interpretación de Barrera Brokers; deben distinguirse de los hechos y las cifras atribuidos a esa fuente.</p>
      <h2>Fechas y vigencia</h2><p>Cada artículo muestra su fecha de publicación y, cuando corresponde, la de actualización. Los precios, la disponibilidad, las condiciones de financiación y las fechas de entrega pueden cambiar. Para una operación concreta, consultá la ficha del desarrollo y confirmá las condiciones vigentes con el equipo.</p>
      <h2>Relación con los proyectos</h2><p>Las notas pueden mencionar desarrollos comercializados por Barrera Brokers. Ese vínculo comercial forma parte del contexto de nuestra publicación. Las proyecciones de valorización, alquiler o reventa son estimaciones sujetas a sus supuestos y al comportamiento del mercado.</p>
      <h2>Consultas y correcciones</h2><p>Si encontrás un dato que requiere una aclaración o actualización, <Link href="/#contacto">contactanos</Link> indicando el título de la nota y la información a revisar.</p>
      <nav className="journal-article-cta" aria-label="Más información"><Link href="/blog" className="journal-text-link">Noticias de Buenos Aires ↗</Link><br /><Link href="/inversiones-real-estate-buenos-aires" className="journal-text-link">Inversiones en real estate ↗</Link></nav>
    </div></article></main><BlogFooter /></div></div>;
}
