import { Building, Home, TrendingUp, Key, DollarSign, Sparkles } from "lucide-react";

const services = [
  {
    icon: Building,
    title: "En Desarrollo",
    description: "Proyectos en construcción con financiación especial y entrega programada.",
    color: "blue",
  },
  {
    icon: Home,
    title: "En Pozo",
    description: "Inversiones en etapa inicial con los mejores precios y condiciones de pago.",
    color: "green",
  },
  {
    icon: Key,
    title: "Usados",
    description: "Propiedades listas para escriturar e ingresar inmediatamente.",
    color: "purple",
  },
  {
    icon: DollarSign,
    title: "Alquileres",
    description: "Opciones de renta temporaria y permanente en las mejores ubicaciones.",
    color: "orange",
  },
  {
    icon: TrendingUp,
    title: "Inversiones",
    description: "Oportunidades de inversión inmobiliaria con alto retorno garantizado.",
    color: "red",
  },
  {
    icon: Sparkles,
    title: "Oportunidades",
    description: "Propiedades exclusivas con precios especiales por tiempo limitado.",
    color: "yellow",
  },
];

const colorClasses = {
  blue: "bg-blue-100 text-blue-600",
  green: "bg-green-100 text-green-600",
  purple: "bg-purple-100 text-purple-600",
  orange: "bg-orange-100 text-orange-600",
  red: "bg-red-100 text-red-600",
  yellow: "bg-yellow-100 text-yellow-600",
};

export function ServicesSection() {
  return (
    <section id="servicios" className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-primary-600 font-semibold mb-2 block">
            Nuestros Servicios
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            ¿Qué tipo de propiedad buscas?
          </h2>
          <p className="text-lg text-gray-600">
            Ofrecemos una amplia variedad de opciones para que encuentres exactamente lo que necesitas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((service, index) => (
            <div
              key={index}
              className="group p-6 border border-gray-200 rounded-xl hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className={`${colorClasses[service.color as keyof typeof colorClasses]} w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <service.icon className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {service.title}
              </h3>
              <p className="text-gray-600">
                {service.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
