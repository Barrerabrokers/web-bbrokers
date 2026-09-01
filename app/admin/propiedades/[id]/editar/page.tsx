"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Save, ArrowLeft, Star } from "lucide-react";
import Link from "next/link";
import { PROPERTY_CATEGORIES } from "@/types";
import { supabase } from "@/lib/supabase";
import {
  ImageUploader,
  type ImageItem,
  withStableImageItemIds,
} from "@/components/admin/image-uploader";
import { VideoUploader } from "@/components/admin/video-uploader";

export default function EditPropertyPage() {
  const router = useRouter();
  const params = useParams();
  const propertyId = params.id as string;

  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [error, setError] = useState("");

  // Estado unificado del uploader (mezcla existentes + nuevas)
  const [items, setItems] = useState<ImageItem[]>([]);
  const [primaryIndex, setPrimaryIndex] = useState(0);
  const [videoUrls, setVideoUrls] = useState<string[]>([]);
  const [primaryVideoUrl, setPrimaryVideoUrl] = useState<string | null>(null);
  const [videoIsPrimary, setVideoIsPrimary] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "usados" as const,
    price: "",
    expenses: "",
    location: "",
    address: "",
    bedrooms: "",
    bathrooms: "",
    area: "",
    features: "",
    status: "disponible" as const,
    visibility: "public" as const,
  });

  // Cargar datos de la propiedad
  useEffect(() => {
    const fetchProperty = async () => {
      try {
        const res = await fetch(`/api/properties/${propertyId}`);
        if (!res.ok) {
          setError("No se pudo cargar la propiedad");
          setIsFetching(false);
          return;
        }
        const data = await res.json();

        setFormData({
          title: data.title || "",
          description: data.description || "",
          category: data.category || "usados",
          price: data.price?.toString() || "",
          expenses: data.expenses?.toString() || "",
          location: data.location || "",
          address: data.address || "",
          bedrooms: data.bedrooms?.toString() || "",
          bathrooms: data.bathrooms?.toString() || "",
          area: data.area?.toString() || "",
          features: (data.features || []).join("\n"),
          status: data.status || "disponible",
          visibility: data.visibility || "public",
        });

        const existingItems: ImageItem[] = (data.images || []).map(
          (url: string, index: number) => ({
            kind: "existing" as const,
            url,
            id: `property-${propertyId}-image-${index}-${url}`,
          })
        );
        setItems(withStableImageItemIds(existingItems));
        const loadedVideoUrls = data.videoUrls || [];
        setVideoUrls(loadedVideoUrls);
        setPrimaryVideoUrl(loadedVideoUrls[0] || null);
        setVideoIsPrimary(Boolean(data.videoIsPrimary && loadedVideoUrls.length));
        setPrimaryIndex(0);
      } catch (err) {
        setError("Error cargando la propiedad");
      } finally {
        setIsFetching(false);
      }
    };

    if (propertyId) fetchProperty();
  }, [propertyId]);

  const buildFinalImageUrls = async (): Promise<string[]> => {
    if (items.length === 0) return [];

    setUploadingImages(true);
    try {
      const urls: string[] = [];

      for (const item of items) {
        if (item.kind === "existing") {
          urls.push(item.url);
          continue;
        }

        const file = item.file;
        const ext = file.name.split(".").pop() || "jpg";
        const fileName = `${Date.now()}-${Math.random()
          .toString(36)
          .substring(7)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("properties")
          .upload(fileName, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type,
          });

        if (uploadError) {
          throw new Error(
            `Error subiendo ${file.name}: ${uploadError.message}`
          );
        }

        const { data: urlData } = supabase.storage
          .from("properties")
          .getPublicUrl(fileName);

        urls.push(urlData.publicUrl);
      }

      // Reordenar para que la imagen marcada como principal vaya primero
      if (primaryIndex > 0 && primaryIndex < urls.length) {
        const primary = urls[primaryIndex];
        const rest = urls.filter((_, i) => i !== primaryIndex);
        return [primary, ...rest];
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
      if (items.length === 0) {
        setError("Debe haber al menos una imagen");
        setIsLoading(false);
        return;
      }

      const imageUrls = await buildFinalImageUrls();
      const orderedVideoUrls =
        videoIsPrimary && primaryVideoUrl
          ? [
              primaryVideoUrl,
              ...videoUrls.filter((url) => url !== primaryVideoUrl),
            ]
          : videoUrls;

      const response = await fetch(`/api/properties/${propertyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          price: parseFloat(formData.price),
          expenses: formData.expenses ? parseFloat(formData.expenses) : null,
          bedrooms: formData.bedrooms ? parseInt(formData.bedrooms) : undefined,
          bathrooms: formData.bathrooms
            ? parseInt(formData.bathrooms)
            : undefined,
          area: parseFloat(formData.area),
          images: imageUrls,
          videoUrls: orderedVideoUrls,
          videoIsPrimary: Boolean(videoIsPrimary && orderedVideoUrls.length),
          features: formData.features
            .split("\n")
            .filter(Boolean)
            .map((f) => f.trim()),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Error al actualizar");
        setIsLoading(false);
        return;
      }

      router.push("/admin/propiedades");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Error al actualizar");
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-12 w-12 border-t-2 border-accent"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <Link
          href="/admin/propiedades"
          className="inline-flex items-center text-ink/60 hover:text-ink mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a propiedades
        </Link>
        <h1 className="heading-serif text-3xl text-ink mb-2">
          Editar Propiedad
        </h1>
        <p className="text-ink/60">
          Modifica la informacion de la propiedad
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="card p-8"
      >
        {/* Imagenes (existentes + nuevas) */}
        <div className="mb-8 pb-8 border-b border-ink/15">
          <ImageUploader
            items={items}
            primaryIndex={primaryIndex}
            onChange={(nextItems, nextPrimary) => {
              setItems(withStableImageItemIds(nextItems));
              setPrimaryIndex(nextPrimary);
            }}
            label="Imagenes de la propiedad"
            displayMode="grid"
            enableQrUpload
          />
          <div className="mt-8 border-t border-ink/10 pt-8">
            <VideoUploader
              videoUrls={videoUrls}
              onUrlsChange={(nextUrls) => {
                setVideoUrls(nextUrls);
                if (!nextUrls.length) {
                  setPrimaryVideoUrl(null);
                  setVideoIsPrimary(false);
                } else if (!primaryVideoUrl || !nextUrls.includes(primaryVideoUrl)) {
                  setPrimaryVideoUrl(nextUrls[0]);
                }
              }}
              label="Videos de la propiedad"
            />
            {videoUrls.length > 0 && (
              <div className="mt-4 rounded-lg border border-ink/15 bg-cream-50 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-ink">
                      Video como referencia principal
                    </p>
                    <p className="mt-1 text-xs text-ink/55">
                      Si lo activás, el video se muestra como portada en las tarjetas y ficha.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setVideoIsPrimary((current) => !current)}
                    className={`rounded-full px-4 py-2 text-xs font-medium transition-colors ${
                      videoIsPrimary
                        ? "bg-ink text-cream-50"
                        : "bg-white text-ink/65 border border-ink/15"
                    }`}
                  >
                    {videoIsPrimary ? "Activado" : "Usar video"}
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {videoUrls.map((url, index) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => {
                        setPrimaryVideoUrl(url);
                        setVideoIsPrimary(true);
                      }}
                      className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                        videoIsPrimary && primaryVideoUrl === url
                          ? "border-accent-700 bg-accent/10 text-ink"
                          : "border-ink/15 bg-white text-ink/65 hover:border-ink/35"
                      }`}
                    >
                      <Star
                        className={`h-4 w-4 shrink-0 ${
                          videoIsPrimary && primaryVideoUrl === url
                            ? "fill-current text-accent-700"
                            : ""
                        }`}
                      />
                      <span>Video {index + 1} como portada</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="label-tracking text-ink/85 block mb-2">
              Titulo *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className="w-full px-4 py-3 border border-ink/15 focus:border-accent focus:outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <label className="label-tracking text-ink/85 block mb-2">
              Descripcion *
            </label>
            <textarea
              required
              rows={4}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full px-4 py-3 border border-ink/15 focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="label-tracking text-ink/85 block mb-2">
              Categoria *
            </label>
            <select
              required
              value={formData.category}
              onChange={(e) =>
                setFormData({ ...formData, category: e.target.value as any })
              }
              className="w-full px-4 py-3 border border-ink/15 focus:border-accent focus:outline-none"
            >
              {PROPERTY_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
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
              <option value="disponible">Disponible</option>
              <option value="reservada">Reservada</option>
              <option value="vendida">Vendida</option>
            </select>
          </div>

          <div>
            <label className="label-tracking text-ink/85 block mb-2">
              Visibilidad *
            </label>
            <select
              required
              value={formData.visibility}
              onChange={(e) =>
                setFormData({ ...formData, visibility: e.target.value as any })
              }
              className="w-full px-4 py-3 border border-ink/15 focus:border-accent focus:outline-none"
            >
              <option value="public">Público: visible en el sitio</option>
              <option value="agents">Solo agentes logueados</option>
            </select>
            <p className="mt-1 text-xs text-ink/50">
              Si elegís solo agentes, no aparece en el sitio público.
            </p>
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
              className="w-full px-4 py-3 border border-ink/15 focus:border-accent focus:outline-none"
            />
          </div>

          <div>
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
              className="w-full px-4 py-3 border border-ink/15 focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="label-tracking text-ink/85 block mb-2">
              Area (m2) *
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
              className="w-full px-4 py-3 border border-ink/15 focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="label-tracking text-ink/85 block mb-2">
              Dormitorios
            </label>
            <input
              type="number"
              min="0"
              value={formData.bedrooms}
              onChange={(e) =>
                setFormData({ ...formData, bedrooms: e.target.value })
              }
              className="w-full px-4 py-3 border border-ink/15 focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="label-tracking text-ink/85 block mb-2">
              Banos
            </label>
            <input
              type="number"
              min="0"
              value={formData.bathrooms}
              onChange={(e) =>
                setFormData({ ...formData, bathrooms: e.target.value })
              }
              className="w-full px-4 py-3 border border-ink/15 focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="label-tracking text-ink/85 block mb-2">
              Ubicacion *
            </label>
            <input
              type="text"
              required
              value={formData.location}
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
              className="w-full px-4 py-3 border border-ink/15 focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="label-tracking text-ink/85 block mb-2">
              Direccion *
            </label>
            <input
              type="text"
              required
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
              className="w-full px-4 py-3 border border-ink/15 focus:border-accent focus:outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <label className="label-tracking text-ink/85 block mb-2">
              Caracteristicas (una por linea)
            </label>
            <textarea
              rows={4}
              value={formData.features}
              onChange={(e) =>
                setFormData({ ...formData, features: e.target.value })
              }
              className="w-full px-4 py-3 border border-ink/15 focus:border-accent focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-ink/15">
          <Link
            href="/admin/propiedades"
            className="px-6 py-3 border border-ink/25 text-ink/85 hover:bg-cream-200 transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={isLoading || uploadingImages}
            className="flex items-center space-x-2 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-5 w-5" />
            <span>
              {uploadingImages
                ? "Subiendo imagenes..."
                : isLoading
                ? "Guardando..."
                : "Guardar Cambios"}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
