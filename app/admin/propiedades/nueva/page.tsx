"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Save, ArrowLeft, CloudDownload, Link as LinkIcon, Loader2, Star } from "lucide-react";
import Link from "next/link";
import { PROPERTY_CATEGORIES } from "@/types";
import { supabase } from "@/lib/supabase";
import {
  ImageUploader,
  type ImageItem,
  withStableImageItemIds,
} from "@/components/admin/image-uploader";
import { VideoUploader } from "@/components/admin/video-uploader";

export default function NewPropertyPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [isImportingZonaprop, setIsImportingZonaprop] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [error, setError] = useState("");
  const [zonapropUrl, setZonapropUrl] = useState("");
  const [zonapropNotice, setZonapropNotice] = useState("");

  // Estado unificado del uploader
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

  const importFromZonaprop = async () => {
    const url = zonapropUrl.trim();
    if (!url) {
      setError("Pegá el link de Zonaprop para importar la propiedad.");
      return;
    }

    setIsImportingZonaprop(true);
    setError("");
    setZonapropNotice("");

    try {
      const response = await fetch("/api/properties/import-zonaprop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const responseText = await response.text();
      const data = (responseText ? JSON.parse(responseText) : null) as
        | {
            property?: {
              title?: string;
              description?: string;
              price?: number;
              expenses?: number;
              location?: string;
              address?: string;
              bedrooms?: number;
              bathrooms?: number;
              area?: number;
              features?: string[];
              images?: string[];
              sourceUrl?: string;
            };
            error?: string;
          }
        | null;

      if (!response.ok || !data?.property) {
        throw new Error(
          data?.error ||
            responseText ||
            "No se pudo importar la propiedad desde Zonaprop."
        );
      }

      const imported = data.property;
      setFormData((current) => ({
        ...current,
        title: imported.title || current.title,
        description: imported.description || current.description,
        price: imported.price !== undefined ? String(imported.price) : current.price,
        expenses: imported.expenses !== undefined ? String(imported.expenses) : current.expenses,
        location: imported.location || current.location,
        address: imported.address || current.address,
        bedrooms: imported.bedrooms !== undefined ? String(imported.bedrooms) : current.bedrooms,
        bathrooms: imported.bathrooms !== undefined ? String(imported.bathrooms) : current.bathrooms,
        area: imported.area !== undefined ? String(imported.area) : current.area,
        features: imported.features?.length ? imported.features.join("\n") : current.features,
      }));

      if (imported.images?.length) {
        const nextItems: ImageItem[] = imported.images.map((url) => ({
          kind: "existing",
          url,
          id: `zonaprop-${url}`,
        }));
        setItems(withStableImageItemIds(nextItems));
        setPrimaryIndex(0);
      }

      setZonapropNotice(
        `Importación lista: se cargaron datos de la publicación${
          imported.images?.length ? ` y ${imported.images.length} foto${imported.images.length !== 1 ? "s" : ""}` : ""
        }. Revisá la información antes de guardar.`
      );
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError("El servidor no respondió con datos válidos para importar desde Zonaprop.");
        return;
      }
      setError(err instanceof Error ? err.message : "No se pudo importar la propiedad desde Zonaprop.");
    } finally {
      setIsImportingZonaprop(false);
    }
  };

  // Sube los archivos nuevos a Supabase y devuelve sus URLs
  // en el mismo orden de los items (los existentes ya tienen URL).
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

    if (items.length === 0) {
      setError("Debes subir al menos una imagen");
      return;
    }

    setIsLoading(true);

    try {
      const imageUrls = await buildFinalImageUrls();
      const orderedVideoUrls =
        videoIsPrimary && primaryVideoUrl
          ? [
              primaryVideoUrl,
              ...videoUrls.filter((url) => url !== primaryVideoUrl),
            ]
          : videoUrls;

      if (imageUrls.length === 0) {
        setError("Error al subir las imagenes");
        setIsLoading(false);
        return;
      }

      const response = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          price: parseFloat(formData.price),
          expenses: formData.expenses
            ? parseFloat(formData.expenses)
            : undefined,
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
          agentId: session?.user?.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Error al crear la propiedad");
        setIsLoading(false);
        return;
      }

      router.push("/admin/propiedades");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Error al crear la propiedad");
      setIsLoading(false);
    }
  };

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
          Nueva Propiedad
        </h1>
        <p className="text-ink/60">
          Completa la informacion de la propiedad
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3">
          {error}
        </div>
      )}

      <section className="mb-6 rounded-xl border border-ink/12 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="label-tracking text-ink/45">Importar desde Zonaprop</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink">
              Pegá el link y completamos la ficha
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-ink/58">
              El sistema intenta traer título, descripción, valor, dirección, características y fotografías. Después podés editar todo antes de guardar.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 lg:w-[520px]">
            <label className="relative block">
              <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
              <input
                type="url"
                value={zonapropUrl}
                onChange={(event) => {
                  setZonapropUrl(event.target.value);
                  setZonapropNotice("");
                }}
                className="h-12 w-full rounded-lg border border-ink/15 bg-white pl-10 pr-4 text-sm text-ink outline-none transition-colors placeholder:text-ink/40 focus:border-accent"
                placeholder="https://www.zonaprop.com.ar/propiedades/..."
              />
            </label>
            <button
              type="button"
              onClick={importFromZonaprop}
              disabled={isImportingZonaprop}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-ink px-5 text-sm font-medium text-cream-50 transition-colors hover:bg-ink/88 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isImportingZonaprop ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudDownload className="h-4 w-4" />}
              {isImportingZonaprop ? "Importando..." : "Importar publicación"}
            </button>
          </div>
        </div>
        {zonapropNotice && (
          <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            {zonapropNotice}
          </p>
        )}
      </section>

      <form
        onSubmit={handleSubmit}
        className="card p-8"
      >
        {/* Image Upload Section */}
        <div className="mb-8 pb-8 border-b border-ink/15">
          <ImageUploader
            items={items}
            primaryIndex={primaryIndex}
            onChange={(nextItems, nextPrimary) => {
              setItems(withStableImageItemIds(nextItems));
              setPrimaryIndex(nextPrimary);
            }}
            label="Imagenes de la propiedad *"
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
              className="w-full px-4 py-3 border border-ink/15 focus:border-accent focus:outline-none transition-colors"
              placeholder="Ej: Departamento moderno en Palermo"
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
              className="w-full px-4 py-3 border border-ink/15 focus:border-accent focus:outline-none transition-colors"
              placeholder="Describe la propiedad..."
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
              placeholder="180000"
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
              placeholder="150000"
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
              placeholder="45"
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
              placeholder="2"
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
              placeholder="1"
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
              placeholder="Palermo, CABA"
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
              placeholder="Av. Santa Fe 3500"
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
              placeholder="Balcon&#10;Cocina equipada&#10;Seguridad 24hs&#10;Gimnasio"
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
                : "Guardar Propiedad"}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
