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
  ArrowUpRight,
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
    disponible: "border-emerald-700/30 text-emerald-800 bg-emerald-50",
    reservada: "border-amber-700/30 text-amber-800 bg-amber-50",
    vendida: "border-ink/20 text-ink/60 bg-cream-300",
  };
  const statusClass = statusStyles[property.status] ?? statusStyles.vendida;

  return (
    <div className="min-h-screen bg-cream-200">
      <Header />

      <main className="pt-28 pb-32">
        <div className="container-custom">
          {/* Breadcrumb */}
          <div className="mb-8">
            <Link
              href="/propiedades"
              className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-ink/60 hover:text-ink transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Volver a propiedades
            </Link>
          </div>

          <div className="grid lg:grid-cols-3 gap-10 lg:gap-12">
            {/* Main */}
            <div className="lg:col-span-2 space-y-10">
              {/* Galeria */}
              <PropertyGallery
                images={property.images}
                title={property.title}
                category={property.category}
              />

              {/* Detalles */}
              <div className="border-t border-ink/15 pt-10">
                <div className="grid grid-cols-12 gap-6 mb-10 pb-10 border-b border-ink/15">
                  <div className="col-span-12 md:col-span-8">
                    <h1 className="font-display font-light text-4xl md:text-5xl lg:text-6xl leading-[1.02] tracking-[-0.025em] text-ink mb-5">
                      {property.title}
                    </h1>
                    <div className="flex items-center text-ink/70 gap-2 text-sm">
                      <MapPin className="h-4 w-4" />
                      <span>{property.location}</span>
                    </div>
                    <p className="text-ink/55 text-sm mt-1">
                      {property.address}
                    </p>
                  </div>
                  <div className="col-span-12 md:col-span-4 md:text-right">
                    <div className="font-display font-light text-4xl md:text-5xl text-ink leading-none">
                      {formatPrice(property.price)}
                    </div>
                    {property.expenses ? (
                      <div className="text-xs text-ink/60 mt-2">
                        + Expensas: {formatPriceARS(property.expenses)}/mes
                      </div>
                    ) : null}
                    <span
                      className={`inline-block mt-4 px-3 py-1 text-[10px] uppercase tracking-widest font-medium rounded-full border capitalize ${statusClass}`}
                    >
                      {property.status}
                    </span>
                  </div>
                </div>

                {/* Key features as editorial grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-8 mb-12">
                  {property.bedrooms ? (
                    <div>
                      <Bed className="h-5 w-5 text-ink/50 mb-3" />
                      <div className="font-display font-light text-3xl text-ink leading-none mb-1">
                        {property.bedrooms}
                      </div>
                      <div className="text-[10px] uppercase tracking-widest text-ink/55">
                        Dormitorios
                      </div>
                    </div>
                  ) : null}
                  {property.bathrooms ? (
                    <div>
                      <Bath className="h-5 w-5 text-ink/50 mb-3" />
                      <div className="font-display font-light text-3xl text-ink leading-none mb-1">
                        {property.bathrooms}
                      </div>
                      <div className="text-[10px] uppercase tracking-widest text-ink/55">
                        Banos
                      </div>
                    </div>
                  ) : null}
                  <div>
                    <Square className="h-5 w-5 text-ink/50 mb-3" />
                    <div className="font-display font-light text-3xl text-ink leading-none mb-1">
                      {property.area}
                    </div>
                    <div className="text-[10px] uppercase tracking-widest text-ink/55">
                      Metros2
                    </div>
                  </div>
                  {property.expenses ? (
                    <div>
                      <Receipt className="h-5 w-5 text-ink/50 mb-3" />
                      <div className="font-display font-light text-2xl text-ink leading-none mb-1 truncate">
                        {formatPriceARS(property.expenses)}
                      </div>
                      <div className="text-[10px] uppercase tracking-widest text-ink/55">
                        Expensas/mes
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Description */}
                <div className="mb-12 pt-8 border-t border-ink/15">
                  <p className="eyebrow mb-5">Descripcion</p>
                  <p className="text-ink/80 text-base md:text-lg leading-relaxed whitespace-pre-line">
                    {property.description}
                  </p>
                </div>

                {/* Features */}
                {property.features.length > 0 && (
                  <div className="pt-8 border-t border-ink/15">
                    <p className="eyebrow mb-6">Caracteristicas</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                      {property.features.map((feature, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-3 py-2 border-b border-ink/10"
                        >
                          <Check className="h-4 w-4 text-ink/60 flex-shrink-0 mt-1" />
                          <span className="text-sm text-ink/85 tracking-tight">
                            {feature}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Mapa */}
              <div className="pt-10 border-t border-ink/15">
                <div className="flex items-center gap-2 text-ink mb-2">
                  <MapPin className="h-4 w-4 text-ink/60" />
                  <p className="eyebrow">Ubicacion</p>
                </div>
                <p className="text-ink/70 text-base mb-5">
                  {property.address}, {property.location}
                </p>
                <div className="relative w-full h-[420px] overflow-hidden border border-ink/15">
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
                  className="inline-flex items-center gap-1.5 text-sm text-ink hover:text-accent mt-5 link-underline"
                >
                  Abrir en Google Maps
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>

            {/* Sidebar Contact */}
            <div className="lg:col-span-1">
              <div className="card p-7 lg:sticky lg:top-28">
                <p className="eyebrow mb-4">Consultar</p>
                <h3 className="font-display font-light text-3xl text-ink mb-2 leading-tight">
                  Interesado en
                  <br />
                  esta propiedad?
                </h3>
                <p className="text-sm text-ink/65 mb-6">
                  Contactanos y un agente te respondera a la brevedad.
                </p>

                <form className="space-y-5">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-ink/55 mb-2">
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
                    <label className="block text-[10px] uppercase tracking-widest text-ink/55 mb-2">
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
                    <label className="block text-[10px] uppercase tracking-widest text-ink/55 mb-2">
                      Telefono
                    </label>
                    <input
                      type="tel"
                      className="form-input"
                      placeholder="+54 11 1234-5678"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-ink/55 mb-2">
                      Mensaje
                    </label>
                    <textarea
                      rows={4}
                      className="form-input resize-none"
                      placeholder="Me gustaria mas informacion..."
                    />
                  </div>

                  <button type="submit" className="btn-primary w-full mt-2">
                    Enviar consulta
                  </button>
                </form>

                <div className="mt-6 pt-5 border-t border-ink/15 space-y-3">
                  <a
                    href="tel:+541112345678"
                    className="flex items-center gap-3 text-sm text-ink/85 hover:text-ink"
                  >
                    <Phone className="h-4 w-4 text-ink/60" />
                    +54 11 1234-5678
                  </a>
                  <a
                    href="mailto:info@barrerabrokers.com"
                    className="flex items-center gap-3 text-sm text-ink/85 hover:text-ink"
                  >
                    <Mail className="h-4 w-4 text-ink/60" />
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
