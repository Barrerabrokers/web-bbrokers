import {
  Building2,
  Hammer,
  Home,
  Key,
  TrendingUp,
  Sparkles,
} from "lucide-react";

const services = [
  {
    icon: Hammer,
    title: "En desarrollo",
    description:
      "Proyectos en construccion con financiacion especial y entregas programadas en ubicaciones premium.",
  },
  {
    icon: Building2,
    title: "En pozo",
    description:
      "Inversiones en etapa inicial con los mejores precios y condiciones de pago flexibles.",
  },
  {
    icon: Home,
    title: "Usados",
    description:
      "Propiedades listas para escriturar e ingresar, cuidadosamente seleccionadas por nuestro equipo.",
  },
  {
    icon: Key,
    title: "Alquileres",
    description:
      "Opciones de renta temporaria y permanente en las ubicaciones mas cotizadas de la ciudad.",
  },
  {
    icon: TrendingUp,
    title: "Inversiones",
    description:
      "Oportunidades inmobiliarias con alto retorno y proyeccion validadas por nuestros analistas.",
  },
  {
    icon: Sparkles,
    title: "Oportunidades",
    description:
      "Propiedades exclusivas con precios especiales por tiempo limitado, fuera de mercado.",
  },
];

export function ServicesSection() {
  return (
    <section id="servicios" className="relative section-pad bg-gray-950">
      <div className="container-custom">
        {/* Header */}
        <div className="max-w-3xl mb-16">
          <span className="eyebrow mb-5">Nuestros servicios</span>
          <h2 className="mt-5 text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tightest leading-[1.05] mb-6">
            <span className="text-gradient">Especialistas en cada</span>{" "}
            <span className="text-gradient-accent">tipo de propiedad.</span>
          </h2>
          <p className="text-gray-400 text-lg leading-relaxed tracking-tight">
            Ofrecemos un portafolio diverso adaptado a las necesidades
            especificas de cada cliente, desde primeras inversiones hasta
            carteras complejas.
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-gray-800/60 border border-gray-800 rounded-xl overflow-hidden">
          {services.map((service, index) => {
            const Icon = service.icon;
            return (
              <div
                key={index}
                className="group relative bg-gray-950 hover:bg-gray-900 transition-colors duration-300 p-7"
              >
                {/* Icon */}
                <div className="inline-flex items-center justify-center h-10 w-10 rounded-lg border border-gray-800 bg-gray-900 text-accent-300 mb-5 group-hover:border-accent/40 group-hover:shadow-glow transition-all duration-300">
                  <Icon className="h-5 w-5" />
                </div>

                {/* Number tag */}
                <div className="absolute top-7 right-7 text-xs tracking-tight text-gray-600">
                  0{index + 1}
                </div>

                {/* Title */}
                <h3 className="text-xl font-semibold tracking-tight text-gray-50 mb-2">
                  {service.title}
                </h3>

                {/* Description */}
                <p className="text-sm text-gray-400 leading-relaxed tracking-tight">
                  {service.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
