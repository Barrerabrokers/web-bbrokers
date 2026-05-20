import Link from "next/link";
import { Building2, Mail, Phone, MapPin, Facebook, Instagram, Linkedin } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Building2 className="h-8 w-8 text-primary-500" />
              <span className="text-xl font-bold text-white">
                Barrera Brokers
              </span>
            </div>
            <p className="text-sm">
              Tu socio de confianza en bienes raíces. Ayudándote a encontrar la propiedad perfecta desde 2020.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="hover:text-primary-500 transition-colors" aria-label="Facebook">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="#" className="hover:text-primary-500 transition-colors" aria-label="Instagram">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="#" className="hover:text-primary-500 transition-colors" aria-label="LinkedIn">
                <Linkedin className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">Enlaces Rápidos</h3>
            <ul className="space-y-2">
              <li>
                <a href="#inicio" className="hover:text-primary-500 transition-colors">
                  Inicio
                </a>
              </li>
              <li>
                <a href="#servicios" className="hover:text-primary-500 transition-colors">
                  Servicios
                </a>
              </li>
              <li>
                <a href="#propiedades" className="hover:text-primary-500 transition-colors">
                  Propiedades
                </a>
              </li>
              <li>
                <a href="#nosotros" className="hover:text-primary-500 transition-colors">
                  Nosotros
                </a>
              </li>
              <li>
                <a href="#contacto" className="hover:text-primary-500 transition-colors">
                  Contacto
                </a>
              </li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-white font-semibold mb-4">Servicios</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/propiedades?categoria=desarrollo" className="hover:text-primary-500 transition-colors">
                  En Desarrollo
                </Link>
              </li>
              <li>
                <Link href="/propiedades?categoria=pozo" className="hover:text-primary-500 transition-colors">
                  En Pozo
                </Link>
              </li>
              <li>
                <Link href="/propiedades?categoria=usados" className="hover:text-primary-500 transition-colors">
                  Usados
                </Link>
              </li>
              <li>
                <Link href="/propiedades?categoria=rentals" className="hover:text-primary-500 transition-colors">
                  Alquileres
                </Link>
              </li>
              <li>
                <Link href="/propiedades?categoria=inversiones" className="hover:text-primary-500 transition-colors">
                  Inversiones
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-white font-semibold mb-4">Contacto</h3>
            <ul className="space-y-3">
              <li className="flex items-start space-x-3">
                <MapPin className="h-5 w-5 text-primary-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm">
                  Av. Principal 123<br />
                  Buenos Aires, Argentina
                </span>
              </li>
              <li className="flex items-center space-x-3">
                <Phone className="h-5 w-5 text-primary-500 flex-shrink-0" />
                <span className="text-sm">+54 11 1234-5678</span>
              </li>
              <li className="flex items-center space-x-3">
                <Mail className="h-5 w-5 text-primary-500 flex-shrink-0" />
                <span className="text-sm">info@barrerabrokers.com</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm">
          <p>
            &copy; {new Date().getFullYear()} Barrera Brokers. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
