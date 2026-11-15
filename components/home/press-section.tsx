import Link from "next/link";
import { listBlogPosts } from "@/lib/blog-store";
import { PressCarousel } from "@/components/home/press-carousel";
import { getFullSiteSettings } from "@/lib/db";

import { parsePressLinks } from "@/lib/press-links";

export async function PressSection() {
  const [settings, posts] = await Promise.all([getFullSiteSettings(), listBlogPosts(false, true).catch(() => [])]);
  const items = posts.length ? posts.map(post => ({ title: post.title, label: post.title, image: post.image, url: `/blog/${post.slug}`, host: "Barrera Brokers" })) : parsePressLinks(settings.pressLinks).map(item => ({ ...item, url: "/blog#en-los-medios" }));


  return (
    <section id="prensa" className="relative overflow-hidden bg-[#070707] py-20 text-[#f8f5ef] md:py-28 lg:py-36">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_18%,rgba(216,196,175,0.16),transparent_28%),linear-gradient(180deg,#151415_0%,#070707_62%,#151415_100%)]" />
      <div className="container-custom relative z-10">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
          <div>
            <p className="mb-5 text-[11px] uppercase tracking-[0.28em] text-[#d8c4af]/70">
              Prensa
            </p>
            <h2 className="max-w-3xl font-display text-[clamp(2.8rem,6.5vw,6rem)] font-light leading-[0.92] tracking-[-0.04em]">
              Prensa y novedades.
            </h2>
          </div>
          <p className="max-w-xl text-base leading-relaxed text-[#f8f5ef]/75 md:text-lg lg:justify-self-end">
            Artículos y novedades de Barrera Brokers sobre desarrollos,
            barrios y mercado inmobiliario en Buenos Aires.
          </p>
        </div>
      </div>
      <PressCarousel items={items} />
      <div className="container-custom relative z-10 mt-8"><Link href="/blog" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/30 px-6 text-sm text-white transition-colors hover:bg-white/10">Ver todas las publicaciones ↗</Link></div>
    </section>
  );
}
