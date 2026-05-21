import Link from "next/link";
import Image from "next/image";
import { Facebook, Instagram, Linkedin } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-charcoal-900 text-white border-t border-white/10">
      <div className="container-custom py-20">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center mb-6 group">
              <div className="relative h-20 w-20 mr-4">
                <Image
                  src="/logo.svg"
                  alt="Barrera Brokers"
                  fill
                  className="object-contain"
                />
              </div>
              <div>
                <span className="heading-serif text-xl text-white tracking-widest leading-none block">
                  BARRERA
                </span>
                <span className="heading-serif text-sm text-gold-400 tracking-[0.3em] leading-none block mt-1">
                  BROKERS
                </span>
              </div>
            </Link>
            <p className="text-white/60 font-light leading-relaxed max-w-md mb-8">
              Real estate excellence desde el ano 2000. Tu socio de confianza
              para encontrar, invertir y rentabilizar propiedades exclusivas
              en Buenos Aires.
            </p>
            <div className="flex space-x-6">
              <a href="#" className="text-white/60 hover:text-gold-400 transition-colors" aria-label="Facebook">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="#" className="text-white/60 hover:text-gold-400 transition-colors" aria-label="Instagram">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="#" className="text-white/60 hover:text-gold-400 transition-colors" aria-label="LinkedIn">
                <Linkedin className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="label-tracking text-gold-400 mb-6">Navegacion</h3>
            <ul className="space-y-3">
              <li><a href="#inicio" className="text-white/60 hover:text-white transition-colors font-light">Inicio</a></li>
              <li><a href="#propiedades" className="text-white/60 hover:text-white transition-colors font-light">Propiedades</a></li>
              <li><a href="#servicios" className="text-white/60 hover:text-white transition-colors font-light">Servicios</a></li>
              <li><a href="#nosotros" className="text-white/60 hover:text-white transition-colors font-light">Nosotros</a></li>
              <li><a href="#contacto" className="text-white/60 hover:text-white transition-colors font-light">Contacto</a></li>
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h3 className="label-tracking text-gold-400 mb-6">Categorias</h3>
            <ul className="space-y-3">
              <li><Link href="/propiedades?categoria=desarrollo" className="text-white/60 hover:text-white transition-colors font-light">En Desarrollo</Link></li>
              <li><Link href="/propiedades?categoria=pozo" className="text-white/60 hover:text-white transition-colors font-light">En Pozo</Link></li>
              <li><Link href="/propiedades?categoria=usados" className="text-white/60 hover:text-white transition-colors font-light">Usados</Link></li>
              <li><Link href="/propiedades?categoria=rentals" className="text-white/60 hover:text-white transition-colors font-light">Alquileres</Link></li>
              <li><Link href="/propiedades?categoria=inversiones" className="text-white/60 hover:text-white transition-colors font-light">Inversiones</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-white/40 text-sm font-light">
            &copy; {new Date().getFullYear()} Barrera Brokers. Todos los derechos reservados.
          </p>
          <p className="text-white/40 text-sm font-light">
            Buenos Aires, Argentina
          </p>
        </div>
      </div>
    </footer>
  );
}
