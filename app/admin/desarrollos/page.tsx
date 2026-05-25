import Link from "next/link";
import Image from "next/image";
import { Plus, Building2, MapPin, Edit3 } from "lucide-react";
import { getDevelopments } from "@/lib/developments-db";
import { DEVELOPMENT_STATUS_LABELS } from "@/types";
import { formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const statusStyles: Record<string, string> = {
  pre_venta: "bg-blue-500/10 border-blue-500/30 text-blue-700",
  en_construccion: "bg-amber-500/10 border-amber-500/30 text-amber-700",
  finalizado: "bg-emerald-500/10 border-emerald-500/30 text-emerald-700",
  entregado: "bg-gray-500/10 border-ink/25 text-ink/60",
};

export default async function AdminDevelopmentsPage() {
  const developments = await getDevelopments();

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-ink mb-1">
            Desarrollos
          </h1>
          <p className="text-sm text-ink/60">
            Gestionar proyectos inmobiliarios y sus unidades
          </p>
        </div>
        <Link href="/admin/desarrollos/nuevo" className="btn-primary">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo desarrollo
        </Link>
      </div>


      {developments.length === 0 ? (
        <div className="card p-12 text-center">
          <Building2 className="h-12 w-12 text-ink/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-ink mb-2">
            Aún no hay desarrollos
          </h3>
          <p className="text-sm text-ink/60 mb-6">
            Comenzá agregando tu primer proyecto inmobiliario.
          </p>
          <Link href="/admin/desarrollos/nuevo" className="btn-primary">
            <Plus className="h-4 w-4 mr-2" />
            Crear desarrollo
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {developments.map((dev) => {
            const primaryImage =
              dev.images.find((i) => i.isPrimary)?.url || dev.images[0]?.url;
            return (
              <Link
                key={dev.id}
                href={`/admin/desarrollos/${dev.id}/editar`}
                className="group card overflow-hidden hover:border-accent/40 transition-all"
              >
                <div className="relative aspect-[4/3] bg-cream-200 overflow-hidden">
                  {primaryImage ? (
                    <Image
                      src={primaryImage}
                      alt={dev.name}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-ink/30">
                      <Building2 className="h-12 w-12" />
                    </div>
                  )}
                  <div className="absolute top-3 left-3">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-[10px] uppercase tracking-widest font-medium border ${
                        statusStyles[dev.status] ?? statusStyles.entregado
                      }`}
                    >
                      {DEVELOPMENT_STATUS_LABELS[dev.status]}
                    </span>
                  </div>
                  {dev.highlight && (
                    <div className="absolute top-3 right-3">
                      <span className="inline-block px-2.5 py-1 rounded-full text-[10px] uppercase tracking-widest font-medium bg-accent text-ink">
                        Destacado
                      </span>
                    </div>
                  )}
                </div>


                <div className="p-5">
                  <h3 className="font-display font-light text-2xl text-ink mb-2 group-hover:italic transition-all">
                    {dev.name}
                  </h3>
                  <div className="flex items-center gap-2 text-ink/60 text-sm mb-4">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{dev.location}</span>
                  </div>

                  {/* Progress */}
                  <div className="mb-4">
                    <div className="flex justify-between text-[10px] uppercase tracking-widest text-ink/50 mb-1.5">
                      <span>Avance</span>
                      <span>{dev.progress}%</span>
                    </div>
                    <div className="h-1 bg-ink/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full"
                        style={{ width: `${dev.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 pt-4 border-t border-ink/10">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-ink/50">
                        Unidades
                      </p>
                      <p className="text-sm font-semibold text-ink">
                        {dev.availableUnits || 0} / {dev.unitsCount || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-ink/50">
                        Desde
                      </p>
                      <p className="text-sm font-semibold text-accent">
                        {dev.minPriceAvailable
                          ? formatPrice(dev.minPriceAvailable)
                          : dev.priceFrom
                          ? formatPrice(dev.priceFrom)
                          : "—"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-ink/10 flex items-center gap-2 text-accent text-xs uppercase tracking-widest">
                    <Edit3 className="h-3 w-3" />
                    <span>Editar y gestionar unidades</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
