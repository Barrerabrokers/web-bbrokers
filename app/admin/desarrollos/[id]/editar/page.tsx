import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Plus, Edit3, Building2 } from "lucide-react";
import { notFound } from "next/navigation";
import { getDevelopmentById } from "@/lib/developments-db";
import { DEVELOPMENT_STATUS_LABELS } from "@/types";
import { formatPrice } from "@/lib/utils";
import { DevelopmentEditor } from "@/components/admin/development-editor";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const unitStatusStyles: Record<string, string> = {
  disponible: "bg-emerald-500/10 border-emerald-500/30 text-emerald-700",
  reservada: "bg-amber-500/10 border-amber-500/30 text-amber-700",
  vendida: "bg-gray-500/10 border-ink/25 text-ink/60",
};

export default async function EditDevelopmentPage({
  params,
}: {
  params: { id: string };
}) {
  const development = await getDevelopmentById(params.id);
  if (!development) notFound();

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/desarrollos"
          className="inline-flex items-center text-ink/60 hover:text-ink mb-3 text-sm"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a desarrollos
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="heading-serif text-3xl text-ink mb-1">
              {development.name}
            </h1>
            <p className="text-ink/60 text-sm">
              {development.location} ·{" "}
              {DEVELOPMENT_STATUS_LABELS[development.status]}
            </p>
          </div>
        </div>
      </div>


      {/* DEVELOPMENT EDITOR */}
      <DevelopmentEditor development={development} />

      {/* UNITS SECTION */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-ink">
              Unidades del desarrollo
            </h2>
            <p className="text-sm text-ink/60 mt-1">
              {development.units?.length || 0} unidades cargadas ·{" "}
              {development.availableUnits || 0} disponibles
            </p>
          </div>
          <Link
            href={`/admin/desarrollos/${development.id}/unidades/nueva`}
            className="btn-primary"
          >
            <Plus className="h-4 w-4 mr-2" />
            Agregar unidad
          </Link>
        </div>

        {!development.units || development.units.length === 0 ? (
          <div className="card p-10 text-center">
            <Building2 className="h-10 w-10 text-ink/30 mx-auto mb-3" />
            <h3 className="font-semibold text-ink mb-1">
              Aún no hay unidades
            </h3>
            <p className="text-sm text-ink/60 mb-4">
              Comenzá agregando la primera unidad de este desarrollo.
            </p>
            <Link
              href={`/admin/desarrollos/${development.id}/unidades/nueva`}
              className="btn-primary inline-flex"
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar unidad
            </Link>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink/15 text-xs uppercase text-ink/60 tracking-widest bg-cream-100">
                    <th className="text-left py-3 px-4 font-medium">Unidad</th>
                    <th className="text-left py-3 px-4 font-medium">Piso</th>
                    <th className="text-left py-3 px-4 font-medium">Amb.</th>
                    <th className="text-left py-3 px-4 font-medium">m²</th>
                    <th className="text-left py-3 px-4 font-medium">Precio</th>
                    <th className="text-left py-3 px-4 font-medium">Estado</th>
                    <th className="text-left py-3 px-4 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {development.units.map((unit) => (
                    <tr
                      key={unit.id}
                      className="border-b border-ink/15 hover:bg-cream-100/50 transition-colors"
                    >
                      <td className="py-3 px-4 font-medium text-ink">
                        {unit.unitNumber}
                      </td>
                      <td className="py-3 px-4 text-ink/75">
                        {unit.floor || "—"}
                      </td>
                      <td className="py-3 px-4 text-ink/75">
                        {unit.bedrooms} amb · {unit.bathrooms} bañ
                      </td>
                      <td className="py-3 px-4 text-ink/75">
                        {unit.area} m²
                        {unit.balconyArea
                          ? ` + ${unit.balconyArea} balcón`
                          : ""}
                      </td>
                      <td className="py-3 px-4 font-semibold text-accent">
                        {formatPrice(unit.price)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] uppercase tracking-widest font-medium border capitalize ${
                            unitStatusStyles[unit.status] ??
                            unitStatusStyles.vendida
                          }`}
                        >
                          {unit.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <Link
                          href={`/admin/desarrollos/${development.id}/unidades/${unit.id}/editar`}
                          className="inline-flex items-center gap-1 text-accent hover:text-accent-600 text-xs"
                        >
                          <Edit3 className="h-3 w-3" />
                          Editar
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
