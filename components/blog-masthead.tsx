import { PUBLIC_NAVIGATION } from "@/lib/public-navigation-links";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function BlogMasthead() {
  return <header className="journal-header">
    <div className="journal-utility"><Link href="/">Volver al sitio</Link><span>Buenos Aires · Real estate</span><Link href="/#contacto">Contactanos <ArrowUpRight size={13} aria-hidden="true" /></Link></div>
    <div className="journal-masthead"><Link href="/blog" aria-label="Barrera Brokers · Portada de Prensa"><span className="journal-brand-initial">B</span>arrera <span className="journal-brand-initial">B</span>rokers</Link><p>Propiedades, ciudad y perspectivas</p></div>
    <nav className="journal-nav" aria-label="Navegación de Prensa">{PUBLIC_NAVIGATION.map(item => <Link key={item.href} href={item.href}>{item.label}</Link>)}<Link href="/blog/indice-cac">Índice CAC</Link></nav>
  </header>;
}
export function BlogFooter() {
  return <footer className="journal-footer"><Link href="/" className="journal-footer-brand"><span className="journal-brand-initial">B</span>arrera <span className="journal-brand-initial">B</span>rokers</Link><p>Una mirada al mercado inmobiliario de Buenos Aires.</p><div><Link href="/blog">Prensa</Link><Link href="/desarrollos">Desarrollos</Link><Link href="/inversiones-real-estate-buenos-aires">Inversiones</Link><Link href="/blog/indice-cac">Índice CAC</Link><Link href="/blog/criterio-editorial">Criterio editorial</Link><a href="/blog/feed.xml">RSS</a><Link href="/#contacto">Contactanos ↗</Link></div></footer>;
}
