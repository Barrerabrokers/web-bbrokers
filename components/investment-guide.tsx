import Link from "next/link";
import { INVESTMENT_QUESTIONS } from "@/lib/investment-guide";
import { serializeJsonLd } from "@/lib/seo-structured-data";

export function InvestmentGuide() {
  return <section className="border-t border-ink/15 bg-bone py-16 text-ink md:py-24" aria-labelledby="investment-guide-heading">
    <div className="container-custom max-w-5xl">
      <h2 id="investment-guide-heading" className="max-w-3xl font-display text-4xl font-light leading-tight md:text-5xl">Qué revisar antes de invertir en Buenos Aires</h2>
      <p className="mt-6 max-w-[70ch] text-base leading-relaxed">Una decisión inmobiliaria empieza por información comparable. Estas preguntas te ayudan a ordenar la consulta sobre un desarrollo, su ubicación y sus condiciones.</p>
      <div className="mt-10 divide-y divide-ink/15 border-y border-ink/15">{INVESTMENT_QUESTIONS.map(item => <details key={item.question} className="group py-5"><summary className="cursor-pointer py-2 text-lg font-medium outline-offset-4">{item.question}</summary><p className="mt-3 max-w-[70ch] pb-2 text-base leading-relaxed">{item.answer}</p></details>)}</div>
      <nav aria-label="Guías y actualidad inmobiliaria" className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm underline underline-offset-4"><Link href="/ciudad-de-buenos-aires">Mapa de desarrollos por barrio</Link><Link href="/invertir-en-real-estate-argentina">Guía para invertir en Argentina</Link><Link href="/blog">Noticias de real estate de Buenos Aires</Link></nav>
    </div>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: INVESTMENT_QUESTIONS.map(item => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })) }) }} />
  </section>;
}
