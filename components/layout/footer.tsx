import Link from "next/link";
import Image from "next/image";
import { Instagram, Linkedin, Facebook } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-ink-700 text-white">
      <div className="container-custom pt-24 pb-10">
        {/* Top wordmark + tagline */}
        <div className="text-center pb-16 border-b border-white/15">
          <Link href="/" className="inline-block group">
            <span className="font-display font-light text-[56px] md:text-[88px] lg:text-[120px] leading-[0.98] tracking-[-0.025em] text-white group-hover:text-accent transition-colors">
              Barrera <span className="italic">Brokers</span>
            </span>
          </Link>
          <p className="mt-6 text-[11px] uppercase tracking-widest text-white/65">
            Buenos Aires Real Estate Experts &middot; Est. 2000
          </p>
        </div>

        <div className="grid grid-cols-12 gap-8 md:gap-10 mt-16">
          {/* Logo + intro */}
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
              <span className="font-display text-xl text-white">
                Barrera <span className="italic">Brokers</span>
              </span>
            </div>
            <p className="text-white/65 leading-relaxed max-w-md text-sm">
              Tu socio de confianza en bienes raices premium en Buenos Aires.
              Mas de dos decadas conectando a las personas indicadas con las
              propiedades que cambian sus vidas.
            </p>

            <div className="flex gap-3 mt-8">
              <a
                href="#"
                className="h-10 w-10 inline-flex items-center justify-center rounded-full border border-white/25 text-white/70 hover:text-white hover:border-white transition-all"
                aria-label="Instagram"
              >
                <Instagram className="h-4 w-4" />
              </a>
              <a
                href="#"
                className="h-10 w-10 inline-flex items-center justify-center rounded-full border border-white/25 text-white/70 hover:text-white hover:border-white transition-all"
                aria-label="LinkedIn"
              >
                <Linkedin className="h-4 w-4" />
              </a>
              <a
                href="#"
                className="h-10 w-10 inline-flex items-center justify-center rounded-full border border-white/25 text-white/70 hover:text-white hover:border-white transition-all"
                aria-label="Facebook"
              >
                <Facebook className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Navegacion */}
          <div className="col-span-6 md:col-span-2 lg:col-span-2">
            <h3 className="text-[10px] uppercase tracking-widest text-accent mb-5">
              Navegacion
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
                    className="text-sm text-white/75 hover:text-white transition-colors"
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
                {
                  href: "/propiedades?categoria=desarrollo",
                  label: "Desarrollo",
                },
                { href: "/propiedades?categoria=pozo", label: "En pozo" },
                { href: "/propiedades?categoria=usados", label: "Usados" },
                { href: "/propiedades?categoria=rentals", label: "Alquileres" },
                {
                  href: "/propiedades?categoria=inversiones",
                  label: "Inversiones",
                },
              ].map((it) => (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    className="text-sm text-white/75 hover:text-white transition-colors"
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
                className="block font-display text-xl md:text-2xl text-white hover:text-accent-300 transition-colors leading-tight"
              >
                info@barrerabrokers.com
              </a>
              <a
                href="tel:+541112345678"
                className="block text-sm text-white/75 hover:text-white transition-colors"
              >
                +54 11 1234-5678
              </a>
              <p className="text-sm text-white/65 leading-relaxed">
                Av. Principal 123
                <br />
                Buenos Aires, Argentina
              </p>
            </div>
          </div>
        </div>

        <div className="mt-16 pt-6 border-t border-white/15 flex flex-col md:flex-row justify-between items-center gap-3">
          <p className="text-xs text-white/50">
            &copy; {new Date().getFullYear()} Barrera Brokers. Todos los derechos
            reservados.
          </p>
          <p className="text-xs text-white/50 uppercase tracking-widest">
            Buenos Aires &middot; Argentina
          </p>
        </div>
      </div>
    </footer>
  );
}
