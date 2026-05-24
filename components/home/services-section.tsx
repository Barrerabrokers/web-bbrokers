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
      className="relative section-pad bg-cream-100 border-t border-ink/10"
    >
      <div className="container-custom">
        {/* Header asymmetric */}
        <div className="grid grid-cols-12 gap-6 mb-20 md:mb-28">
          <div className="col-span-12 md:col-span-1">
            <span className="number-marker">02.</span>
          </div>
          <div className="col-span-12 md:col-span-7">
            <p className="eyebrow mb-6">Nuestros servicios</p>
            <h2 className="font-display text-[56px] md:text-[88px] lg:text-[112px] leading-[0.95] tracking-tightest text-ink">
              Especialistas
              <br />
              en cada <span className="italic-display">tipo</span>
              <br />
              de propiedad.
            </h2>
          </div>
          <div className="col-span-12 md:col-span-3 md:col-start-10 flex items-end">
            <p className="text-ink/70 leading-relaxed text-base md:text-lg">
              Ofrecemos un portafolio diverso adaptado a las necesidades de
              cada cliente, desde primeras inversiones hasta carteras
              complejas.
            </p>
          </div>
        </div>

        {/* Editorial numbered list */}
        <ul className="border-t border-ink/15">
          {services.map((service, index) => (
            <li
              key={index}
              className="group grid grid-cols-12 gap-4 md:gap-8 py-8 md:py-10 border-b border-ink/15 hover:bg-cream-200/40 transition-colors"
            >
              <div className="col-span-2 md:col-span-1">
                <span className="font-display text-2xl md:text-3xl text-ink/40 group-hover:text-accent transition-colors">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <div className="col-span-10 md:col-span-4">
                <h3 className="font-display text-3xl md:text-5xl tracking-tight text-ink leading-tight">
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
