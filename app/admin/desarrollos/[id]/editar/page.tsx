import Link from "next/link";
import { ArrowLeft, Plus, Building2 } from "lucide-react";
import { notFound } from "next/navigation";
import { getDevelopmentById } from "@/lib/developments-db";
import { DEVELOPMENT_STATUS_LABELS } from "@/types";
import { formatPrice } from "@/lib/utils";
import { DevelopmentEditor } from "@/components/admin/development-editor";
import { UnitsTable } from "@/components/admin/units-table";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
          <UnitsTable units={development.units} developmentId={development.id} />
        )}
      </div>
    </div>
  );
}
