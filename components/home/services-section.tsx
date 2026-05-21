const services = [
  {
    number: "01",
    title: "En Desarrollo",
    description: "Proyectos en construcción con financiación especial y entregas programadas en ubicaciones premium.",
  },
  {
    number: "02",
    title: "En Pozo",
    description: "Inversiones en etapa inicial con los mejores precios y condiciones de pago flexibles.",
  },
  {
    number: "03",
    title: "Usados",
    description: "Propiedades listas para escriturar e ingresar, cuidadosamente seleccionadas.",
  },
  {
    number: "04",
    title: "Alquileres",
    description: "Opciones de renta temporaria y permanente en las ubicaciones más cotizadas.",
  },
  {
    number: "05",
    title: "Inversiones",
    description: "Oportunidades de inversión inmobiliaria con alto retorno y proyección.",
  },
  {
    number: "06",
    title: "Oportunidades",
    description: "Propiedades exclusivas con precios especiales por tiempo limitado.",
  },
];

export function ServicesSection() {
  return (
    <section id="servicios" className="py-24 md:py-32 bg-white">
      <div className="container-custom">
        {/* Header */}
        <div className="max-w-3xl mb-20">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-px w-12 bg-gold-600" />
            <span className="label-tracking text-gold-600">
              Nuestros Servicios
            </span>
          </div>
          <h2 className="heading-serif text-4xl md:text-5xl lg:text-6xl mb-6 text-charcoal-900">
            Especialistas en cada
            <br />
            <span className="italic">tipo de propiedad</span>
          </h2>
          <p className="text-charcoal-500 text-lg leading-relaxed font-light">
            Ofrecemos un portafolio diverso adaptado a las necesidades específicas
            de cada cliente, desde primeras inversiones hasta carteras complejas.
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service, index) => (
            <div
              key={index}
              className="group p-10 border-t border-charcoal-200 hover:bg-charcoal-50 transition-all duration-500 cursor-pointer"
            >
              <div className="flex items-baseline justify-between mb-6">
                <span className="heading-serif text-5xl text-charcoal-200 group-hover:text-gold-600 transition-colors duration-500">
                  {service.number}
                </span>
                <div className="h-px w-12 bg-charcoal-300 group-hover:w-20 group-hover:bg-gold-600 transition-all duration-500" />
              </div>
              <h3 className="heading-serif text-2xl md:text-3xl text-charcoal-900 mb-4">
                {service.title}
              </h3>
              <p className="text-charcoal-500 leading-relaxed font-light">
                {service.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
