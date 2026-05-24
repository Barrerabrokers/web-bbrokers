import Link from "next/link";
import Image from "next/image";
import { Github, Instagram, Linkedin, Twitter } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-gray-800 bg-gray-950">
      <div className="container-custom py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-3 mb-5 group">
              <div className="relative h-9 w-9">
                <Image
                  src="/logo.png"
                  alt="Barrera Brokers"
                  fill
                  className="object-contain"
                />
              </div>
              <span className="text-base font-semibold tracking-tight text-gray-50">
                Barrera Brokers
              </span>
            </Link>
            <p className="text-sm text-gray-400 leading-relaxed max-w-md mb-6 tracking-tight">
              Real estate excellence desde el ano 2000. Tu socio de confianza
              para encontrar, invertir y rentabilizar propiedades exclusivas
              en Buenos Aires.
            </p>
            <div className="flex gap-2">
              <a
                href="#"
                className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-gray-800 text-gray-400 hover:text-gray-50 hover:border-gray-700 hover:bg-gray-900 transition-all"
                aria-label="Twitter"
              >
                <Twitter className="h-4 w-4" />
              </a>
              <a
                href="#"
                className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-gray-800 text-gray-400 hover:text-gray-50 hover:border-gray-700 hover:bg-gray-900 transition-all"
                aria-label="Instagram"
              >
                <Instagram className="h-4 w-4" />
              </a>
              <a
                href="#"
                className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-gray-800 text-gray-400 hover:text-gray-50 hover:border-gray-700 hover:bg-gray-900 transition-all"
                aria-label="LinkedIn"
              >
                <Linkedin className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Navegacion */}
          <div>
            <h3 className="text-xs font-semibold tracking-tight text-gray-50 mb-4 uppercase">
              Navegacion
            </h3>
            <ul className="space-y-3 text-sm">
              <li>
                <a
                  href="/#inicio"
                  className="text-gray-400 hover:text-gray-50 transition-colors"
                >
                  Inicio
                </a>
              </li>
              <li>
                <a
                  href="/#propiedades"
                  className="text-gray-400 hover:text-gray-50 transition-colors"
                >
                  Propiedades
                </a>
              </li>
              <li>
                <a
                  href="/#servicios"
                  className="text-gray-400 hover:text-gray-50 transition-colors"
                >
                  Servicios
                </a>
              </li>
              <li>
                <a
                  href="/#nosotros"
                  className="text-gray-400 hover:text-gray-50 transition-colors"
                >
                  Nosotros
                </a>
              </li>
              <li>
                <a
                  href="/#contacto"
                  className="text-gray-400 hover:text-gray-50 transition-colors"
                >
                  Contacto
                </a>
              </li>
            </ul>
          </div>

          {/* Categorias */}
          <div>
            <h3 className="text-xs font-semibold tracking-tight text-gray-50 mb-4 uppercase">
              Categorias
            </h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link
                  href="/propiedades?categoria=desarrollo"
                  className="text-gray-400 hover:text-gray-50 transition-colors"
                >
                  En desarrollo
                </Link>
              </li>
              <li>
                <Link
                  href="/propiedades?categoria=pozo"
                  className="text-gray-400 hover:text-gray-50 transition-colors"
                >
                  En pozo
                </Link>
              </li>
              <li>
                <Link
                  href="/propiedades?categoria=usados"
                  className="text-gray-400 hover:text-gray-50 transition-colors"
                >
                  Usados
                </Link>
              </li>
              <li>
                <Link
                  href="/propiedades?categoria=rentals"
                  className="text-gray-400 hover:text-gray-50 transition-colors"
                >
                  Alquileres
                </Link>
              </li>
              <li>
                <Link
                  href="/propiedades?categoria=inversiones"
                  className="text-gray-400 hover:text-gray-50 transition-colors"
                >
                  Inversiones
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 pt-6 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center gap-3">
          <p className="text-xs text-gray-500 tracking-tight">
            &copy; {new Date().getFullYear()} Barrera Brokers. Todos los
            derechos reservados.
          </p>
          <p className="text-xs text-gray-500 tracking-tight">
            Buenos Aires, Argentina
          </p>
        </div>
      </div>
    </footer>
  );
}
