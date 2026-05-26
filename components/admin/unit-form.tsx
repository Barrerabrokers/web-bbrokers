"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Save, ArrowLeft, Trash2 } from "lucide-react";
import { UNIT_IMAGE_TYPES, Unit } from "@/types";
import { supabase } from "@/lib/supabase";
import { type ImageItem } from "@/components/admin/image-uploader";
import { MediaUploader } from "@/components/admin/media-uploader";

type ImageMeta = { type: string };

interface Props {
  developmentId: string;
  developmentName: string;
  unit?: Unit; // when present = edit mode
}

const ORIENTATIONS = [
  "Frente",
  "Contrafrente",
  "Lateral",
  "Norte",
  "Sur",
  "Este",
  "Oeste",
];

export function UnitForm({ developmentId, developmentName, unit }: Props) {
  const router = useRouter();
  const isEdit = !!unit;

  const [isLoading, setIsLoading] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  // Prefill items from unit images if editing
  const initialItems: ImageItem[] = unit
    ? unit.images.map((img) => ({ kind: "existing" as const, url: img.url }))
    : [];
  const initialMeta: ImageMeta[] = unit
    ? unit.images.map((img) => ({ type: img.type || "foto" }))
    : [];
  const initialPrimary = unit
    ? Math.max(0, unit.images.findIndex((i) => i.isPrimary))
    : 0;

  const [items, setItems] = useState<ImageItem[]>(initialItems);
  const [primaryIndex, setPrimaryIndex] = useState(initialPrimary);
  const [imageMeta, setImageMeta] = useState<ImageMeta[]>(initialMeta);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);


  const [formData, setFormData] = useState({
    unitNumber: unit?.unitNumber || "",
    floor: unit?.floor || "",
    bedrooms: unit?.bedrooms?.toString() || "1",
    bathrooms: unit?.bathrooms?.toString() || "1",
    area: unit?.area?.toString() || "",
    balconyArea: unit?.balconyArea?.toString() || "",
    totalArea: unit?.totalArea?.toString() || "",
    price: unit?.price?.toString() || "",
    expenses: unit?.expenses?.toString() || "",
    orientation: unit?.orientation || "",
    status: unit?.status || "disponible",
    description: unit?.description || "",
    features: unit?.features?.join("\n") || "",
  });

  const handleItemsChange = (
    nextItems: ImageItem[],
    nextPrimary: number
  ) => {
    setImageMeta((prev) => {
      const next = [...prev];
      while (next.length < nextItems.length) next.push({ type: "foto" });
      while (next.length > nextItems.length) next.pop();
      return next;
    });
    setItems(nextItems);
    setPrimaryIndex(nextPrimary);
  };

  const updateMetaType = (idx: number, type: string) => {
    setImageMeta((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], type };
      return next;
    });
  };

  const buildFinalImages = async () => {
    if (items.length === 0) return [];
    setUploadingImages(true);
    try {
      const urls: { url: string; type: string; isPrimary: boolean }[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const meta = imageMeta[i] || { type: "foto" };
        let url: string;

        if (item.kind === "existing") {
          url = item.url;
        } else {
          const ext = item.file.name.split(".").pop() || "jpg";
          const fileName = `unit-${Date.now()}-${Math.random()
            .toString(36)
            .substring(7)}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from("properties")
            .upload(fileName, item.file, {
              cacheControl: "3600",
              upsert: false,
              contentType: item.file.type,
            });
          if (uploadError) throw new Error(uploadError.message);

          const { data: urlData } = supabase.storage
            .from("properties")
            .getPublicUrl(fileName);
          url = urlData.publicUrl;
        }

        // Respetamos el orden visual y marcamos la portada con flag isPrimary
        urls.push({ url, type: meta.type, isPrimary: i === primaryIndex });
      }

      return urls;
    } finally {
      setUploadingImages(false);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const images = await buildFinalImages();

      const payload = {
        developmentId,
        unitNumber: formData.unitNumber,
        floor: formData.floor || undefined,
        bedrooms: parseInt(formData.bedrooms),
        bathrooms: parseInt(formData.bathrooms),
        area: parseFloat(formData.area),
        balconyArea: formData.balconyArea
          ? parseFloat(formData.balconyArea)
          : undefined,
        totalArea: formData.totalArea
          ? parseFloat(formData.totalArea)
          : undefined,
        price: parseFloat(formData.price),
        expenses: formData.expenses
          ? parseFloat(formData.expenses)
          : undefined,
        orientation: formData.orientation || undefined,
        status: formData.status,
        description: formData.description || undefined,
        features: formData.features
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        images,
      };

      const response = await fetch(
        isEdit ? `/api/units/${unit!.id}` : "/api/units",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Error al guardar");
        setIsLoading(false);
        return;
      }

      router.push(`/admin/desarrollos/${developmentId}/editar`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!unit) return;
    if (
      !confirm(
        `¿Eliminar la unidad "${unit.unitNumber}"? Esta acción no se puede deshacer.`
      )
    )
      return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/units/${unit.id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        router.push(`/admin/desarrollos/${developmentId}/editar`);
        router.refresh();
      } else {
        setError("Error al eliminar");
        setIsDeleting(false);
      }
    } catch (err: any) {
      setError(err.message);
      setIsDeleting(false);
    }
  };


  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/admin/desarrollos/${developmentId}/editar`}
          className="inline-flex items-center text-ink/60 hover:text-ink mb-3 text-sm"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver al desarrollo
        </Link>
        <h1 className="heading-serif text-3xl text-ink mb-1">
          {isEdit ? `Editar unidad ${unit!.unitNumber}` : "Nueva unidad"}
        </h1>
        <p className="text-ink/60 text-sm">{developmentName}</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card p-8">
        {/* IMAGES */}
        <div className="mb-8 pb-8 border-b border-ink/15">
          <MediaUploader
            items={items}
            primaryIndex={primaryIndex}
            onImagesChange={handleItemsChange}
            videoUrl={videoUrl}
            onVideoChange={setVideoUrl}
            imageLabel="Imágenes y planos de la unidad"
            videoLabel="Video de la unidad"
            imageHelperText="Subí fotos de la unidad y planos. Marcá el tipo de cada imagen."
          />

          {items.length > 0 && (
            <div className="mt-5 space-y-2">
              <p className="label-tracking text-ink/85">
                Tipo de cada imagen
              </p>
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-2 bg-cream-100 rounded"
                >
                  <span className="text-xs text-ink/60 w-8">#{idx + 1}</span>
                  <select
                    value={imageMeta[idx]?.type || "foto"}
                    onChange={(e) => updateMetaType(idx, e.target.value)}
                    className="text-sm border border-ink/15 rounded px-2 py-1 bg-white"
                  >
                    {UNIT_IMAGE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>


        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className="label-tracking text-ink/85 block mb-2">
              Identificador *
            </label>
            <input
              type="text"
              required
              value={formData.unitNumber}
              onChange={(e) =>
                setFormData({ ...formData, unitNumber: e.target.value })
              }
              className="w-full px-3 py-2 border border-ink/15 focus:border-accent focus:outline-none rounded"
              placeholder="PB A, 1°B, 5°C..."
            />
          </div>

          <div>
            <label className="label-tracking text-ink/85 block mb-2">
              Piso
            </label>
            <input
              type="text"
              value={formData.floor}
              onChange={(e) =>
                setFormData({ ...formData, floor: e.target.value })
              }
              className="w-full px-3 py-2 border border-ink/15 focus:border-accent focus:outline-none rounded"
              placeholder="PB, 1, 2, 3..."
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
              <option value="disponible">Disponible</option>
              <option value="reservada">Reservada</option>
              <option value="vendida">Vendida</option>
            </select>
          </div>

          <div>
            <label className="label-tracking text-ink/85 block mb-2">
              Ambientes *
            </label>
            <select
              required
              value={formData.bedrooms}
              onChange={(e) =>
                setFormData({ ...formData, bedrooms: e.target.value })
              }
              className="w-full px-3 py-2 border border-ink/15 focus:border-accent focus:outline-none rounded"
            >
              <option value="0">Monoambiente</option>
              <option value="1">1 ambiente</option>
              <option value="2">2 ambientes</option>
              <option value="3">3 ambientes</option>
              <option value="4">4 ambientes</option>
              <option value="5">5+ ambientes</option>
            </select>
          </div>

          <div>
            <label className="label-tracking text-ink/85 block mb-2">
              Baños *
            </label>
            <input
              type="number"
              required
              min="0"
              value={formData.bathrooms}
              onChange={(e) =>
                setFormData({ ...formData, bathrooms: e.target.value })
              }
              className="w-full px-3 py-2 border border-ink/15 focus:border-accent focus:outline-none rounded"
            />
          </div>

          <div>
            <label className="label-tracking text-ink/85 block mb-2">
              Orientación
            </label>
            <select
              value={formData.orientation}
              onChange={(e) =>
                setFormData({ ...formData, orientation: e.target.value })
              }
              className="w-full px-3 py-2 border border-ink/15 focus:border-accent focus:outline-none rounded"
            >
              <option value="">Sin especificar</option>
              {ORIENTATIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>


          <div>
            <label className="label-tracking text-ink/85 block mb-2">
              Superficie cubierta (m²) *
            </label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={formData.area}
              onChange={(e) =>
                setFormData({ ...formData, area: e.target.value })
              }
              className="w-full px-3 py-2 border border-ink/15 focus:border-accent focus:outline-none rounded"
              placeholder="45"
            />
          </div>

          <div>
            <label className="label-tracking text-ink/85 block mb-2">
              Balcón / terraza (m²)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.balconyArea}
              onChange={(e) =>
                setFormData({ ...formData, balconyArea: e.target.value })
              }
              className="w-full px-3 py-2 border border-ink/15 focus:border-accent focus:outline-none rounded"
              placeholder="8"
            />
          </div>

          <div>
            <label className="label-tracking text-ink/85 block mb-2">
              Superficie total (m²)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.totalArea}
              onChange={(e) =>
                setFormData({ ...formData, totalArea: e.target.value })
              }
              className="w-full px-3 py-2 border border-ink/15 focus:border-accent focus:outline-none rounded"
              placeholder="53"
            />
          </div>

          <div>
            <label className="label-tracking text-ink/85 block mb-2">
              Precio (USD) *
            </label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={formData.price}
              onChange={(e) =>
                setFormData({ ...formData, price: e.target.value })
              }
              className="w-full px-3 py-2 border border-ink/15 focus:border-accent focus:outline-none rounded"
              placeholder="95000"
            />
          </div>

          <div className="md:col-span-2">
            <label className="label-tracking text-ink/85 block mb-2">
              Expensas (ARS/mes)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.expenses}
              onChange={(e) =>
                setFormData({ ...formData, expenses: e.target.value })
              }
              className="w-full px-3 py-2 border border-ink/15 focus:border-accent focus:outline-none rounded"
              placeholder="180000"
            />
          </div>


          <div className="md:col-span-3">
            <label className="label-tracking text-ink/85 block mb-2">
              Descripción de la unidad
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full px-3 py-2 border border-ink/15 focus:border-accent focus:outline-none rounded"
              placeholder="Descripción específica de esta unidad..."
            />
          </div>

          <div className="md:col-span-3">
            <label className="label-tracking text-ink/85 block mb-2">
              Características (una por línea)
            </label>
            <textarea
              rows={3}
              value={formData.features}
              onChange={(e) =>
                setFormData({ ...formData, features: e.target.value })
              }
              className="w-full px-3 py-2 border border-ink/15 focus:border-accent focus:outline-none rounded"
              placeholder="Cocina integrada&#10;Piso de madera&#10;Aire acondicionado"
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-ink/15">
          {isEdit && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="inline-flex items-center gap-2 text-red-600 hover:text-red-700 text-sm disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {isDeleting ? "Eliminando..." : "Eliminar unidad"}
            </button>
          )}
          <div className="flex gap-3 ml-auto">
            <Link
              href={`/admin/desarrollos/${developmentId}/editar`}
              className="px-6 py-3 border border-ink/25 text-ink/85 hover:bg-cream-200 transition-colors rounded"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={isLoading || uploadingImages}
              className="flex items-center gap-2 btn-primary disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {uploadingImages
                ? "Subiendo imágenes..."
                : isLoading
                ? "Guardando..."
                : isEdit
                ? "Guardar cambios"
                : "Crear unidad"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
