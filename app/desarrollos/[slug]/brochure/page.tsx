import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { getDevelopmentBySlug } from "@/lib/developments-db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BrochurePage({
  params,
}: {
  params: { slug: string };
}) {
  const development = await getDevelopmentBySlug(params.slug);
  if (!development) notFound();
  if (!development.brochureUrl) notFound();

  return (
    <div className="min-h-screen bg-bone flex flex-col">
      <Header />

      <main className="flex-1 pt-24 pb-12">
        <div className="container-custom">
          {/* Navigation & header */}
          <div className="mb-8">
            <Link
              href={`/desarrollos/${development.slug}`}
              className="inline-flex items-center gap-2 text-ink/60 hover:text-ink text-[11px] uppercase tracking-widest mb-4"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver a {development.name}
            </Link>

            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="font-display font-light text-3xl md:text-5xl tracking-[-0.02em] text-ink">
                  Brochure
                </h1>
                <p className="text-ink/60 mt-2">
                  {development.name} · {development.location}
                </p>
              </div>
              <a
                href={development.brochureUrl}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="btn-primary inline-flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Descargar PDF
              </a>
            </div>
          </div>

          {/* PDF Viewer */}
          <div className="w-full bg-ink/5 border border-ink/10 rounded-xl overflow-hidden">
            {/* Desktop: embedded PDF viewer */}
            <div className="hidden md:block">
              <iframe
                src={`${development.brochureUrl}#toolbar=1&navpanes=0`}
                className="w-full h-[85vh] border-0"
                title={`Brochure - ${development.name}`}
              />
            </div>

            {/* Mobile: link to open/download since iframe PDFs don't work well on mobile */}
            <div className="md:hidden p-10 text-center">
              <FileText className="h-16 w-16 text-accent-700 mx-auto mb-4" />
              <h2 className="font-display font-light text-2xl text-ink mb-2">
                Brochure disponible
              </h2>
              <p className="text-ink/60 text-sm mb-6 max-w-sm mx-auto">
                Tocá el botón para ver o descargar el brochure de{" "}
                {development.name} en formato PDF.
              </p>
              <a
                href={development.brochureUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary inline-flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Ver / Descargar PDF
              </a>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
