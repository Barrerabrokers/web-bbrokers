import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-obsidian border-t border-ivory/[0.06]">
      <div className="container-custom pt-20 pb-8">
        {/* Top wordmark */}
        <div className="mb-16">
          <Link href="/" className="inline-block group">
            <span className="block font-display text-[48px] md:text-[80px] lg:text-[100px] leading-[0.9] tracking-tight text-ivory/90 group-hover:text-ivory transition-colors duration-500">
              Barrera{" "}
              <em className="not-italic">Brokers</em>
            </span>
          </Link>
          <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-ivory/30">
            Desarrollos inmobiliarios · Buenos Aires · Est. 2000
          </p>
        </div>

        <div className="line-h mb-12" />

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-10">
          {/* Nav */}
          <div>
            <h3 className="label-tracking text-ivory/40 mb-4">Navegación</h3>
            <ul className="space-y-2.5">
              {[
                { href: "/#desarrollos", label: "Desarrollos" },
                { href: "/#modelo", label: "Inversión" },
                { href: "/#renta", label: "Renta temporaria" },
                { href: "/#propiedades", label: "Propiedades" },
                { href: "/#contacto", label: "Contacto" },
              ].map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="text-sm text-ivory/50 hover:text-ivory transition-colors duration-300"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div>
            <h3 className="label-tracking text-ivory/40 mb-4">Servicios</h3>
            <ul className="space-y-2.5">
              {[
                "Inversión en pozo",
                "Desarrollos premium",
                "Renta temporaria",
                "Administración Airbnb",
                "Tasaciones",
              ].map((item) => (
                <li key={item}>
                  <span className="text-sm text-ivory/50">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="lg:col-span-2">
            <h3 className="label-tracking text-ivory/40 mb-4">Contacto</h3>
            <div className="space-y-3">
              <a
                href="mailto:info@barrerabrokers.com"
                className="block text-lg text-ivory/70 hover:text-ivory transition-colors duration-300"
              >
                info@barrerabrokers.com
              </a>
              <a
                href="tel:+541112345678"
                className="block text-sm text-ivory/50 hover:text-ivory transition-colors duration-300"
              >
                +54 11 1234-5678
              </a>
              <p className="text-sm text-ivory/40 leading-relaxed">
                Av. Principal 123
                <br />
                Buenos Aires, Argentina
              </p>
            </div>
          </div>
        </div>

        <div className="line-h mt-12 mb-6" />

        <div className="flex flex-col md:flex-row justify-between items-center gap-3">
          <p className="text-[11px] text-ivory/25 uppercase tracking-[0.1em]">
            &copy; {new Date().getFullYear()} Barrera Brokers
          </p>
          <p className="text-[11px] text-ivory/25 uppercase tracking-[0.1em]">
            Buenos Aires · Argentina
          </p>
        </div>
      </div>
    </footer>
  );
}
