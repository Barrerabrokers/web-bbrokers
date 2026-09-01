import Link from "next/link";
import { ArrowUpRight, Newspaper } from "lucide-react";
import { getFullSiteSettings } from "@/lib/db";

type PressItem = {
  url: string;
  host: string;
  label: string;
};

function parsePressLinks(value?: string): PressItem[] {
  const seen = new Set<string>();

  return (value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        const url = new URL(line);
        return url;
      } catch {
        try {
          return new URL(`https://${line}`);
        } catch {
          return null;
        }
      }
    })
    .filter((url): url is URL => Boolean(url))
    .filter((url) => {
      const normalized = url.toString();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .map((url) => {
      const host = url.hostname.replace(/^www\./, "");
      const readablePath = url.pathname
        .split("/")
        .filter(Boolean)
        .slice(-1)[0]
        ?.replace(/[-_]+/g, " ")
        .trim();

      return {
        url: url.toString(),
        host,
        label: readablePath || "Ver nota completa",
      };
    });
}

export async function PressSection() {
  const settings = await getFullSiteSettings();
  const items = parsePressLinks(settings.pressLinks);

  if (!items.length) return null;

  return (
    <section id="prensa" className="bg-[#F8F5EF] py-16 text-[#151415] md:py-20">
      <div className="container-custom">
        <div className="mb-8 grid gap-5 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:items-end">
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-[#3A1D17]/55">
              Prensa
            </p>
            <h2 className="mt-3 font-display text-4xl font-light leading-[0.92] tracking-[-0.035em] md:text-5xl">
              Barrera Brokers en medios.
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-relaxed text-[#151415]/62 md:justify-self-end">
            Notas, entrevistas y menciones sobre desarrollos, inversión
            inmobiliaria y oportunidades en Buenos Aires.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item, index) => (
            <Link
              key={item.url}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-[28px] border border-[#151415]/10 bg-white/58 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-[#151415]/25 hover:bg-white"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#151415] text-[#F8F5EF]">
                  <Newspaper className="h-4 w-4" />
                </div>
                <span className="text-[10px] uppercase tracking-[0.18em] text-[#151415]/35">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>

              <p className="mt-6 text-[10px] uppercase tracking-[0.2em] text-[#3A1D17]/55">
                {item.host}
              </p>
              <h3 className="mt-2 font-display text-2xl font-light leading-[1] tracking-[-0.02em] text-[#151415]">
                {item.label}
              </h3>
              <div className="mt-5 inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-[#151415]/60 transition-colors group-hover:text-[#151415]">
                Ver nota
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
