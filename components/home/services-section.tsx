const services = [
  {
    title: "En desarrollo",
    description:
      "Proyectos en construccion con financiacion especial y entregas programadas en ubicaciones premium.",
  },
  {
    title: "En pozo",
    description:
      "Inversiones en etapa inicial con los mejores precios y condiciones de pago flexibles.",
  },
  {
    title: "Usados",
    description:
      "Propiedades listas para escriturar e ingresar, cuidadosamente seleccionadas por nuestro equipo.",
  },
  {
    title: "Alquileres",
    description:
      "Opciones de renta temporaria y permanente en las ubicaciones mas cotizadas de la ciudad.",
  },
  {
    title: "Inversiones",
    description:
      "Oportunidades inmobiliarias con alto retorno y proyeccion validadas por nuestros analistas.",
  },
  {
    title: "Oportunidades",
    description:
      "Propiedades exclusivas con precios especiales por tiempo limitado, fuera de mercado.",
  },
];

export function ServicesSection() {
  return (
    <section
      id="servicios"
      className="relative py-20 md:py-28 lg:py-36 bg-cream-50 border-t border-ink/15"
    >
      <div className="container-custom">
        {/* Header */}
        <div className="flex items-baseline justify-between flex-wrap gap-6 pb-12 border-b border-ink/15 mb-16 md:mb-20">
          <div className="flex items-baseline gap-6 md:gap-10">
            <span className="font-display italic font-light text-3xl md:text-4xl text-ink/40">
              (02)
            </span>
            <h2 className="font-display font-light text-4xl md:text-6xl lg:text-7xl tracking-[-0.025em] leading-[1] text-ink">
              <span className="italic">Servicios</span>
            </h2>
          </div>
          <p className="text-ink/70 leading-relaxed text-base md:text-lg max-w-md">
            Especialistas en cada tipo de propiedad. Asesoramiento integral
            adaptado a tus objetivos.
          </p>
        </div>

        {/* Editorial numbered list */}
        <ul>
          {services.map((service, index) => (
            <li
              key={index}
              className="group grid grid-cols-12 gap-4 md:gap-8 py-7 md:py-9 border-b border-ink/15 hover:bg-cream-200/40 transition-colors"
            >
              <div className="col-span-2 md:col-span-1">
                <span className="font-display italic font-light text-xl md:text-2xl text-ink/40">
                  ({String(index + 1).padStart(2, "0")})
                </span>
              </div>
              <div className="col-span-10 md:col-span-4">
                <h3 className="font-display font-light text-2xl md:text-4xl tracking-[-0.02em] text-ink leading-[1.05]">
                  {service.title}
                </h3>
              </div>
              <div className="col-span-12 md:col-span-7 flex items-center">
                <p className="text-ink/70 text-base md:text-lg leading-relaxed max-w-2xl">
                  {service.description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
