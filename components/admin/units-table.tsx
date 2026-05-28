"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Edit3, Copy, Loader2, Trash2 } from "lucide-react";
import { Unit } from "@/types";
import { formatPrice } from "@/lib/utils";

interface UnitsTableProps {
  units: Unit[];
  developmentId: string;
}

const unitStatusStyles: Record<string, string> = {
  disponible: "bg-emerald-500/10 border-emerald-500/30 text-emerald-700",
  reservada: "bg-amber-500/10 border-amber-500/30 text-amber-700",
  vendida: "bg-gray-500/10 border-ink/25 text-ink/60",
};

export function UnitsTable({ units, developmentId }: UnitsTableProps) {
  const router = useRouter();
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleDuplicate = async (unit: Unit) => {
    if (
      !confirm(
        `¿Duplicar la unidad "${unit.unitNumber}"? Se creará una copia que podrás editar.`
      )
    )
      return;

    setDuplicatingId(unit.id);
    setError("");

    try {
      const response = await fetch("/api/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          developmentId,
          unitNumber: `${unit.unitNumber} (copia)`,
          floor: unit.floor || undefined,
          bedrooms: unit.bedrooms,
          bathrooms: unit.bathrooms,
          area: unit.area,
          balconyArea: unit.balconyArea || undefined,
          totalArea: unit.totalArea || undefined,
          price: unit.price,
          expenses: unit.expenses || undefined,
          orientation: unit.orientation || undefined,
          status: "disponible",
          description: unit.description || undefined,
          features: unit.features || [],
          images: (unit.images || []).map((img) => ({
            url: img.url,
            type: img.type || "foto",
            isPrimary: img.isPrimary || false,
          })),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Error al duplicar");
        return;
      }

      const newUnit = await response.json();
      router.refresh();
      // Redirect to edit the new unit
      router.push(
        `/admin/desarrollos/${developmentId}/unidades/${newUnit.id}/editar`
      );
    } catch (err: any) {
      setError(err.message || "Error al duplicar");
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleDelete = async (unit: Unit) => {
    if (
      !confirm(
        `¿Eliminar la unidad "${unit.unitNumber}"? Esta accion no se puede deshacer.`
      )
    )
      return;

    setDeletingId(unit.id);
    setError("");

    try {
      const response = await fetch(`/api/units/${unit.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error || "Error al eliminar");
        return;
      }

      router.refresh();
    } catch (err: any) {
      setError(err.message || "Error al eliminar");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="card overflow-hidden">
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-2 text-sm">
          {error}
        </div>
      )}
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
            {units.map((unit) => (
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
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/admin/desarrollos/${developmentId}/unidades/${unit.id}/editar`}
                      className="inline-flex items-center gap-1 text-accent hover:text-accent-600 text-xs"
                    >
                      <Edit3 className="h-3 w-3" />
                      Editar
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDuplicate(unit)}
                      disabled={duplicatingId === unit.id}
                      className="inline-flex items-center gap-1 text-ink/50 hover:text-ink text-xs disabled:opacity-50 transition-colors"
                      title="Duplicar unidad"
                    >
                      {duplicatingId === unit.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      Duplicar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(unit)}
                      disabled={deletingId === unit.id}
                      className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 text-xs disabled:opacity-50 transition-colors"
                      title="Eliminar unidad"
                    >
                      {deletingId === unit.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
