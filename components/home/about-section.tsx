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
    <section id="nosotros" className="bg-gray-950">
      {/* About */}
      <div className="section-pad">
        <div className="container-custom">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Image */}
            <div className="relative">
              <div className="relative h-[480px] md:h-[560px] overflow-hidden rounded-xl border border-gray-800">
                <Image
                  src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1000&q=90"
                  alt="Equipo Barrera Brokers"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-950/80 to-transparent" />
              </div>
              {/* Floating accent card */}
              <div className="absolute -bottom-6 -right-6 hidden lg:block card p-6 backdrop-blur-md bg-gray-900/90">
                <div className="text-3xl font-semibold tracking-tightest text-accent-300 mb-1">
                  +500
                </div>
                <div className="text-xs text-gray-400 tracking-tight">
                  Propiedades gestionadas
                </div>
              </div>
            </div>

            {/* Content */}
            <div>
              <span className="eyebrow mb-5">Sobre nosotros</span>

              <h2 className="mt-5 text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tightest leading-[1.05] mb-6">
                <span className="text-gradient">Construyendo</span>{" "}
                <span className="text-gradient-accent">confianza</span>{" "}
                <span className="text-gradient">desde el ano 2000.</span>
              </h2>

              <p className="text-gray-400 text-lg leading-relaxed tracking-tight mb-5">
                En Barrera Brokers somos mas que una inmobiliaria. Somos socios
                estrategicos en el camino hacia las decisiones patrimoniales
                mas importantes de tu vida.
              </p>

              <p className="text-gray-400 text-lg leading-relaxed tracking-tight mb-10">
                Combinamos conocimiento profundo del mercado, vision
                estrategica y compromiso genuino con cada cliente, ya sea que
                busques tu primera vivienda o expandir tu portafolio de
                inversiones.
              </p>

              {/* Values */}
              <div className="space-y-4">
                {values.map((value, index) => (
                  <div
                    key={index}
                    className="card p-5 flex gap-5 items-start hover:border-gray-700 transition-colors"
                  >
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-accent/10 border border-accent/30 text-accent-300 text-sm font-semibold tracking-tight">
                      0{index + 1}
                    </div>
                    <div>
                      <h3 className="text-base font-semibold tracking-tight text-gray-50 mb-1">
                        {value.title}
                      </h3>
                      <p className="text-sm text-gray-400 leading-relaxed tracking-tight">
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
      <div className="section-pad border-t border-gray-800">
        <div className="container-custom">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="eyebrow mb-5">Nuestro equipo</span>
            <h2 className="mt-5 text-4xl md:text-5xl font-semibold tracking-tightest leading-[1.05]">
              <span className="text-gradient">Profesionales</span>{" "}
              <span className="text-gradient-accent">comprometidos.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {team.map((member, index) => (
              <div key={index} className="group card-hover overflow-hidden">
                <div className="relative h-72 overflow-hidden">
                  <Image
                    src={member.image}
                    alt={member.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-950/80 via-gray-950/10 to-transparent" />
                </div>
                <div className="p-4">
                  <h4 className="text-base font-semibold tracking-tight text-gray-50">
                    {member.name}
                  </h4>
                  <p className="text-xs text-accent-300 tracking-tight mt-0.5">
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
