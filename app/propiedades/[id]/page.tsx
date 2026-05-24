import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { PropertyGallery } from "@/components/property-gallery";
import { getPropertyById } from "@/lib/db";
import { formatPrice, formatPriceARS } from "@/lib/utils";
import {
  MapPin,
  Bed,
  Bath,
  Square,
  Check,
  ArrowLeft,
  Mail,
  Phone,
  Receipt,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PropertyDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const property = await getPropertyById(params.id);

  if (!property) {
    notFound();
  }

  // URL del mapa de Google Maps embed (sin API key, gratis)
  const mapAddress = encodeURIComponent(
    `${property.address}, ${property.location}`
  );
  const mapUrl = `https://www.google.com/maps?q=${mapAddress}&output=embed`;

  return (
    <div className="min-h-screen">
      <Header />

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Breadcrumb */}
          <div className="mb-6">
            <Link
              href="/propiedades"
              className="inline-flex items-center text-charcoal-500 hover:text-charcoal-900"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver a propiedades
            </Link>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-8">
              {/* Image Gallery con Lightbox */}
              <PropertyGallery
                images={property.images}
                title={property.title}
                category={property.category}
              />

              {/* Property Details */}
              <div className="bg-white border border-charcoal-100 p-8">
                <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <h1 className="heading-serif text-3xl text-charcoal-900 mb-4">
                      {property.title}
                    </h1>
                    <div className="flex items-center text-charcoal-600 mb-2">
                      <MapPin className="h-5 w-5 mr-2" />
                      <span>{property.location}</span>
                    </div>
                    <p className="text-charcoal-500">{property.address}</p>
                  </div>
                  <div className="text-right">
                    <div className="heading-serif text-3xl text-gold-600 mb-2">
                      {formatPrice(property.price)}
                    </div>
                    {property.expenses ? (
                      <div className="text-sm text-charcoal-500 mb-2">
                        + Expensas: {formatPriceARS(property.expenses)}/mes
                      </div>
                    ) : null}
                    <span
                      className={`inline-block px-3 py-1 label-tracking text-xs capitalize ${
                        property.status === "disponible"
                          ? "bg-green-100 text-green-700"
                          : property.status === "reservada"
                          ? "bg-orange-100 text-orange-700"
                          : "bg-charcoal-200 text-charcoal-700"
                      }`}
                    >
                      {property.status}
                    </span>
                  </div>
                </div>

                {/* Key Features */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-6 border-t border-b border-charcoal-100">
                  {property.bedrooms ? (
                    <div className="text-center">
                      <div className="bg-gold-100 w-12 h-12 flex items-center justify-center mx-auto mb-2">
                        <Bed className="h-6 w-6 text-gold-600" />
                      </div>
                      <div className="heading-serif text-2xl text-charcoal-900">
                        {property.bedrooms}
                      </div>
                      <div className="text-sm text-charcoal-500">
                        Dormitorios
                      </div>
                    </div>
                  ) : null}
                  {property.bathrooms ? (
                    <div className="text-center">
                      <div className="bg-gold-100 w-12 h-12 flex items-center justify-center mx-auto mb-2">
                        <Bath className="h-6 w-6 text-gold-600" />
                      </div>
                      <div className="heading-serif text-2xl text-charcoal-900">
                        {property.bathrooms}
                      </div>
                      <div className="text-sm text-charcoal-500">Banos</div>
                    </div>
                  ) : null}
                  <div className="text-center">
                    <div className="bg-gold-100 w-12 h-12 flex items-center justify-center mx-auto mb-2">
                      <Square className="h-6 w-6 text-gold-600" />
                    </div>
                    <div className="heading-serif text-2xl text-charcoal-900">
                      {property.area}
                    </div>
                    <div className="text-sm text-charcoal-500">m2</div>
                  </div>
                  {property.expenses ? (
                    <div className="text-center">
                      <div className="bg-gold-100 w-12 h-12 flex items-center justify-center mx-auto mb-2">
                        <Receipt className="h-6 w-6 text-gold-600" />
                      </div>
                      <div className="heading-serif text-xl text-charcoal-900">
                        {formatPriceARS(property.expenses)}
                      </div>
                      <div className="text-sm text-charcoal-500">
                        Expensas/mes (ARS)
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Description */}
                <div className="mt-6">
                  <h2 className="heading-serif text-xl text-charcoal-900 mb-4">
                    Descripcion
                  </h2>
                  <p className="text-charcoal-600 leading-relaxed whitespace-pre-line">
                    {property.description}
                  </p>
                </div>

                {/* Features */}
                {property.features.length > 0 && (
                  <div className="mt-6">
                    <h2 className="heading-serif text-xl text-charcoal-900 mb-4">
                      Caracteristicas
                    </h2>
                    <div className="grid grid-cols-2 gap-3">
                      {property.features.map((feature, index) => (
                        <div
                          key={index}
                          className="flex items-center space-x-2"
                        >
                          <Check className="h-5 w-5 text-gold-600 flex-shrink-0" />
                          <span className="text-charcoal-700">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Mapa */}
              <div className="bg-white border border-charcoal-100 p-8">
                <h2 className="heading-serif text-xl text-charcoal-900 mb-4 flex items-center">
                  <MapPin className="h-5 w-5 mr-2 text-gold-600" />
                  Ubicacion
                </h2>
                <p className="text-charcoal-600 mb-4">
                  {property.address}, {property.location}
                </p>
                <div className="relative w-full h-[400px] overflow-hidden border border-charcoal-100">
                  <iframe
                    src={mapUrl}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Mapa de la propiedad"
                  />
                </div>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${mapAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-gold-600 hover:text-gold-700 mt-4 text-sm"
                >
                  Abrir en Google Maps
                  <span className="ml-1">-&gt;</span>
                </a>
              </div>
            </div>

            {/* Sidebar - Contact Form */}
            <div className="lg:col-span-1">
              <div className="bg-white border border-charcoal-100 p-6 sticky top-24">
                <h3 className="heading-serif text-xl text-charcoal-900 mb-4">
                  Interesado en esta propiedad?
                </h3>
                <p className="text-charcoal-600 mb-6">
                  Contactanos y un agente te respondera a la brevedad.
                </p>

                <form className="space-y-4">
                  <div>
                    <label className="label-tracking text-charcoal-700 block mb-2">
                      Nombre
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full px-4 py-3 border border-charcoal-200 focus:border-gold-500 focus:outline-none"
                      placeholder="Tu nombre"
                    />
                  </div>

                  <div>
                    <label className="label-tracking text-charcoal-700 block mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      className="w-full px-4 py-3 border border-charcoal-200 focus:border-gold-500 focus:outline-none"
                      placeholder="tu@email.com"
                    />
                  </div>

                  <div>
                    <label className="label-tracking text-charcoal-700 block mb-2">
                      Telefono
                    </label>
                    <input
                      type="tel"
                      className="w-full px-4 py-3 border border-charcoal-200 focus:border-gold-500 focus:outline-none"
                      placeholder="+54 11 1234-5678"
                    />
                  </div>

                  <div>
                    <label className="label-tracking text-charcoal-700 block mb-2">
                      Mensaje
                    </label>
                    <textarea
                      rows={4}
                      className="w-full px-4 py-3 border border-charcoal-200 focus:border-gold-500 focus:outline-none"
                      placeholder="Me gustaria mas informacion..."
                    />
                  </div>

                  <button type="submit" className="w-full btn-primary">
                    Enviar Consulta
                  </button>
                </form>

                <div className="mt-6 pt-6 border-t border-charcoal-100 space-y-3">
                  <a
                    href="tel:+541112345678"
                    className="flex items-center space-x-3 text-charcoal-700 hover:text-gold-600"
                  >
                    <Phone className="h-5 w-5" />
                    <span>+54 11 1234-5678</span>
                  </a>
                  <a
                    href="mailto:info@barrerabrokers.com"
                    className="flex items-center space-x-3 text-charcoal-700 hover:text-gold-600"
                  >
                    <Mail className="h-5 w-5" />
                    <span>info@barrerabrokers.com</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
