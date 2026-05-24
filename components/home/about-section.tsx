import Image from "next/image";

const values = [
  {
    title: "Experiencia",
    description:
      "Mas de dos decadas conociendo en profundidad el mercado inmobiliario.",
  },
  {
    title: "Confianza",
    description:
      "Relaciones construidas en transparencia, etica y resultados consistentes.",
  },
  {
    title: "Excelencia",
    description:
      "Atencion personalizada y procesos refinados en cada transaccion.",
  },
];

const team = [
  {
    name: "Maria Barrera",
    role: "CEO & Fundadora",
    image:
      "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&q=90",
  },
  {
    name: "Carlos Rodriguez",
    role: "Director Comercial",
    image:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=600&q=90",
  },
  {
    name: "Laura Martinez",
    role: "Agente Senior",
    image:
      "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=600&q=90",
  },
  {
    name: "Jorge Fernandez",
    role: "Inversiones",
    image:
      "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=600&q=90",
  },
];

export function AboutSection() {
  return (
    <section id="nosotros" className="bg-cream-100 border-t border-ink/15">
      {/* About */}
      <div className="py-20 md:py-28 lg:py-36">
        <div className="container-custom">
          <div className="flex items-baseline justify-between flex-wrap gap-6 pb-12 border-b border-ink/15 mb-16 md:mb-20">
            <div className="flex items-baseline gap-6 md:gap-10">
              <span className="font-display italic font-light text-3xl md:text-4xl text-ink/40">
                (03)
              </span>
              <h2 className="font-display font-light text-4xl md:text-6xl lg:text-7xl tracking-[-0.025em] leading-[1] text-ink">
                <span className="italic">Sobre</span> nosotros
              </h2>
            </div>
            <p className="text-ink/70 leading-relaxed text-base md:text-lg max-w-md">
              Construyendo confianza desde el ano 2000.
            </p>
          </div>

          <div className="grid grid-cols-12 gap-6 md:gap-12">
            {/* Image - 7 cols */}
            <div className="col-span-12 md:col-span-7 order-2 md:order-1">
              <div className="relative aspect-[3/4] md:aspect-[4/5] overflow-hidden bg-cream-300">
                <Image
                  src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1200&q=90"
                  alt="Equipo Barrera Brokers"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 60vw"
                />
              </div>
              <div className="mt-3 flex items-baseline justify-between text-[11px] uppercase tracking-widest text-ink/55">
                <span>(Buenos Aires HQ)</span>
                <span>Est. 2000</span>
              </div>
            </div>

            {/* Text - 4 cols */}
            <div className="col-span-12 md:col-span-4 md:col-start-9 order-1 md:order-2 flex flex-col gap-12">
              <div>
                <p className="text-ink/85 text-lg md:text-xl leading-relaxed mb-5 font-light">
                  En Barrera Brokers somos mas que una inmobiliaria. Somos
                  socios estrategicos en el camino hacia las decisiones
                  patrimoniales mas importantes de tu vida.
                </p>
                <p className="text-ink/65 text-base leading-relaxed">
                  Combinamos conocimiento profundo del mercado, vision
                  estrategica y compromiso genuino con cada cliente.
                </p>
              </div>

              {/* Big stat */}
              <div className="border-t border-ink/15 pt-6">
                <div className="font-display font-light text-7xl md:text-8xl text-ink leading-none tracking-[-0.04em]">
                  +500
                </div>
                <div className="mt-2 text-[11px] uppercase tracking-widest text-ink/60">
                  (Propiedades gestionadas)
                </div>
              </div>

              {/* Values */}
              <div className="border-t border-ink/15 pt-6 space-y-6">
                {values.map((value, index) => (
                  <div key={index} className="flex gap-5">
                    <span className="font-display italic font-light text-lg text-ink/40">
                      ({String(index + 1).padStart(2, "0")})
                    </span>
                    <div>
                      <h3 className="font-display font-light text-xl text-ink mb-1 tracking-tight">
                        {value.title}
                      </h3>
                      <p className="text-sm text-ink/60 leading-relaxed">
                        {value.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Team */}
      <div className="py-20 md:py-28 lg:py-32 bg-cream-50 border-t border-ink/15">
        <div className="container-custom">
          <div className="flex items-baseline justify-between flex-wrap gap-6 pb-12 border-b border-ink/15 mb-16 md:mb-20">
            <div className="flex items-baseline gap-6 md:gap-10">
              <span className="font-display italic font-light text-3xl md:text-4xl text-ink/40">
                (04)
              </span>
              <h2 className="font-display font-light text-4xl md:text-6xl lg:text-7xl tracking-[-0.025em] leading-[1] text-ink">
                <span className="italic">Equipo</span>
              </h2>
            </div>
            <p className="text-ink/70 leading-relaxed text-base md:text-lg max-w-md">
              Profesionales comprometidos con cada cliente y proyecto.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-12">
            {team.map((member, index) => (
              <div key={index} className="group">
                <div className="relative aspect-[3/4] overflow-hidden bg-cream-300 mb-4">
                  <Image
                    src={member.image}
                    alt={member.name}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 25vw"
                  />
                </div>
                <div className="border-t border-ink/15 pt-3">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-display italic font-light text-base text-ink/40">
                      ({String(index + 1).padStart(2, "0")})
                    </span>
                    <h4 className="font-display font-light text-xl md:text-2xl text-ink leading-tight tracking-tight">
                      {member.name}
                    </h4>
                  </div>
                  <p className="text-[11px] uppercase tracking-widest text-ink/55">
                    {member.role}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
