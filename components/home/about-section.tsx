import Image from "next/image";

const stats = [
  { value: "25+", label: "Anos de experiencia" },
  { value: "500+", label: "Propiedades gestionadas" },
  { value: "1.2k+", label: "Clientes satisfechos" },
  { value: "98%", label: "Tasa de cierre" },
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
    <section id="nosotros" className="bg-white">
      {/* By the Numbers */}
      <div className="py-24 md:py-32 bg-ink-700 text-white">
        <div className="container-custom">
          <div className="text-center max-w-3xl mx-auto mb-16 md:mb-20">
            <span className="inline-flex items-center gap-3 text-[11px] font-medium tracking-widest uppercase text-accent-300 mb-6">
              <span className="h-px w-10 bg-accent-300" />
              By the Numbers
            </span>
            <h2 className="lp-h2 text-white mt-6">
              Nuestra <span className="italic">trayectoria</span>
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-12">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="text-center md:border-r last:border-r-0 border-white/15 px-2"
              >
                <div className="font-display font-light text-[64px] md:text-[88px] lg:text-[112px] text-white leading-none tracking-[-0.04em]">
                  {stat.value}
                </div>
                <div className="mt-3 text-[10px] md:text-[11px] uppercase tracking-widest text-white/65">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* About content */}
      <div className="py-24 md:py-32 lg:py-40 bg-white">
        <div className="container-custom">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Image */}
            <div className="relative">
              <div className="relative aspect-[4/5] overflow-hidden bg-cream-200">
                <Image
                  src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1200&q=90"
                  alt="Equipo Barrera Brokers"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
              <div className="absolute bottom-6 left-6 right-6 md:left-auto md:right-auto md:-bottom-10 md:-left-10 lg:bottom-10 lg:-left-10 bg-white p-6 md:p-8 max-w-sm shadow-xl">
                <p className="text-[10px] uppercase tracking-widest text-accent mb-2">
                  Premium Real Estate
                </p>
                <p className="font-display text-xl md:text-2xl text-ink leading-tight">
                  Mas de dos decadas de experiencia, conocimiento profundo del
                  mercado y un equipo dedicado.
                </p>
              </div>
            </div>

            {/* Text */}
            <div className="lg:pl-8">
              <span className="eyebrow mb-6">Sobre nosotros</span>
              <h2 className="lp-h2 mt-6 mb-8">
                Tu socio en cada
                <br />
                <span className="italic">decision patrimonial.</span>
              </h2>

              <div className="space-y-5 text-ink/75 text-base md:text-lg leading-relaxed mb-10">
                <p>
                  En Barrera Brokers somos mas que una inmobiliaria. Somos
                  socios estrategicos en el camino hacia las decisiones
                  patrimoniales mas importantes de tu vida.
                </p>
                <p>
                  Combinamos conocimiento profundo del mercado, vision
                  estrategica y compromiso genuino con cada cliente, ya sea que
                  busques tu primera vivienda o expandir tu portafolio de
                  inversiones.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-6 pt-8 border-t border-ink/10">
                <div>
                  <div className="font-display text-4xl md:text-5xl text-ink leading-none">
                    25+
                  </div>
                  <div className="mt-2 text-[10px] uppercase tracking-widest text-ink/55">
                    Anos en el mercado
                  </div>
                </div>
                <div>
                  <div className="font-display text-4xl md:text-5xl text-ink leading-none">
                    +500
                  </div>
                  <div className="mt-2 text-[10px] uppercase tracking-widest text-ink/55">
                    Propiedades vendidas
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Team */}
      <div className="py-24 md:py-32 bg-cream-100 border-t border-ink/10">
        <div className="container-custom">
          <div className="text-center max-w-3xl mx-auto mb-16 md:mb-20">
            <span className="eyebrow mb-6">Meet the Team</span>
            <h2 className="lp-h2 mt-6">
              Nuestro <span className="italic">equipo</span>
            </h2>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
            {team.map((member) => (
              <div key={member.name} className="group">
                <div className="relative aspect-[3/4] overflow-hidden bg-cream-200 mb-4">
                  <Image
                    src={member.image}
                    alt={member.name}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 25vw"
                  />
                </div>
                <h4 className="font-display text-2xl text-ink leading-tight mb-1">
                  {member.name}
                </h4>
                <p className="text-[11px] uppercase tracking-widest text-accent">
                  {member.role}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
