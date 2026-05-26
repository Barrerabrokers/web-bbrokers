"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Save, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { COMMON_AMENITIES, DEVELOPMENT_IMAGE_TYPES } from "@/types";
import { supabase } from "@/lib/supabase";
import {
  ImageUploader,
  type ImageItem,
} from "@/components/admin/image-uploader";

type ImageMeta = { type: string; caption: string };

export default function NewDevelopmentPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [error, setError] = useState("");

  const [items, setItems] = useState<ImageItem[]>([]);
  const [primaryIndex, setPrimaryIndex] = useState(0);
  const [imageMeta, setImageMeta] = useState<ImageMeta[]>([]);

  const [formData, setFormData] = useState({
    name: "",
    shortDescription: "",
    description: "",
    location: "",
    address: "",
    status: "pre_venta" as const,
    totalUnits: "",
    completionDate: "",
    progress: "0",
    priceFrom: "",
    amenities: [] as string[],
    features: "",
    highlight: false,
  });

  const toggleAmenity = (a: string) => {
    setFormData((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(a)
        ? prev.amenities.filter((x) => x !== a)
        : [...prev.amenities, a],
    }));
  };


  const handleItemsChange = (
    nextItems: ImageItem[],
    nextPrimary: number
  ) => {
    // Sync image metadata array
    setImageMeta((prev) => {
      const next = [...prev];
      while (next.length < nextItems.length)
        next.push({ type: "espacios_comunes", caption: "" });
      while (next.length > nextItems.length) next.pop();
      return next;
    });
    setItems(nextItems);
    setPrimaryIndex(nextPrimary);
  };

  const updateMeta = (idx: number, key: keyof ImageMeta, value: string) => {
    setImageMeta((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: value };
      return next;
    });
  };

  const buildFinalImages = async () => {
    if (items.length === 0) return [];
    setUploadingImages(true);
    try {
      const urls: { url: string; type: string; caption?: string; isPrimary: boolean }[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const meta = imageMeta[i] || { type: "otro", caption: "" };
        let url: string;

        if (item.kind === "existing") {
          url = item.url;
        } else {
          const ext = item.file.name.split(".").pop() || "jpg";
          const fileName = `dev-${Date.now()}-${Math.random()
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

        // Respetamos el orden visual del usuario y marcamos portada con flag
        urls.push({
          url,
          type: meta.type,
          caption: meta.caption || undefined,
          isPrimary: i === primaryIndex,
        });
      }

      return urls;
    } finally {
      setUploadingImages(false);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (items.length === 0) {
      setError("Debes subir al menos una imagen del desarrollo");
      return;
    }
    setIsLoading(true);

    try {
      const images = await buildFinalImages();

      const response = await fetch("/api/developments", {
        method: "POST",
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
          agentId: session?.user?.id,
          images,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Error al crear el desarrollo");
        setIsLoading(false);
        return;
      }

      router.push(`/admin/desarrollos/${data.id}/editar`);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Error al crear el desarrollo");
      setIsLoading(false);
    }
  };


  return (
    <div>
      <div className="mb-8">
        <Link
          href="/admin/desarrollos"
          className="inline-flex items-center text-ink/60 hover:text-ink mb-4 text-sm"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a desarrollos
        </Link>
        <h1 className="heading-serif text-3xl text-ink mb-2">
          Nuevo Desarrollo
        </h1>
        <p className="text-ink/60 text-sm">
          Después de crearlo vas a poder agregar las unidades.
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card p-8">
        {/* IMAGES SECTION */}
        <div className="mb-8 pb-8 border-b border-ink/15">
          <ImageUploader
            items={items}
            primaryIndex={primaryIndex}
            onChange={handleItemsChange}
            label="Imágenes del desarrollo *"
            helperText="Subí imágenes de la fachada, espacios comunes, amenities, renders, etc. La marcada con estrella será la principal."
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
                    value={imageMeta[idx]?.type || "espacios_comunes"}
                    onChange={(e) => updateMeta(idx, "type", e.target.value)}
                    className="text-sm border border-ink/15 rounded px-2 py-1 bg-white"
                  >
                    {DEVELOPMENT_IMAGE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Descripción opcional..."
                    value={imageMeta[idx]?.caption || ""}
                    onChange={(e) =>
                      updateMeta(idx, "caption", e.target.value)
                    }
                    className="flex-1 text-sm border border-ink/15 rounded px-2 py-1"
                  />
                </div>
              ))}
            </div>
          )}
        </div>


        {/* MAIN FIELDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="label-tracking text-ink/85 block mb-2">
              Nombre del desarrollo *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full px-4 py-3 border border-ink/15 focus:border-accent focus:outline-none"
              placeholder="Ej: Alpha Place Libertador"
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
                setFormData({ ...formData, shortDescription: e.target.value })
              }
              className="w-full px-4 py-3 border border-ink/15 focus:border-accent focus:outline-none"
              placeholder="Una línea para mostrar en listados (max 500 caracteres)"
              maxLength={500}
            />
          </div>

          <div className="md:col-span-2">
            <label className="label-tracking text-ink/85 block mb-2">
              Descripción completa *
            </label>
            <textarea
              required
              rows={5}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full px-4 py-3 border border-ink/15 focus:border-accent focus:outline-none"
              placeholder="Describí el proyecto, ubicación, características destacadas..."
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
              className="w-full px-4 py-3 border border-ink/15 focus:border-accent focus:outline-none"
              placeholder="Palermo, Buenos Aires"
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
              className="w-full px-4 py-3 border border-ink/15 focus:border-accent focus:outline-none"
              placeholder="Av. del Libertador 1234"
            />
          </div>


          <div>
            <label className="label-tracking text-ink/85 block mb-2">
              Estado *
            </label>
            <select
              required
              value={formData.status}
              onChange={(e) =>
                setFormData({ ...formData, status: e.target.value as any })
              }
              className="w-full px-4 py-3 border border-ink/15 focus:border-accent focus:outline-none"
            >
              <option value="pre_venta">Pre-venta</option>
              <option value="en_construccion">En construcción</option>
              <option value="finalizado">Finalizado</option>
              <option value="entregado">Entregado</option>
            </select>
          </div>

          <div>
            <label className="label-tracking text-ink/85 block mb-2">
              Fecha de entrega estimada
            </label>
            <input
              type="text"
              value={formData.completionDate}
              onChange={(e) =>
                setFormData({ ...formData, completionDate: e.target.value })
              }
              className="w-full px-4 py-3 border border-ink/15 focus:border-accent focus:outline-none"
              placeholder="Q4 2026 o Diciembre 2026"
            />
          </div>

          <div>
            <label className="label-tracking text-ink/85 block mb-2">
              Total de unidades
            </label>
            <input
              type="number"
              min="0"
              value={formData.totalUnits}
              onChange={(e) =>
                setFormData({ ...formData, totalUnits: e.target.value })
              }
              className="w-full px-4 py-3 border border-ink/15 focus:border-accent focus:outline-none"
              placeholder="20"
            />
          </div>

          <div>
            <label className="label-tracking text-ink/85 block mb-2">
              Avance de obra (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={formData.progress}
              onChange={(e) =>
                setFormData({ ...formData, progress: e.target.value })
              }
              className="w-full px-4 py-3 border border-ink/15 focus:border-accent focus:outline-none"
              placeholder="0"
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
              className="w-full px-4 py-3 border border-ink/15 focus:border-accent focus:outline-none"
              placeholder="95000"
            />
            <p className="text-xs text-ink/50 mt-1">
              Si dejás vacío, se calculará automáticamente del precio mínimo de las unidades.
            </p>
          </div>


          {/* AMENITIES */}
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

          {/* FEATURES */}
          <div className="md:col-span-2">
            <label className="label-tracking text-ink/85 block mb-2">
              Características adicionales (una por línea)
            </label>
            <textarea
              rows={4}
              value={formData.features}
              onChange={(e) =>
                setFormData({ ...formData, features: e.target.value })
              }
              className="w-full px-4 py-3 border border-ink/15 focus:border-accent focus:outline-none"
              placeholder="Vista panorámica al río&#10;Materiales premium&#10;Domótica integrada"
            />
          </div>

          {/* HIGHLIGHT */}
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
              <span className="text-sm text-ink">
                Marcar como desarrollo destacado (aparece arriba en el sitio público)
              </span>
            </label>
          </div>
        </div>

        {/* SUBMIT */}
        <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-ink/15">
          <Link
            href="/admin/desarrollos"
            className="px-6 py-3 border border-ink/25 text-ink/85 hover:bg-cream-200 transition-colors rounded"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={isLoading || uploadingImages}
            className="flex items-center gap-2 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4" />
            {uploadingImages
              ? "Subiendo imágenes..."
              : isLoading
              ? "Guardando..."
              : "Crear desarrollo"}
          </button>
        </div>
      </form>
    </div>
  );
}
