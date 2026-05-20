import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { getPropertyById } from "@/lib/db";
import { formatPrice } from "@/lib/utils";
import { MapPin, Bed, Bath, Square, Check, ArrowLeft, Mail, Phone } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function PropertyDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const property = await getPropertyById(params.id);

  if (!property) {
    notFound();
  }

  return (
    <div className="min-h-screen">
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Breadcrumb */}
          <div className="mb-6">
            <Link
              href="/propiedades"
              className="inline-flex items-center text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver a propiedades
            </Link>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-8">
              {/* Image Gallery */}
              <div className="space-y-4">
                <div className="relative h-[500px] rounded-2xl overflow-hidden">
                  <img
                    src={property.images[0]}
                    alt={property.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-4 left-4">
                    <span className="bg-primary-600 text-white px-4 py-2 rounded-full text-sm font-semibold capitalize">
                      {property.category}
                    </span>
                  </div>
                </div>

                {property.images.length > 1 && (
                  <div className="grid grid-cols-4 gap-4">
                    {property.images.slice(1, 5).map((image, index) => (
                      <div key={index} className="h-24 rounded-lg overflow-hidden">
                        <img
                          src={image}
                          alt={`${property.title} ${index + 2}`}
                          className="w-full h-full object-cover hover:scale-110 transition-transform cursor-pointer"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Property Details */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-4">
                      {property.title}
                    </h1>
                    <div className="flex items-center text-gray-600 mb-2">
                      <MapPin className="h-5 w-5 mr-2" />
                      <span>{property.location}</span>
                    </div>
                    <p className="text-gray-600">{property.address}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-primary-600 mb-2">
                      {formatPrice(property.price)}
                    </div>
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-sm font-semibold capitalize ${
                        property.status === "disponible"
                          ? "bg-green-100 text-green-700"
                          : property.status === "reservada"
                          ? "bg-orange-100 text-orange-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {property.status}
                    </span>
                  </div>
                </div>

                {/* Key Features */}
                <div className="grid grid-cols-3 gap-6 py-6 border-t border-b">
                  {property.bedrooms && (
                    <div className="text-center">
                      <div className="bg-primary-100 w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-2">
                        <Bed className="h-6 w-6 text-primary-600" />
                      </div>
                      <div className="text-2xl font-bold text-gray-900">{property.bedrooms}</div>
                      <div className="text-sm text-gray-600">Dormitorios</div>
                    </div>
                  )}
                  {property.bathrooms && (
                    <div className="text-center">
                      <div className="bg-primary-100 w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-2">
                        <Bath className="h-6 w-6 text-primary-600" />
                      </div>
                      <div className="text-2xl font-bold text-gray-900">{property.bathrooms}</div>
                      <div className="text-sm text-gray-600">Baños</div>
                    </div>
                  )}
                  <div className="text-center">
                    <div className="bg-primary-100 w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-2">
                      <Square className="h-6 w-6 text-primary-600" />
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{property.area}</div>
                    <div className="text-sm text-gray-600">m²</div>
                  </div>
                </div>

                {/* Description */}
                <div className="mt-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Descripción</h2>
                  <p className="text-gray-600 leading-relaxed">{property.description}</p>
                </div>

                {/* Features */}
                {property.features.length > 0 && (
                  <div className="mt-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Características</h2>
                    <div className="grid grid-cols-2 gap-3">
                      {property.features.map((feature, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <Check className="h-5 w-5 text-green-600" />
                          <span className="text-gray-700">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar - Contact Form */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-24">
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                  ¿Interesado en esta propiedad?
                </h3>
                <p className="text-gray-600 mb-6">
                  Contáctanos y un agente te responderá a la brevedad.
                </p>

                <form className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nombre
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Tu nombre"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="tu@email.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Teléfono
                    </label>
                    <input
                      type="tel"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="+54 11 1234-5678"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Mensaje
                    </label>
                    <textarea
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Me gustaría más información sobre esta propiedad..."
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
                  >
                    Enviar Consulta
                  </button>
                </form>

                <div className="mt-6 pt-6 border-t space-y-3">
                  <a
                    href="tel:+541112345678"
                    className="flex items-center space-x-3 text-gray-700 hover:text-primary-600"
                  >
                    <Phone className="h-5 w-5" />
                    <span>+54 11 1234-5678</span>
                  </a>
                  <a
                    href="mailto:info@barrerabrokers.com"
                    className="flex items-center space-x-3 text-gray-700 hover:text-primary-600"
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
