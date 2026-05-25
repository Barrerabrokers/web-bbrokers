/**
 * Servicios section — dark theme, editorial numbered list
 *
 * Lista de servicios reales que ofrece Barrera Brokers.
 */
const services = [
  {
    no: "01",
    title: "Venta",
    description:
      "Compraventa de propiedades en CABA y zona norte. Asesoramiento integral, tasacion, marketing y gestion de la operacion hasta la escritura.",
  },
  {
    no: "02",
    title: "Alquiler",
    description:
      "Renta temporaria y permanente. Gestionamos la administracion, contratos, cobranza y mantenimiento para propietarios e inquilinos.",
  },
  {
    no: "03",
    title: "Desarrollos",
    description:
      "Proyectos en pozo y en construccion en barrios premium. Financiacion, planes de pago flexibles y entregas programadas.",
  },
  {
    no: "04",
    title: "Inversiones",
    description:
      "Asesoramiento para construir y diversificar carteras inmobiliarias con foco en retorno y proyeccion de largo plazo.",
  },
  {
    no: "05",
    title: "Tasaciones",
    description:
      "Valuacion profesional basada en comparables del mercado, estado del activo y contexto de la zona.",
  },
  {
    no: "06",
    title: "Oportunidades",
    description:
      "Propiedades fuera de mercado y oportunidades exclusivas para clientes que buscan condiciones especiales.",
  },
];

export function ServicesSection() {
  return (
    <section
      id="servicios"
      className="relative section-pad bg-ink text-bone border-t border-bone/10"
    >
      <div className="container-custom">
        {/* Section header */}
        <div className="grid grid-cols-12 gap-6 mb-20 md:mb-28">
          <div className="col-span-12 md:col-span-1">
            <p className="font-display italic font-light text-xl md:text-2xl text-bone/40">
              02
            </p>
          </div>

          <div className="col-span-12 md:col-span-7 md:col-start-3">
            <p className="text-[11px] uppercase tracking-widest text-accent mb-4">
              Servicios
            </p>
            <h2 className="font-display font-light text-[40px] md:text-[64px] lg:text-[80px] tracking-[-0.025em] leading-[1.02] text-bone">
              Lo que <span className="italic">hacemos</span> y como te
              acompanamos.
            </h2>
            <p className="mt-8 text-bone/70 text-base md:text-lg leading-relaxed max-w-2xl">
              Cubrimos el ciclo completo de la operacion inmobiliaria, con
              experiencia en cada area y atencion personalizada en cada
              proyecto.
            </p>
          </div>
        </div>

        {/* Services list */}
        <ul className="border-t border-bone/15">
          {services.map((service) => (
            <li
              key={service.no}
              className="group grid grid-cols-12 gap-4 md:gap-8 py-7 md:py-9 border-b border-bone/15 transition-colors duration-900"
              style={{ transitionTimingFunction: "var(--f-cubic)" }}
            >
              <div className="col-span-2 md:col-span-1">
                <span className="font-display italic font-light text-xl md:text-2xl text-accent">
                  {service.no}
                </span>
              </div>
              <div className="col-span-10 md:col-span-4">
                <h3 className="font-display font-light text-3xl md:text-5xl tracking-[-0.02em] text-bone leading-[1.05] group-hover:italic transition-all duration-900">
                  {service.title}
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
