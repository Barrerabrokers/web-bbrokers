"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { COMMON_AMENITIES, Development } from "@/types";

interface Props {
  development: Development;
}

export function DevelopmentEditor({ development }: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    name: development.name,
    shortDescription: development.shortDescription || "",
    description: development.description,
    location: development.location,
    address: development.address,
    status: development.status,
    totalUnits: development.totalUnits?.toString() || "",
    completionDate: development.completionDate || "",
    progress: development.progress?.toString() || "0",
    priceFrom: development.priceFrom?.toString() || "",
    amenities: [...development.amenities],
    features: development.features.join("\n"),
    highlight: development.highlight || false,
  });

  const toggleAmenity = (a: string) => {
    setFormData((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(a)
        ? prev.amenities.filter((x) => x !== a)
        : [...prev.amenities, a],
    }));
  };


  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setIsLoading(true);

    try {
      const response = await fetch(`/api/developments/${development.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          shortDescription: formData.shortDescription || undefined,
          description: formData.description,
          location: formData.location,
          address: formData.address,
          status: formData.status,
          totalUnits: formData.totalUnits
            ? parseInt(formData.totalUnits)
            : undefined,
          completionDate: formData.completionDate || undefined,
          progress: parseInt(formData.progress) || 0,
          priceFrom: formData.priceFrom
            ? parseFloat(formData.priceFrom)
            : undefined,
          amenities: formData.amenities,
          features: formData.features
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          highlight: formData.highlight,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Error al actualizar");
        return;
      }
      setSuccess(true);
      router.refresh();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        `¿Eliminar el desarrollo "${development.name}"? Esto borrará todas sus unidades e imágenes. Esta acción no se puede deshacer.`
      )
    )
      return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/developments/${development.id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        router.push("/admin/desarrollos");
        router.refresh();
      } else {
        const data = await response.json();
        setError(data.error || "Error al eliminar");
        setIsDeleting(false);
      }
    } catch (err: any) {
      setError(err.message);
      setIsDeleting(false);
    }
  };


  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-5 hover:bg-cream-100 transition-colors"
      >
        <div className="text-left">
          <h2 className="font-semibold text-ink">Información del desarrollo</h2>
          <p className="text-xs text-ink/60 mt-0.5">
            {expanded ? "Ocultar" : "Editar nombre, descripción, amenities y más"}
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="h-5 w-5 text-ink/60" />
        ) : (
          <ChevronDown className="h-5 w-5 text-ink/60" />
        )}
      </button>

      {expanded && (
        <form
          onSubmit={handleSave}
          className="border-t border-ink/15 p-6"
        >
          {error && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-2 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700 px-4 py-2 text-sm">
              ✓ Cambios guardados
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="label-tracking text-ink/85 block mb-2">
                Nombre *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full px-3 py-2 border border-ink/15 focus:border-accent focus:outline-none rounded"
              />
            </div>

            <div className="md:col-span-2">
              <label className="label-tracking text-ink/85 block mb-2">
                Descripción corta
              </label>
              <input
                type="text"
                value={formData.shortDescription}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    shortDescription: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-ink/15 focus:border-accent focus:outline-none rounded"
                maxLength={500}
              />
            </div>

            <div className="md:col-span-2">
              <label className="label-tracking text-ink/85 block mb-2">
                Descripción completa *
              </label>
              <textarea
                required
                rows={4}
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="w-full px-3 py-2 border border-ink/15 focus:border-accent focus:outline-none rounded"
              />
            </div>


            <div>
              <label className="label-tracking text-ink/85 block mb-2">
                Ubicación *
              </label>
              <input
                type="text"
                required
                value={formData.location}
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
                className="w-full px-3 py-2 border border-ink/15 focus:border-accent focus:outline-none rounded"
              />
            </div>

            <div>
              <label className="label-tracking text-ink/85 block mb-2">
                Dirección *
              </label>
              <input
                type="text"
                required
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                className="w-full px-3 py-2 border border-ink/15 focus:border-accent focus:outline-none rounded"
              />
            </div>

            <div>
              <label className="label-tracking text-ink/85 block mb-2">
                Estado *
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value as any })
                }
                className="w-full px-3 py-2 border border-ink/15 focus:border-accent focus:outline-none rounded"
              >
                <option value="pre_venta">Pre-venta</option>
                <option value="en_construccion">En construcción</option>
                <option value="finalizado">Finalizado</option>
                <option value="entregado">Entregado</option>
              </select>
            </div>

            <div>
              <label className="label-tracking text-ink/85 block mb-2">
                Fecha de entrega
              </label>
              <input
                type="text"
                value={formData.completionDate}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    completionDate: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-ink/15 focus:border-accent focus:outline-none rounded"
                placeholder="Q4 2026"
              />
            </div>

            <div>
              <label className="label-tracking text-ink/85 block mb-2">
                Avance (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={formData.progress}
                onChange={(e) =>
                  setFormData({ ...formData, progress: e.target.value })
                }
                className="w-full px-3 py-2 border border-ink/15 focus:border-accent focus:outline-none rounded"
              />
            </div>

            <div>
              <label className="label-tracking text-ink/85 block mb-2">
                Total unidades
              </label>
              <input
                type="number"
                min="0"
                value={formData.totalUnits}
                onChange={(e) =>
                  setFormData({ ...formData, totalUnits: e.target.value })
                }
                className="w-full px-3 py-2 border border-ink/15 focus:border-accent focus:outline-none rounded"
              />
            </div>


            <div className="md:col-span-2">
              <label className="label-tracking text-ink/85 block mb-2">
                Precio desde (USD)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.priceFrom}
                onChange={(e) =>
                  setFormData({ ...formData, priceFrom: e.target.value })
                }
                className="w-full px-3 py-2 border border-ink/15 focus:border-accent focus:outline-none rounded"
              />
            </div>

            <div className="md:col-span-2">
              <label className="label-tracking text-ink/85 block mb-3">
                Amenities
              </label>
              <div className="flex flex-wrap gap-2">
                {COMMON_AMENITIES.map((a) => {
                  const active = formData.amenities.includes(a);
                  return (
                    <button
                      key={a}
                      type="button"
                      onClick={() => toggleAmenity(a)}
                      className={`px-3 py-1.5 rounded-full text-xs uppercase tracking-widest border transition-colors ${
                        active
                          ? "bg-accent text-ink border-accent"
                          : "bg-white text-ink/70 border-ink/20 hover:border-accent"
                      }`}
                    >
                      {a}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="label-tracking text-ink/85 block mb-2">
                Características adicionales (una por línea)
              </label>
              <textarea
                rows={3}
                value={formData.features}
                onChange={(e) =>
                  setFormData({ ...formData, features: e.target.value })
                }
                className="w-full px-3 py-2 border border-ink/15 focus:border-accent focus:outline-none rounded"
              />
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.highlight}
                  onChange={(e) =>
                    setFormData({ ...formData, highlight: e.target.checked })
                  }
                  className="h-4 w-4 accent-accent"
                />
                <span className="text-sm text-ink">Desarrollo destacado</span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between mt-6 pt-5 border-t border-ink/15">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="inline-flex items-center gap-2 text-red-600 hover:text-red-700 text-sm disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {isDeleting ? "Eliminando..." : "Eliminar desarrollo"}
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary disabled:opacity-50 inline-flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {isLoading ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
