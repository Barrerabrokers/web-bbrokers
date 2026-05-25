import Link from "next/link";
import Image from "next/image";

export function Footer() {
  return (
    <footer className="bg-ink text-bone">
      <div className="container-custom pt-24 pb-10">
        {/* Top wordmark */}
        <div className="border-b border-bone/15 pb-16">
          <Link href="/" className="inline-block group">
            <span className="block font-display font-light text-[64px] md:text-[120px] lg:text-[160px] leading-[0.92] tracking-[-0.04em] text-bone group-hover:text-accent transition-colors duration-900">
              Barrera <span className="italic">Brokers</span>
            </span>
            <span className="block mt-3 text-[10px] uppercase tracking-widest text-bone/55">
              Desarrollos e inversiones inmobiliarias &middot; Buenos Aires &middot; Est. 2000
            </span>
          </Link>
        </div>

        <div className="grid grid-cols-12 gap-8 md:gap-10 mt-16">
          {/* About */}
          <div className="col-span-12 md:col-span-4 lg:col-span-5">
            <div className="flex items-center gap-3 mb-5">
              <div className="relative h-10 w-10">
                <Image
                  src="/logo.png"
                  alt="Barrera Brokers"
                  fill
                  className="object-contain brightness-0 invert"
                />
              </div>
            </div>
            <p className="text-bone/70 leading-relaxed max-w-md text-sm">
              Especialistas en desarrollos inmobiliarios e inversiones en
              Buenos Aires. Ingresá en pozo, financiá en cuotas y
              multiplicá tu capital con retornos del 30-40%.
            </p>
          </div>

          {/* Navegacion */}
          <div className="col-span-6 md:col-span-2 lg:col-span-2">
            <h3 className="text-[10px] uppercase tracking-widest text-accent mb-5">
              Navegacion
            </h3>
            <ul className="space-y-2.5">
              {[
                { href: "/#inicio", label: "Inicio" },
                { href: "/#desarrollos", label: "Desarrollos" },
                { href: "/#modelo", label: "Inversión" },
                { href: "/#renta", label: "Renta" },
                { href: "/#propiedades", label: "Propiedades" },
                { href: "/#contacto", label: "Contacto" },
              ].map((it) => (
                <li key={it.href}>
                  <a
                    href={it.href}
                    className="text-sm text-bone/75 hover:text-bone transition-colors duration-300"
                  >
                    {it.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Categorias */}
          <div className="col-span-6 md:col-span-2 lg:col-span-2">
            <h3 className="text-[10px] uppercase tracking-widest text-accent mb-5">
              Categorias
            </h3>
            <ul className="space-y-2.5">
              {[
                { href: "/propiedades?categoria=desarrollo", label: "Desarrollo" },
                { href: "/propiedades?categoria=pozo", label: "En pozo" },
                { href: "/propiedades?categoria=usados", label: "Usados" },
                { href: "/propiedades?categoria=rentals", label: "Alquileres" },
                { href: "/propiedades?categoria=inversiones", label: "Inversiones" },
              ].map((it) => (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    className="text-sm text-bone/75 hover:text-bone transition-colors duration-300"
                  >
                    {it.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="col-span-12 md:col-span-4 lg:col-span-3">
            <h3 className="text-[10px] uppercase tracking-widest text-accent mb-5">
              Contacto
            </h3>
            <div className="space-y-3">
              <a
                href="mailto:info@barrerabrokers.com"
                className="block font-display font-light text-xl md:text-2xl text-bone hover:text-accent transition-colors duration-300 leading-tight"
              >
                info@barrerabrokers.com
              </a>
              <a
                href="tel:+541112345678"
                className="block text-sm text-bone/75 hover:text-bone transition-colors duration-300"
              >
                +54 11 1234-5678
              </a>
              <p className="text-sm text-bone/65 leading-relaxed">
                Av. Principal 123
                <br />
                Buenos Aires, Argentina
              </p>
            </div>
          </div>
        </div>

        <div className="mt-16 pt-6 border-t border-bone/15 flex flex-col md:flex-row justify-between items-center gap-3">
          <p className="text-xs text-bone/50">
            &copy; {new Date().getFullYear()} Barrera Brokers. Todos los derechos
            reservados.
          </p>
          <p className="text-xs text-bone/50 uppercase tracking-widest">
            Buenos Aires &middot; Argentina
          </p>
        </div>
      </div>
    </footer>
  );
}
