import Image from "next/image";

const values = [
  {
    no: "01",
    title: "Discrecion",
    description:
      "Operaciones cuidadas, mantenidas con confidencialidad y atencion al detalle.",
  },
  {
    no: "02",
    title: "Continuidad",
    description:
      "Mas de dos decadas conociendo el mercado y las personas que lo conforman.",
  },
  {
    no: "03",
    title: "Acompanamiento",
    description:
      "Cada propiedad es una decision patrimonial. Nos involucramos en cada paso.",
  },
];

const team = [
  {
    name: "Maria Barrera",
    role: "Fundadora",
    image:
      "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&q=90",
  },
  {
    name: "Carlos Rodriguez",
    role: "Director",
    image:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=600&q=90",
  },
  {
    name: "Laura Martinez",
    role: "Senior",
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
    <section id="nosotros" className="bg-bone text-ink">
      {/* Connection / About manifesto */}
      <div className="section-pad border-t border-ink/15">
        <div className="container-custom">
          <div className="grid grid-cols-12 gap-6 mb-16 md:mb-20">
            <div className="col-span-12 md:col-span-1">
              <p className="font-display italic font-light text-xl md:text-2xl text-ink/40">
                Connection
              </p>
            </div>
            <div className="col-span-12 md:col-span-10 md:col-start-3">
              <p className="font-display font-light text-2xl md:text-4xl lg:text-[44px] leading-[1.15] tracking-tight text-ink">
                Una vez completada la operacion, esta continua independientemente,
                llevando consigo su punto de origen sin representarlo
                directamente. Estos lugares y propiedades son moldeados por un
                pequeno grupo de personas trabajando a traves de ubicaciones
                y disciplinas. Su involucramiento es{" "}
                <span className="italic text-accent-600">continuo y colaborativo.</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* About: foto + texto + valores */}
      <div className="section-pad bg-bone-50">
        <div className="container-custom">
          <div className="grid grid-cols-12 gap-6 md:gap-10 lg:gap-16 items-start">
            {/* Imagen 7 cols */}
            <div className="col-span-12 md:col-span-7 order-2 md:order-1">
              <div className="relative aspect-[4/5] overflow-hidden bg-cream-200">
                <Image
                  src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1200&q=90"
                  alt="Equipo Barrera Brokers"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 60vw"
                />
              </div>
              <div className="mt-3 flex items-baseline justify-between text-[10px] uppercase tracking-widest text-ink/55">
                <span>Buenos Aires HQ</span>
                <span>Est. 2000</span>
              </div>
            </div>

            {/* Texto 5 cols */}
            <div className="col-span-12 md:col-span-4 md:col-start-9 order-1 md:order-2 flex flex-col gap-12">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-accent mb-5">
                  About
                </p>
                <h3 className="font-display font-light text-4xl md:text-5xl tracking-[-0.02em] leading-[1] text-ink mb-8">
                  Una organizacion <span className="italic">independiente</span>
                </h3>
                <p className="text-ink/75 text-base md:text-lg leading-relaxed">
                  Coordinamos espacios distribuidos, operaciones y desarrollo
                  inmobiliario en Buenos Aires y el AMBA, manteniendo cada
                  proyecto con la atencion y discrecion que merece.
                </p>
              </div>

              <div className="border-t border-ink/15 pt-6">
                <div className="font-display font-light text-7xl md:text-8xl text-ink leading-none tracking-[-0.04em]">
                  +500
                </div>
                <div className="mt-2 text-[10px] uppercase tracking-widest text-ink/60">
                  Propiedades coordinadas
                </div>
              </div>

              <div className="border-t border-ink/15 pt-6 space-y-6">
                {values.map((v) => (
                  <div key={v.no} className="flex gap-5">
                    <span className="font-display italic font-light text-lg text-accent">
                      ({v.no})
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

      {/* People */}
      <div className="section-pad border-t border-ink/15">
        <div className="container-custom">
          <div className="grid grid-cols-12 gap-6 mb-12 md:mb-16">
            <div className="col-span-12 md:col-span-1">
              <p className="font-display italic font-light text-xl md:text-2xl text-ink/40">
                People
              </p>
            </div>
            <div className="col-span-12 md:col-span-10 md:col-start-3">
              <h2 className="font-display font-light text-[36px] md:text-[64px] lg:text-[80px] tracking-[-0.025em] leading-[1.02] text-ink">
                Un grupo pequeno, trabajando{" "}
                <span className="italic">a traves de ubicaciones.</span>
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-12">
            {team.map((member, idx) => (
              <div key={member.name} className="group">
                <div className="relative aspect-[3/4] overflow-hidden bg-cream-200 mb-4">
                  <Image
                    src={member.image}
                    alt={member.name}
                    fill
                    className="object-cover transition-transform duration-1500 group-hover:scale-[1.04]"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 25vw"
                  />
                </div>
                <div className="border-t border-ink/15 pt-3">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-display italic font-light text-base text-accent">
                      ({String(idx + 1).padStart(2, "0")})
                    </span>
                    <h4 className="font-display font-light text-xl md:text-2xl text-ink leading-tight tracking-tight">
                      {member.name}
                    </h4>
                  </div>
                  <p className="text-[10px] uppercase tracking-widest text-ink/55">
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
