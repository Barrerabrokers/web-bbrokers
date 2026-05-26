"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Save, Trash2, ChevronDown, ChevronUp, ImageIcon, Loader2, FileText, Upload, X } from "lucide-react";
import { COMMON_AMENITIES, Development, DevelopmentImage, DEVELOPMENT_IMAGE_TYPES, DevelopmentImageType } from "@/types";
import { ImageUploader, ImageItem } from "./image-uploader";

interface Props {
  development: Development;
}

export function DevelopmentEditor({ development }: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [imagesExpanded, setImagesExpanded] = useState(false);
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

  // === IMAGE STATE ===
  const [imageItems, setImageItems] = useState<ImageItem[]>(() =>
    (development.images || []).map((img) => ({
      kind: "existing" as const,
      url: img.url,
      id: img.id || `existing-${img.url}`,
    }))
  );

  // === BROCHURE STATE ===
  const [brochureUrl, setBrochureUrl] = useState<string>(development.brochureUrl || "");
  const [brochureFile, setBrochureFile] = useState<File | null>(null);
  const [brochureExpanded, setBrochureExpanded] = useState(false);
  const [isUploadingBrochure, setIsUploadingBrochure] = useState(false);

  const [imagePrimaryIndex, setImagePrimaryIndex] = useState<number>(() => {
    const idx = (development.images || []).findIndex((img) => img.isPrimary);
    return idx >= 0 ? idx : 0;
  });

  const [imagesMeta, setImagesMeta] = useState<
    { type: DevelopmentImageType; caption: string }[]
  >(() =>
    (development.images || []).map((img) => ({
      type: img.type || "otro",
      caption: img.caption || "",
    }))
  );

  const handleImagesChange = useCallback(
    (newItems: ImageItem[], newPrimary: number) => {
      // Rebuild meta to follow item reordering
      setImagesMeta((prev) => {
        const newMeta = newItems.map((item) => {
          // Try to find the item in the old list by id
          const oldIdx = imageItems.findIndex((old) => old.id === item.id);
          if (oldIdx >= 0 && oldIdx < prev.length) {
            return prev[oldIdx];
          }
          return { type: "otro" as DevelopmentImageType, caption: "" };
        });
        return newMeta;
      });
      setImageItems(newItems);
      setImagePrimaryIndex(newPrimary);
    },
    [imageItems]
  );

  const handleMetaChange = (
    index: number,
    field: "type" | "caption",
    value: string
  ) => {
    setImagesMeta((prev) => {
      const updated = [...prev];
      if (!updated[index]) {
        updated[index] = { type: "otro", caption: "" };
      }
      if (field === "type") {
        updated[index].type = value as DevelopmentImageType;
      } else {
        updated[index].caption = value;
      }
      return updated;
    });
  };

  const toggleAmenity = (a: string) => {
    setFormData((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(a)
        ? prev.amenities.filter((x) => x !== a)
        : [...prev.amenities, a],
    }));
  };

  // Upload new image files and return final images array
  const uploadAndBuildImages = async (): Promise<DevelopmentImage[]> => {
    const result: DevelopmentImage[] = [];

    for (let idx = 0; idx < imageItems.length; idx++) {
      const item = imageItems[idx];
      const meta = imagesMeta[idx] || { type: "otro", caption: "" };

      if (item.kind === "existing") {
        result.push({
          url: item.url,
          type: meta.type,
          caption: meta.caption,
          displayOrder: idx,
          isPrimary: idx === imagePrimaryIndex,
        });
      } else {
        // Upload new file
        const formData = new FormData();
        formData.append("files", item.file);
        formData.append("folder", "developments");

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          let errorMsg = "Error subiendo imagen";
          try {
            const err = await response.json();
            errorMsg = err.error || errorMsg;
          } catch {
            errorMsg = `Error del servidor: ${response.status}`;
          }
          throw new Error(errorMsg);
        }

        const data = await response.json();
        const url = data.urls[0];

        result.push({
          url,
          type: meta.type,
          caption: meta.caption,
          displayOrder: idx,
          isPrimary: idx === imagePrimaryIndex,
        });
      }
    }

    return result;
  };

  // Upload brochure PDF if new file selected
  const uploadBrochure = async (): Promise<string | undefined> => {
    if (!brochureFile) return brochureUrl || undefined;

    const uploadFormData = new FormData();
    uploadFormData.append("files", brochureFile);
    uploadFormData.append("folder", "brochures");

    const response = await fetch("/api/upload", {
      method: "POST",
      body: uploadFormData,
    });

    if (!response.ok) {
      let errorMsg = "Error subiendo brochure";
      try {
        const err = await response.json();
        errorMsg = err.error || errorMsg;
      } catch {
        const text = await response.text();
        if (text.toLowerCase().includes("entity too large") || text.toLowerCase().includes("request en")) {
          errorMsg = "El archivo es demasiado grande. Máximo 4.5MB en Vercel.";
        } else {
          errorMsg = `Error del servidor: ${response.status}`;
        }
      }
      throw new Error(errorMsg);
    }

    const data = await response.json();
    return data.urls[0];
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setIsLoading(true);

    try {
      // First upload any new images
      const images = await uploadAndBuildImages();

      // Upload brochure if new file
      const finalBrochureUrl = await uploadBrochure();

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
          images,
          brochureUrl: finalBrochureUrl || null,
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
    <div className="space-y-4">
      {/* ====== INFO SECTION ====== */}
      <div className="card overflow-hidden">
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

      {/* ====== IMAGES SECTION ====== */}
      <div className="card overflow-hidden">
        <button
          type="button"
          onClick={() => setImagesExpanded(!imagesExpanded)}
          className="w-full flex items-center justify-between p-5 hover:bg-cream-100 transition-colors"
        >
          <div className="text-left">
            <h2 className="font-semibold text-ink flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-accent-700" />
              Fotos, Renders y Planos
            </h2>
            <p className="text-xs text-ink/60 mt-0.5">
              {imagesExpanded
                ? "Ocultar"
                : `${imageItems.length} imagen${imageItems.length !== 1 ? "es" : ""} · Agregar fotos, renders y planos del desarrollo`}
            </p>
          </div>
          {imagesExpanded ? (
            <ChevronUp className="h-5 w-5 text-ink/60" />
          ) : (
            <ChevronDown className="h-5 w-5 text-ink/60" />
          )}
        </button>

        {imagesExpanded && (
          <div className="border-t border-ink/15 p-6 space-y-5">
            {/* Image Uploader */}
            <ImageUploader
              items={imageItems}
              primaryIndex={imagePrimaryIndex}
              onChange={handleImagesChange}
              label="Imágenes del desarrollo"
              helperText="Agregá fotos, renders y planos. Tocá la estrella para elegir portada. Arrastrá para reordenar."
            />

            {/* Image metadata/classification */}
            {imageItems.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-ink/10">
                <h4 className="text-xs uppercase tracking-widest text-ink/60 font-medium">
                  Clasificación de imágenes
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {imageItems.map((item, idx) => {
                    const previewSrc =
                      item.kind === "existing" ? item.url : item.preview;
                    return (
                      <div
                        key={item.id || idx}
                        className="flex items-start gap-3 p-3 border border-ink/10 rounded-lg bg-cream-50"
                      >
                        {/* Thumbnail */}
                        <div className="w-14 h-14 rounded overflow-hidden flex-shrink-0 bg-ink/5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={previewSrc}
                            alt={`Imagen ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        {/* Fields */}
                        <div className="flex-1 space-y-2 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-ink/50 font-medium">
                              #{idx + 1}
                            </span>
                            <select
                              value={imagesMeta[idx]?.type || "otro"}
                              onChange={(e) =>
                                handleMetaChange(idx, "type", e.target.value)
                              }
                              className="text-xs px-2 py-1 border border-ink/15 rounded focus:border-accent focus:outline-none bg-white"
                            >
                              {DEVELOPMENT_IMAGE_TYPES.map((t) => (
                                <option key={t.value} value={t.value}>
                                  {t.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <input
                            type="text"
                            placeholder="Descripción (opcional)"
                            value={imagesMeta[idx]?.caption || ""}
                            onChange={(e) =>
                              handleMetaChange(idx, "caption", e.target.value)
                            }
                            className="w-full text-xs px-2 py-1 border border-ink/15 rounded focus:border-accent focus:outline-none"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Save images button */}
            <div className="flex justify-end pt-3">
              <button
                type="button"
                onClick={handleSave as any}
                disabled={isLoading}
                className="btn-primary disabled:opacity-50 inline-flex items-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {isLoading ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        )}
      </div>
      {/* ====== BROCHURE SECTION ====== */}
      <div className="card overflow-hidden">
        <button
          type="button"
          onClick={() => setBrochureExpanded(!brochureExpanded)}
          className="w-full flex items-center justify-between p-5 hover:bg-cream-100 transition-colors"
        >
          <div className="text-left">
            <h2 className="font-semibold text-ink flex items-center gap-2">
              <FileText className="h-5 w-5 text-accent-700" />
              Brochure PDF
            </h2>
            <p className="text-xs text-ink/60 mt-0.5">
              {brochureExpanded
                ? "Ocultar"
                : brochureUrl
                ? "Brochure cargado · Click para editar"
                : "Subir brochure del desarrollo en PDF"}
            </p>
          </div>
          {brochureExpanded ? (
            <ChevronUp className="h-5 w-5 text-ink/60" />
          ) : (
            <ChevronDown className="h-5 w-5 text-ink/60" />
          )}
        </button>

        {brochureExpanded && (
          <div className="border-t border-ink/15 p-6 space-y-4">
            {/* Current brochure */}
            {brochureUrl && !brochureFile && (
              <div className="flex items-center gap-3 p-4 bg-cream-50 border border-ink/10 rounded-lg">
                <FileText className="h-8 w-8 text-accent-700 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">
                    Brochure actual
                  </p>
                  <a
                    href={brochureUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-accent-700 hover:underline truncate block"
                  >
                    Ver PDF
                  </a>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setBrochureUrl("");
                    setBrochureFile(null);
                  }}
                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-md"
                  title="Eliminar brochure"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* New file selected */}
            {brochureFile && (
              <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                <FileText className="h-8 w-8 text-emerald-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">
                    {brochureFile.name}
                  </p>
                  <p className="text-xs text-ink/60">
                    {(brochureFile.size / (1024 * 1024)).toFixed(2)} MB · Listo para subir
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setBrochureFile(null)}
                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-md"
                  title="Cancelar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Upload button */}
            {!brochureFile && (
              <div>
                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-3 border-2 border-dashed border-ink/20 hover:border-accent rounded-lg transition-colors">
                  <Upload className="h-5 w-5 text-accent-700" />
                  <span className="text-sm text-ink">
                    {brochureUrl ? "Reemplazar brochure" : "Subir brochure PDF"}
                  </span>
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 10 * 1024 * 1024) {
                          setError("El PDF es muy grande (máx 10MB)");
                          return;
                        }
                        setBrochureFile(file);
                      }
                      e.target.value = "";
                    }}
                  />
                </label>
                <p className="text-xs text-ink/50 mt-2">
                  PDF · Máximo 10MB · Se mostrará en una página pública para clientes
                </p>
              </div>
            )}

            {/* Save button */}
            <div className="flex justify-end pt-3">
              <button
                type="button"
                onClick={handleSave as any}
                disabled={isLoading}
                className="btn-primary disabled:opacity-50 inline-flex items-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {isLoading ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
