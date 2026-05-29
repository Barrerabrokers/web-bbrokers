import Image from "next/image";
import { User } from "lucide-react";
import { getTeamMembers, getFullSiteSettings } from "@/lib/db";

export async function AboutSection() {
  // Fetch settings y team en paralelo (con fallback a [] si la DB falla)
  const [team, settings] = await Promise.all([
    getTeamMembers().catch(() => []),
    getFullSiteSettings(),
  ]);

  // Render del título: si tiene varias palabras, la última en italic
  // (ej. "Una inmobiliaria independiente" → "Una inmobiliaria <em>independiente</em>")
  const titleParts = settings.aboutTitle.trim().split(" ");
  const titleStart = titleParts.slice(0, -1).join(" ");
  const titleLast  = titleParts[titleParts.length - 1] ?? "";

  const values = [
    { no: "01", title: settings.aboutValue1Title, description: settings.aboutValue1Description },
    { no: "02", title: settings.aboutValue2Title, description: settings.aboutValue2Description },
    { no: "03", title: settings.aboutValue3Title, description: settings.aboutValue3Description },
  ];

  // Ciudad sin país para el caption de la imagen
  const city = settings.addressCity.split(",")[0].trim();

  return (
    <section id="nosotros" className="bg-bone text-ink">
      {/* About */}
      <div className="section-pad border-t border-ink/15">
        <div className="container-custom">
          <div className="grid grid-cols-12 gap-6 md:gap-10 lg:gap-16 items-start">
            {/* Imagen 7 cols */}
            <div className="col-span-12 md:col-span-7 order-2 md:order-1">
              <div className="relative aspect-[4/5] overflow-hidden bg-cream-200">
                {settings.aboutImage ? (
                  <Image
                    src={settings.aboutImage}
                    alt={`Equipo ${settings.companyName}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 60vw"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="h-20 w-20 text-ink/15" />
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-baseline justify-between text-[10px] uppercase tracking-widest text-ink/55">
                <span>{city}</span>
                <span>Est. 2000</span>
              </div>
            </div>

            {/* Texto */}
            <div className="col-span-12 md:col-span-4 md:col-start-9 order-1 md:order-2 flex flex-col gap-12">
              <div>
                <div className="flex items-baseline gap-3 mb-6">
                  <span className="font-display italic font-light text-xl text-ink/40">
                    03
                  </span>
                  <p className="text-[11px] uppercase tracking-widest text-accent">
                    {settings.aboutEyebrow}
                  </p>
                </div>

                <h3 className="font-display font-light text-4xl md:text-5xl tracking-[-0.02em] leading-[1] text-ink mb-8">
                  {titleStart && <>{titleStart}{" "}</>}
                  <span className="italic">{titleLast}</span>
                </h3>
                <p className="text-ink/75 text-base md:text-lg leading-relaxed whitespace-pre-line">
                  {settings.aboutDescription}
                </p>
              </div>

              <div className="border-t border-ink/15 pt-6">
                <div className="font-display font-light text-7xl md:text-8xl text-ink leading-none tracking-[-0.04em]">
                  {settings.aboutStatNumber}
                </div>
                <div className="mt-2 text-[10px] uppercase tracking-widest text-ink/60">
                  {settings.aboutStatLabel}
                </div>
              </div>

              <div className="border-t border-ink/15 pt-6 space-y-6">
                {values.map((v) => (
                  <div key={v.no} className="flex gap-5">
                    <span className="font-display italic font-light text-lg text-accent">
                      {v.no}
                    </span>
                    <div>
                      <h4 className="font-display font-light text-xl text-ink mb-1 tracking-tight">
                        {v.title}
                      </h4>
                      <p className="text-sm text-ink/65 leading-relaxed">
                        {v.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Equipo */}
      <div className="section-pad bg-bone-50 border-t border-ink/15">
        <div className="container-custom">
          <div className="grid grid-cols-12 gap-6 mb-12 md:mb-16">
            <div className="col-span-12 md:col-span-1">
              <p className="font-display italic font-light text-xl md:text-2xl text-ink/40">
                04
              </p>
            </div>
            <div className="col-span-12 md:col-span-10 md:col-start-3">
              <p className="text-[11px] uppercase tracking-widest text-ink/50 mb-4">
                Equipo
              </p>
              <h2 className="font-display font-light text-[36px] md:text-[64px] lg:text-[80px] tracking-[-0.025em] leading-[1.02] text-ink">
                Las personas <span className="italic">detras</span> de
                cada operacion.
              </h2>
            </div>
          </div>

          {team.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-12">
              {team.map((member, idx) => (
                <div key={member.id} className="group">
                  <div className="relative aspect-[3/4] overflow-hidden bg-cream-200 mb-4">
                    {member.photo ? (
                      <Image
                        src={member.photo}
                        alt={member.name}
                        fill
                        className="object-cover transition-transform duration-1500 group-hover:scale-[1.04]"
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 25vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-cream-200">
                        <User className="h-16 w-16 text-ink/20" />
                      </div>
                    )}
                  </div>
                  <div className="border-t border-ink/15 pt-3">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="font-display italic font-light text-base text-accent">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <h4 className="font-display font-light text-xl md:text-2xl text-ink leading-tight tracking-tight">
                        {member.name}
                      </h4>
                    </div>
                    <p className="text-[10px] uppercase tracking-widest text-ink/55">
                      {member.title || (member.role === "admin" ? "Administrador" : "Agente")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center">
              <p className="text-ink/55 text-lg">
                Pronto vas a conocer a nuestro equipo.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
