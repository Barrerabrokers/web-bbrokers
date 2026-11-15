import { listBlogPosts } from "@/lib/blog-store";
import { getDevelopments } from "@/lib/developments-db";
import { absoluteUrl } from "@/lib/seo";
export const dynamic = "force-dynamic";
function plain(value: string) { return value.replace(/[\r\n\[\]]/g, " ").replace(/\s+/g, " ").trim(); }
export async function GET() {
  const [projects, posts] = await Promise.all([getDevelopments({ visibility: "public" }), listBlogPosts()]);
  const text = [
    "# Barrera Brokers", "", "> Asesoramiento y comercialización de desarrollos y propiedades en la Ciudad de Buenos Aires, Argentina.", "",
    "## Páginas principales", "",
    `- [Barrera Brokers](${absoluteUrl("/")}): presentación de la firma y datos de contacto.`,
    `- [Desarrollos inmobiliarios en Buenos Aires](${absoluteUrl("/desarrollos")}): catálogo público de proyectos.`,
    `- [Inversiones en real estate en Buenos Aires](${absoluteUrl("/inversiones-real-estate-buenos-aires")}): criterios de comparación y preguntas frecuentes.`,
    `- [Guía para invertir en Argentina](${absoluteUrl("/invertir-en-real-estate-argentina")}).`,
    `- [Mapa de desarrollos por barrio](${absoluteUrl("/ciudad-de-buenos-aires")}).`,
    `- [Noticias de real estate en Buenos Aires](${absoluteUrl("/blog")}).`,
    `- [Índice CAC e histórico del costo de construcción](${absoluteUrl("/blog/indice-cac")}): series, variaciones mensuales y fuentes.`,
    `- [Criterio editorial](${absoluteUrl("/blog/criterio-editorial")}).`,
    `- [Feed RSS de noticias](${absoluteUrl("/blog/feed.xml")}).`, "", "## Desarrollos públicos", "",
    ...projects.map(project => `- [${plain(project.name)}](${absoluteUrl(`/desarrollos/${project.slug}`)}): ${plain(project.location)}. ${plain(project.shortDescription || "")}`),
    "", "## Noticias publicadas", "",
    ...posts.slice(0, 30).map(post => `- [${plain(post.title)}](${absoluteUrl(`/blog/${post.slug}`)}): ${plain(post.excerpt)}`),
    "", "## Vigencia de la información", "", "Las fichas son la referencia para ubicación, estado del proyecto y condiciones publicadas. Los precios, la disponibilidad, la financiación y las entregas deben confirmarse con el equipo. Las proyecciones no son rendimientos garantizados. Las noticias identifican sus fuentes cuando corresponden.", "",
  ].join("\n");
  return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600" } });
}
