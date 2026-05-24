/**
 * Services / Objects section - Obsidian Assembly style
 * Dark theme con yellow accent. Manifesto declarativo de 3 lineas.
 */
const sections = [
  "Cada operacion se origina en el lugar, modelada por contexto, mercado y circunstancia.",
  "Nuestros servicios cubren venta, alquiler, desarrollo, inversion y oportunidades fuera de mercado.",
  "Una vez completada, la operacion deja su punto de origen y circula independientemente.",
];

const services = [
  {
    no: "01",
    title: "Sales",
    titleEs: "Ventas",
    description:
      "Compraventa de propiedades en Buenos Aires. Desde primera vivienda hasta inversiones de gran escala.",
  },
  {
    no: "02",
    title: "Rentals",
    titleEs: "Alquileres",
    description:
      "Renta temporaria y permanente en las ubicaciones mas cotizadas de la ciudad.",
  },
  {
    no: "03",
    title: "Development",
    titleEs: "Desarrollos",
    description:
      "Proyectos en pozo y en construccion con financiacion especial y entregas programadas.",
  },
  {
    no: "04",
    title: "Investment",
    titleEs: "Inversiones",
    description:
      "Oportunidades inmobiliarias con alto retorno y proyeccion validadas por nuestros analistas.",
  },
  {
    no: "05",
    title: "Valuation",
    titleEs: "Tasaciones",
    description:
      "Valuacion profesional basada en comparables, ubicacion y condiciones del activo.",
  },
  {
    no: "06",
    title: "Off-Market",
    titleEs: "Oportunidades",
    description:
      "Propiedades exclusivas con precios especiales, fuera de mercado, por tiempo limitado.",
  },
];

export function ServicesSection() {
  return (
    <section
      id="servicios"
      className="relative section-pad bg-ink text-bone border-t border-bone/10"
    >
      <div className="container-custom">
        {/* Manifesto declarativo */}
        <div className="grid grid-cols-12 gap-6 mb-20 md:mb-28">
          <div className="col-span-12 md:col-span-1">
            <p className="font-display italic font-light text-xl md:text-2xl text-bone/40">
              Objects
            </p>
          </div>
          <div className="col-span-12 md:col-span-10 md:col-start-3">
            <div className="space-y-6 md:space-y-8">
              {sections.map((line, idx) => (
                <p
                  key={idx}
                  className={`font-display font-light text-2xl md:text-4xl lg:text-[44px] leading-[1.15] tracking-tight text-bone/90 ${
                    idx === 1 ? "italic text-accent" : ""
                  }`}
                >
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>

        {/* Services list - editorial numbered */}
        <ul className="border-t border-bone/15">
          {services.map((service) => (
            <li
              key={service.no}
              className="group grid grid-cols-12 gap-4 md:gap-8 py-7 md:py-9 border-b border-bone/15 transition-colors duration-900"
              style={{ transitionTimingFunction: "var(--f-cubic)" }}
            >
              <div className="col-span-2 md:col-span-1">
                <span className="font-display italic font-light text-xl md:text-2xl text-accent">
                  ({service.no})
                </span>
              </div>
              <div className="col-span-10 md:col-span-4">
                <p className="text-[10px] uppercase tracking-widest text-bone/50 mb-1">
                  {service.title}
                </p>
                <h3 className="font-display font-light text-3xl md:text-5xl tracking-[-0.02em] text-bone leading-[1.05] group-hover:italic transition-all duration-900">
                  {service.titleEs}
                </h3>
              </div>
              <div className="col-span-12 md:col-span-7 flex items-center">
                <p className="text-bone/70 text-base md:text-lg leading-relaxed max-w-2xl">
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
