import Link from "next/link";
import Image from "next/image";

export function Footer() {
  return (
    <footer className="bg-cream-900 text-cream-100">
      <div className="container-custom pt-20 pb-10">
        {/* Big wordmark */}
        <div className="border-b border-cream-100/15 pb-12 mb-12">
          <Link href="/" className="inline-block group">
            <span className="font-display font-light text-[64px] md:text-[120px] lg:text-[160px] leading-[0.92] tracking-[-0.04em] text-cream-100 group-hover:text-accent-300 transition-colors">
              Barrera <span className="italic">Brokers</span>
            </span>
          </Link>
        </div>

        <div className="grid grid-cols-12 gap-6 md:gap-8">
          {/* Logo + tagline */}
          <div className="col-span-12 md:col-span-4 lg:col-span-5">
            <div className="flex items-center gap-3 mb-5">
              <div className="relative h-9 w-9">
                <Image
                  src="/logo.png"
                  alt="Barrera Brokers"
                  fill
                  className="object-contain brightness-0 invert"
                />
              </div>
              <span className="text-[11px] uppercase tracking-widest text-cream-100/60">
                (Real Estate Excellence)
              </span>
            </div>
            <p className="text-cream-100/70 leading-relaxed max-w-md text-sm">
              Real estate excellence desde el ano 2000. Tu socio de confianza
              para encontrar, invertir y rentabilizar propiedades exclusivas en
              Buenos Aires.
            </p>
          </div>

          {/* Navegacion */}
          <div className="col-span-6 md:col-span-2 lg:col-span-2">
            <h3 className="text-[10px] uppercase tracking-widest text-cream-100/50 mb-5">
              (Navegacion)
            </h3>
            <ul className="space-y-2.5">
              {[
                { href: "/#inicio", label: "Inicio" },
                { href: "/#propiedades", label: "Propiedades" },
                { href: "/#servicios", label: "Servicios" },
                { href: "/#nosotros", label: "Nosotros" },
                { href: "/#contacto", label: "Contacto" },
              ].map((it) => (
                <li key={it.href}>
                  <a
                    href={it.href}
                    className="text-sm text-cream-100/85 hover:text-cream-100 transition-colors"
                  >
                    {it.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Categorias */}
          <div className="col-span-6 md:col-span-2 lg:col-span-2">
            <h3 className="text-[10px] uppercase tracking-widest text-cream-100/50 mb-5">
              (Categorias)
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
                    className="text-sm text-cream-100/85 hover:text-cream-100 transition-colors"
                  >
                    {it.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="col-span-12 md:col-span-4 lg:col-span-3">
            <h3 className="text-[10px] uppercase tracking-widest text-cream-100/50 mb-5">
              (Contacto)
            </h3>
            <div className="space-y-3">
              <a
                href="mailto:info@barrerabrokers.com"
                className="block font-display font-light text-xl md:text-2xl text-cream-100 hover:text-accent-300 transition-colors leading-tight tracking-[-0.02em]"
              >
                info@barrerabrokers.com
              </a>
              <a
                href="tel:+541112345678"
                className="block text-sm text-cream-100/85 hover:text-cream-100 transition-colors"
              >
                +54 11 1234-5678
              </a>
              <p className="text-sm text-cream-100/70 leading-relaxed">
                Av. Principal 123
                <br />
                Buenos Aires, Argentina
              </p>
            </div>
          </div>
        </div>

        <div className="mt-16 pt-6 border-t border-cream-100/15 flex flex-col md:flex-row justify-between items-center gap-3">
          <p className="text-xs text-cream-100/50">
            &copy; {new Date().getFullYear()} Barrera Brokers. Todos los derechos
            reservados.
          </p>
          <p className="text-xs text-cream-100/50 uppercase tracking-widest">
            Buenos Aires &middot; Argentina
          </p>
        </div>
      </div>
    </footer>
  );
}
