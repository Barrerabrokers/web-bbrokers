import Image from "next/image";
import { Award, Users, TrendingUp, Shield } from "lucide-react";

const stats = [
  {
    icon: Award,
    value: "20+",
    label: "Años de experiencia",
  },
  {
    icon: Users,
    value: "1,200+",
    label: "Clientes satisfechos",
  },
  {
    icon: TrendingUp,
    value: "+25%",
    label: "ROI promedio",
  },
  {
    icon: Shield,
    value: "100%",
    label: "Transacciones seguras",
  },
];

const team = [
  {
    name: "María Barrera",
    role: "CEO & Fundadora",
    image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400",
  },
  {
    name: "Carlos Rodríguez",
    role: "Director Comercial",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400",
  },
  {
    name: "Laura Martínez",
    role: "Agente Senior",
    image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400",
  },
  {
    name: "Jorge Fernández",
    role: "Especialista en Inversiones",
    image: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400",
  },
];

export function AboutSection() {
  return (
    <section id="nosotros" className="py-20 bg-white">
      <div className="container mx-auto px-4">
        {/* About Content */}
        <div className="grid md:grid-cols-2 gap-12 items-center mb-20">
          <div>
            <span className="text-primary-600 font-semibold mb-2 block">
              Sobre Nosotros
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Más de 20 años construyendo confianza
            </h2>
            <p className="text-gray-600 mb-6">
              En <strong>Barrera Brokers</strong>, somos más que una inmobiliaria. Somos tu socio estratégico 
              en el mundo de los bienes raíces. Desde 2000, hemos ayudado a más de 1,200 familias y empresarios 
              a encontrar, invertir y rentabilizar propiedades.
            </p>
            <p className="text-gray-600 mb-6">
              Nuestro equipo de expertos combina conocimiento del mercado local, visión estratégica y 
              compromiso genuino con cada cliente. Ya sea que busques tu primera vivienda, expandir tu 
              portafolio de inversión, o encontrar la ubicación perfecta para tu negocio, estamos aquí 
              para guiarte en cada paso.
            </p>
            
            <div className="grid grid-cols-2 gap-6">
              {stats.map((stat, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className="bg-primary-100 p-3 rounded-lg flex-shrink-0">
                    <stat.icon className="h-6 w-6 text-primary-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                    <div className="text-sm text-gray-600">{stat.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative h-[400px] md:h-[500px]">
            <Image
              src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=800"
              alt="Equipo Barrera Brokers"
              fill
              className="rounded-2xl shadow-2xl object-cover"
            />
            <div className="absolute -bottom-6 -left-6 bg-primary-600 text-white p-6 rounded-xl shadow-xl">
              <div className="text-3xl font-bold">+500</div>
              <div className="text-sm">Propiedades gestionadas</div>
            </div>
          </div>
        </div>

        {/* Team */}
        <div>
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
              Conoce a nuestro equipo
            </h3>
            <p className="text-gray-600">
              Profesionales comprometidos con tu éxito inmobiliario
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {team.map((member, index) => (
              <div key={index} className="text-center group">
                <div className="relative mb-4 overflow-hidden rounded-xl h-64">
                  <Image
                    src={member.image}
                    alt={member.name}
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </div>
                <h4 className="text-lg font-bold text-gray-900">{member.name}</h4>
                <p className="text-sm text-gray-600">{member.role}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
