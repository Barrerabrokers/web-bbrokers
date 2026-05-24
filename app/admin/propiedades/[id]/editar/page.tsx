"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Save, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PROPERTY_CATEGORIES } from "@/types";
import { supabase } from "@/lib/supabase";
import {
  ImageUploader,
  type ImageItem,
} from "@/components/admin/image-uploader";

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
        });

        const existingItems: ImageItem[] = (data.images || []).map(
          (url: string) => ({ kind: "existing" as const, url })
        );
        setItems(existingItems);
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
          className="inline-flex items-center text-gray-400 hover:text-gray-50 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a propiedades
        </Link>
        <h1 className="heading-serif text-3xl text-gray-50 mb-2">
          Editar Propiedad
        </h1>
        <p className="text-gray-400">
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
        <div className="mb-8 pb-8 border-b border-gray-800">
          <ImageUploader
            items={items}
            primaryIndex={primaryIndex}
            onChange={(nextItems, nextPrimary) => {
              setItems(nextItems);
              setPrimaryIndex(nextPrimary);
            }}
            label="Imagenes de la propiedad"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="label-tracking text-gray-200 block mb-2">
              Titulo *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className="w-full px-4 py-3 border border-gray-800 focus:border-accent focus:outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <label className="label-tracking text-gray-200 block mb-2">
              Descripcion *
            </label>
            <textarea
              required
              rows={4}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full px-4 py-3 border border-gray-800 focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="label-tracking text-gray-200 block mb-2">
              Categoria *
            </label>
            <select
              required
              value={formData.category}
              onChange={(e) =>
                setFormData({ ...formData, category: e.target.value as any })
              }
              className="w-full px-4 py-3 border border-gray-800 focus:border-accent focus:outline-none"
            >
              {PROPERTY_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label-tracking text-gray-200 block mb-2">
              Estado *
            </label>
            <select
              required
              value={formData.status}
              onChange={(e) =>
                setFormData({ ...formData, status: e.target.value as any })
              }
              className="w-full px-4 py-3 border border-gray-800 focus:border-accent focus:outline-none"
            >
              <option value="disponible">Disponible</option>
              <option value="reservada">Reservada</option>
              <option value="vendida">Vendida</option>
            </select>
          </div>

          <div>
            <label className="label-tracking text-gray-200 block mb-2">
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
              className="w-full px-4 py-3 border border-gray-800 focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="label-tracking text-gray-200 block mb-2">
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
              className="w-full px-4 py-3 border border-gray-800 focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="label-tracking text-gray-200 block mb-2">
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
              className="w-full px-4 py-3 border border-gray-800 focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="label-tracking text-gray-200 block mb-2">
              Dormitorios
            </label>
            <input
              type="number"
              min="0"
              value={formData.bedrooms}
              onChange={(e) =>
                setFormData({ ...formData, bedrooms: e.target.value })
              }
              className="w-full px-4 py-3 border border-gray-800 focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="label-tracking text-gray-200 block mb-2">
              Banos
            </label>
            <input
              type="number"
              min="0"
              value={formData.bathrooms}
              onChange={(e) =>
                setFormData({ ...formData, bathrooms: e.target.value })
              }
              className="w-full px-4 py-3 border border-gray-800 focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="label-tracking text-gray-200 block mb-2">
              Ubicacion *
            </label>
            <input
              type="text"
              required
              value={formData.location}
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
              className="w-full px-4 py-3 border border-gray-800 focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="label-tracking text-gray-200 block mb-2">
              Direccion *
            </label>
            <input
              type="text"
              required
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
              className="w-full px-4 py-3 border border-gray-800 focus:border-accent focus:outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <label className="label-tracking text-gray-200 block mb-2">
              Caracteristicas (una por linea)
            </label>
            <textarea
              rows={4}
              value={formData.features}
              onChange={(e) =>
                setFormData({ ...formData, features: e.target.value })
              }
              className="w-full px-4 py-3 border border-gray-800 focus:border-accent focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-gray-800">
          <Link
            href="/admin/propiedades"
            className="px-6 py-3 border border-gray-700 text-gray-200 hover:bg-gray-900 transition-colors"
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
