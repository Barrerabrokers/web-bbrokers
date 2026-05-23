"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Save, ArrowLeft, Upload, X } from "lucide-react";
import Link from "next/link";
import { PROPERTY_CATEGORIES } from "@/types";
import { supabase } from "@/lib/supabase";

export default function EditPropertyPage() {
  const router = useRouter();
  const params = useParams();
  const propertyId = params.id as string;

  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [error, setError] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "usados" as const,
    price: "",
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
          location: data.location || "",
          address: data.address || "",
          bedrooms: data.bedrooms?.toString() || "",
          bathrooms: data.bathrooms?.toString() || "",
          area: data.area?.toString() || "",
          features: (data.features || []).join("\n"),
          status: data.status || "disponible",
        });
        setExistingImages(data.images || []);
      } catch (err) {
        setError("Error cargando la propiedad");
      } finally {
        setIsFetching(false);
      }
    };

    if (propertyId) fetchProperty();
  }, [propertyId]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validFiles = files.filter((file) => {
      if (file.size > 10 * 1024 * 1024) {
        setError(`${file.name} es muy grande (max 10MB)`);
        return false;
      }
      return true;
    });

    setImageFiles((prev) => [...prev, ...validFiles]);

    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeNewImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingImage = (index: number) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async (): Promise<string[]> => {
    if (imageFiles.length === 0) return [];

    setUploadingImages(true);
    const uploadedUrls: string[] = [];

    try {
      for (const file of imageFiles) {
        const ext = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random()
          .toString(36)
          .substring(7)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("properties")
          .upload(fileName, file, { cacheControl: "3600", upsert: false });

        if (uploadError) {
          throw new Error(`Error subiendo ${file.name}: ${uploadError.message}`);
        }

        const { data: urlData } = supabase.storage
          .from("properties")
          .getPublicUrl(fileName);
        uploadedUrls.push(urlData.publicUrl);
      }

      return uploadedUrls;
    } finally {
      setUploadingImages(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // Subir imágenes nuevas si hay
      const newImageUrls = await uploadImages();
      const allImages = [...existingImages, ...newImageUrls];

      if (allImages.length === 0) {
        setError("Debe haber al menos una imagen");
        setIsLoading(false);
        return;
      }

      const response = await fetch(`/api/properties/${propertyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          price: parseFloat(formData.price),
          bedrooms: formData.bedrooms ? parseInt(formData.bedrooms) : undefined,
          bathrooms: formData.bathrooms ? parseInt(formData.bathrooms) : undefined,
          area: parseFloat(formData.area),
          images: allImages,
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
        <div className="animate-spin h-12 w-12 border-t-2 border-gold-500"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <Link
          href="/admin/propiedades"
          className="inline-flex items-center text-charcoal-500 hover:text-charcoal-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a propiedades
        </Link>
        <h1 className="heading-serif text-3xl text-charcoal-900 mb-2">
          Editar Propiedad
        </h1>
        <p className="text-charcoal-500">Modifica la informacion de la propiedad</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-charcoal-100 p-8"
      >
        {/* Imágenes existentes */}
        {existingImages.length > 0 && (
          <div className="mb-6">
            <label className="label-tracking text-charcoal-700 block mb-3">
              Imagenes actuales
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {existingImages.map((url, index) => (
                <div key={index} className="relative group aspect-square">
                  <img
                    src={url}
                    alt={`Imagen ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeExistingImage(index)}
                    className="absolute top-2 right-2 bg-red-500 text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  {index === 0 && (
                    <div className="absolute bottom-2 left-2 bg-gold-500 text-white text-xs px-2 py-1 label-tracking">
                      Principal
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Subir nuevas imágenes */}
        <div className="mb-8 pb-8 border-b border-charcoal-100">
          <label className="label-tracking text-charcoal-700 block mb-4">
            Agregar nuevas imagenes
          </label>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {imagePreviews.map((preview, index) => (
              <div key={index} className="relative group aspect-square">
                <img
                  src={preview}
                  alt={`Nueva ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeNewImage(index)}
                  className="absolute top-2 right-2 bg-red-500 text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}

            <label className="aspect-square border-2 border-dashed border-charcoal-300 hover:border-gold-500 transition-colors cursor-pointer flex flex-col items-center justify-center text-charcoal-500 hover:text-gold-600">
              <Upload className="h-8 w-8 mb-2" />
              <span className="label-tracking text-xs">Subir imagen</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageChange}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="label-tracking text-charcoal-700 block mb-2">
              Titulo *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className="w-full px-4 py-3 border border-charcoal-200 focus:border-gold-500 focus:outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <label className="label-tracking text-charcoal-700 block mb-2">
              Descripcion *
            </label>
            <textarea
              required
              rows={4}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full px-4 py-3 border border-charcoal-200 focus:border-gold-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="label-tracking text-charcoal-700 block mb-2">
              Categoria *
            </label>
            <select
              required
              value={formData.category}
              onChange={(e) =>
                setFormData({ ...formData, category: e.target.value as any })
              }
              className="w-full px-4 py-3 border border-charcoal-200 focus:border-gold-500 focus:outline-none"
            >
              {PROPERTY_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label-tracking text-charcoal-700 block mb-2">
              Estado *
            </label>
            <select
              required
              value={formData.status}
              onChange={(e) =>
                setFormData({ ...formData, status: e.target.value as any })
              }
              className="w-full px-4 py-3 border border-charcoal-200 focus:border-gold-500 focus:outline-none"
            >
              <option value="disponible">Disponible</option>
              <option value="reservada">Reservada</option>
              <option value="vendida">Vendida</option>
            </select>
          </div>

          <div>
            <label className="label-tracking text-charcoal-700 block mb-2">
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
              className="w-full px-4 py-3 border border-charcoal-200 focus:border-gold-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="label-tracking text-charcoal-700 block mb-2">
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
              className="w-full px-4 py-3 border border-charcoal-200 focus:border-gold-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="label-tracking text-charcoal-700 block mb-2">
              Dormitorios
            </label>
            <input
              type="number"
              min="0"
              value={formData.bedrooms}
              onChange={(e) =>
                setFormData({ ...formData, bedrooms: e.target.value })
              }
              className="w-full px-4 py-3 border border-charcoal-200 focus:border-gold-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="label-tracking text-charcoal-700 block mb-2">
              Banos
            </label>
            <input
              type="number"
              min="0"
              value={formData.bathrooms}
              onChange={(e) =>
                setFormData({ ...formData, bathrooms: e.target.value })
              }
              className="w-full px-4 py-3 border border-charcoal-200 focus:border-gold-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="label-tracking text-charcoal-700 block mb-2">
              Ubicacion *
            </label>
            <input
              type="text"
              required
              value={formData.location}
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
              className="w-full px-4 py-3 border border-charcoal-200 focus:border-gold-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="label-tracking text-charcoal-700 block mb-2">
              Direccion *
            </label>
            <input
              type="text"
              required
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
              className="w-full px-4 py-3 border border-charcoal-200 focus:border-gold-500 focus:outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <label className="label-tracking text-charcoal-700 block mb-2">
              Caracteristicas (una por linea)
            </label>
            <textarea
              rows={4}
              value={formData.features}
              onChange={(e) =>
                setFormData({ ...formData, features: e.target.value })
              }
              className="w-full px-4 py-3 border border-charcoal-200 focus:border-gold-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-charcoal-100">
          <Link
            href="/admin/propiedades"
            className="px-6 py-3 border border-charcoal-300 text-charcoal-700 hover:bg-charcoal-50 transition-colors"
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
