import Image from "next/image";

const values = [
  {
    title: "Experiencia",
    description: "Más de dos décadas conociendo en profundidad el mercado inmobiliario.",
  },
  {
    title: "Confianza",
    description: "Relaciones construidas en transparencia, ética y resultados consistentes.",
  },
  {
    title: "Excelencia",
    description: "Atención personalizada y procesos refinados en cada transacción.",
  },
];

const team = [
  {
    name: "María Barrera",
    role: "CEO & Fundadora",
    image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&q=90",
  },
  {
    name: "Carlos Rodríguez",
    role: "Director Comercial",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=600&q=90",
  },
  {
    name: "Laura Martínez",
    role: "Agente Senior",
    image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=600&q=90",
  },
  {
    name: "Jorge Fernández",
    role: "Inversiones",
    image: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=600&q=90",
  },
];

export function AboutSection() {
  return (
    <section id="nosotros" className="bg-white">
      {/* About Content */}
      <div className="py-24 md:py-32">
        <div className="container-custom">
          <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
            {/* Image */}
            <div className="relative">
              <div className="relative h-[600px] overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1000&q=90"
                  alt="Equipo Barrera Brokers"
                  fill
                  className="object-cover"
                />
              </div>
              {/* Floating accent */}
              <div className="absolute -bottom-12 -right-12 hidden lg:block bg-charcoal-900 text-white p-10">
                <div className="heading-serif text-5xl text-gold-400 mb-2">+500</div>
                <div className="label-tracking text-white/70">Propiedades Gestionadas</div>
              </div>
            </div>

            {/* Content */}
            <div>
              <div className="flex items-center gap-4 mb-6">
                <div className="h-px w-12 bg-gold-600" />
                <span className="label-tracking text-gold-600">
                  Sobre Nosotros
                </span>
              </div>
              
              <h2 className="heading-serif text-4xl md:text-5xl lg:text-6xl mb-8 text-charcoal-900 leading-tight">
                Construyendo
                <br />
                <span className="italic">confianza</span> desde 2000
              </h2>
              
              <p className="text-charcoal-500 text-lg leading-relaxed font-light mb-6">
                En Barrera Brokers somos más que una inmobiliaria. Somos socios estratégicos
                en el camino hacia las decisiones patrimoniales más importantes de tu vida.
              </p>
              
              <p className="text-charcoal-500 text-lg leading-relaxed font-light mb-12">
                Nuestro equipo combina conocimiento profundo del mercado, visión estratégica
                y compromiso genuino con cada cliente, ya sea que busques tu primera vivienda
                o expandir tu portafolio de inversiones.
              </p>

              {/* Values */}
              <div className="space-y-8">
                {values.map((value, index) => (
                  <div key={index} className="flex gap-6 items-start">
                    <span className="heading-serif text-2xl text-gold-600 leading-none mt-1">
                      0{index + 1}
                    </span>
                    <div>
                      <h3 className="heading-serif text-xl text-charcoal-900 mb-2">
                        {value.title}
                      </h3>
                      <p className="text-charcoal-500 font-light leading-relaxed">
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

      {/* Team Section */}
      <div className="py-24 md:py-32 bg-charcoal-50">
        <div className="container-custom">
          <div className="text-center max-w-2xl mx-auto mb-20">
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="h-px w-12 bg-gold-600" />
              <span className="label-tracking text-gold-600">
                Nuestro Equipo
              </span>
              <div className="h-px w-12 bg-gold-600" />
            </div>
            <h2 className="heading-serif text-4xl md:text-5xl text-charcoal-900">
              Profesionales
              <br />
              <span className="italic">comprometidos</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {team.map((member, index) => (
              <div key={index} className="group">
                <div className="relative h-[400px] overflow-hidden mb-6">
                  <Image
                    src={member.image}
                    alt={member.name}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-500" />
                </div>
                <h4 className="heading-serif text-xl text-charcoal-900 mb-1">{member.name}</h4>
                <p className="label-tracking text-gold-600">{member.role}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
