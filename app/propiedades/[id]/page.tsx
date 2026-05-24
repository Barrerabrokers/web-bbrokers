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
  ArrowRight,
  ExternalLink,
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

  const mapAddress = encodeURIComponent(
    `${property.address}, ${property.location}`
  );
  const mapUrl = `https://www.google.com/maps?q=${mapAddress}&output=embed`;

  const statusStyles: Record<string, string> = {
    disponible: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
    reservada: "bg-amber-500/10 border-amber-500/30 text-amber-300",
    vendida: "bg-gray-500/10 border-gray-500/30 text-gray-400",
  };
  const statusClass = statusStyles[property.status] ?? statusStyles.vendida;

  return (
    <div className="min-h-screen">
      <Header />

      <main className="pt-28 pb-24">
        <div className="container-custom">
          {/* Breadcrumb */}
          <div className="mb-6">
            <Link
              href="/propiedades"
              className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-50 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver a propiedades
            </Link>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main */}
            <div className="lg:col-span-2 space-y-6">
              {/* Galeria */}
              <PropertyGallery
                images={property.images}
                title={property.title}
                category={property.category}
              />

              {/* Detalles */}
              <div className="card p-6 md:p-8">
                <div className="flex items-start justify-between flex-wrap gap-4 pb-6 border-b border-gray-800">
                  <div className="flex-1 min-w-[220px]">
                    <h1 className="text-3xl md:text-4xl font-semibold tracking-tightest leading-tight text-gray-50 mb-3">
                      {property.title}
                    </h1>
                    <div className="flex items-center text-gray-400 gap-2">
                      <MapPin className="h-4 w-4" />
                      <span className="text-sm">
                        {property.location}
                      </span>
                    </div>
                    <p className="text-gray-500 text-sm mt-1">
                      {property.address}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl md:text-4xl font-semibold tracking-tightest text-gradient-accent">
                      {formatPrice(property.price)}
                    </div>
                    {property.expenses ? (
                      <div className="text-xs text-gray-400 mt-1">
                        + Expensas: {formatPriceARS(property.expenses)}/mes
                      </div>
                    ) : null}
                    <span
                      className={`inline-block mt-3 px-2.5 py-1 text-xs font-medium tracking-tight rounded-full border capitalize ${statusClass}`}
                    >
                      {property.status}
                    </span>
                  </div>
                </div>

                {/* Key features */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-6">
                  {property.bedrooms ? (
                    <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
                      <div className="inline-flex items-center justify-center h-8 w-8 rounded-md bg-accent/10 border border-accent/30 text-accent-300 mb-3">
                        <Bed className="h-4 w-4" />
                      </div>
                      <div className="text-2xl font-semibold tracking-tightest text-gray-50">
                        {property.bedrooms}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Dormitorios
                      </div>
                    </div>
                  ) : null}
                  {property.bathrooms ? (
                    <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
                      <div className="inline-flex items-center justify-center h-8 w-8 rounded-md bg-accent/10 border border-accent/30 text-accent-300 mb-3">
                        <Bath className="h-4 w-4" />
                      </div>
                      <div className="text-2xl font-semibold tracking-tightest text-gray-50">
                        {property.bathrooms}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">Banos</div>
                    </div>
                  ) : null}
                  <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
                    <div className="inline-flex items-center justify-center h-8 w-8 rounded-md bg-accent/10 border border-accent/30 text-accent-300 mb-3">
                      <Square className="h-4 w-4" />
                    </div>
                    <div className="text-2xl font-semibold tracking-tightest text-gray-50">
                      {property.area}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">m2</div>
                  </div>
                  {property.expenses ? (
                    <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
                      <div className="inline-flex items-center justify-center h-8 w-8 rounded-md bg-accent/10 border border-accent/30 text-accent-300 mb-3">
                        <Receipt className="h-4 w-4" />
                      </div>
                      <div className="text-base font-semibold tracking-tight text-gray-50">
                        {formatPriceARS(property.expenses)}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Expensas/mes
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Description */}
                <div className="mt-2 pt-6 border-t border-gray-800">
                  <h2 className="text-base font-semibold tracking-tight text-gray-50 mb-3">
                    Descripcion
                  </h2>
                  <p className="text-gray-400 leading-relaxed whitespace-pre-line tracking-tight text-sm md:text-base">
                    {property.description}
                  </p>
                </div>

                {/* Features */}
                {property.features.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-gray-800">
                    <h2 className="text-base font-semibold tracking-tight text-gray-50 mb-4">
                      Caracteristicas
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {property.features.map((feature, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-2 rounded-md border border-gray-800 bg-gray-900/50 px-3 py-2"
                        >
                          <Check className="h-4 w-4 text-accent-300 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-gray-300 tracking-tight">
                            {feature}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Mapa */}
              <div className="card p-6 md:p-8">
                <div className="flex items-center gap-2 text-gray-50 mb-2">
                  <MapPin className="h-4 w-4 text-accent-300" />
                  <h2 className="text-base font-semibold tracking-tight">
                    Ubicacion
                  </h2>
                </div>
                <p className="text-sm text-gray-400 mb-4">
                  {property.address}, {property.location}
                </p>
                <div className="relative w-full h-[360px] overflow-hidden rounded-lg border border-gray-800">
                  <iframe
                    src={mapUrl}
                    width="100%"
                    height="100%"
                    style={{ border: 0, filter: "invert(0.92) hue-rotate(180deg)" }}
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
                  className="inline-flex items-center gap-1.5 text-accent-300 hover:text-accent-400 mt-4 text-sm tracking-tight"
                >
                  Abrir en Google Maps
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>

            {/* Sidebar Contact */}
            <div className="lg:col-span-1">
              <div className="card p-6 lg:sticky lg:top-24">
                <h3 className="text-lg font-semibold tracking-tight text-gray-50 mb-1">
                  Interesado en esta propiedad?
                </h3>
                <p className="text-sm text-gray-400 mb-6">
                  Contactanos y un agente te respondera a la brevedad.
                </p>

                <form className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium tracking-tight text-gray-300 mb-2">
                      Nombre
                    </label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      placeholder="Tu nombre"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium tracking-tight text-gray-300 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      className="form-input"
                      placeholder="tu@email.com"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium tracking-tight text-gray-300 mb-2">
                      Telefono
                    </label>
                    <input
                      type="tel"
                      className="form-input"
                      placeholder="+54 11 1234-5678"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium tracking-tight text-gray-300 mb-2">
                      Mensaje
                    </label>
                    <textarea
                      rows={4}
                      className="form-input resize-none"
                      placeholder="Me gustaria mas informacion..."
                    />
                  </div>

                  <button type="submit" className="btn-accent w-full">
                    Enviar consulta
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>

                <div className="mt-6 pt-5 border-t border-gray-800 space-y-3">
                  <a
                    href="tel:+541112345678"
                    className="flex items-center gap-3 text-sm text-gray-300 hover:text-gray-50"
                  >
                    <Phone className="h-4 w-4 text-accent-300" />
                    +54 11 1234-5678
                  </a>
                  <a
                    href="mailto:info@barrerabrokers.com"
                    className="flex items-center gap-3 text-sm text-gray-300 hover:text-gray-50"
                  >
                    <Mail className="h-4 w-4 text-accent-300" />
                    info@barrerabrokers.com
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
