"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, X, Star, StarOff, Loader2 } from "lucide-react";
import { compressImage, formatBytes } from "@/lib/image-utils";

export type ImageItem =
  | { kind: "existing"; url: string }
  | { kind: "new"; file: File; preview: string };

interface ImageUploaderProps {
  items: ImageItem[];
  primaryIndex: number;
  onChange: (items: ImageItem[], primaryIndex: number) => void;
  maxSizeMB?: number;
  label?: string;
  helperText?: string;
}

const MAX_SIZE_MB_DEFAULT = 15;

export function ImageUploader({
  items,
  primaryIndex,
  onChange,
  maxSizeMB = MAX_SIZE_MB_DEFAULT,
  label = "Imagenes de la propiedad",
  helperText,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");

  const addFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setError("");
      setIsProcessing(true);

      try {
        const accepted: ImageItem[] = [];
        for (const file of files) {
          if (!file.type.startsWith("image/")) {
            setError(`${file.name} no es una imagen`);
            continue;
          }
          if (file.size > maxSizeMB * 1024 * 1024) {
            setError(`${file.name} es muy grande (max ${maxSizeMB}MB)`);
            continue;
          }
          const compressed = await compressImage(file);
          const preview = URL.createObjectURL(compressed);
          accepted.push({ kind: "new", file: compressed, preview });
        }

        if (accepted.length > 0) {
          const next = [...items, ...accepted];
          // Si no habia imagenes, la primera nueva es la principal
          const nextPrimary = items.length === 0 ? 0 : primaryIndex;
          onChange(next, nextPrimary);
        }
      } finally {
        setIsProcessing(false);
      }
    },
    [items, primaryIndex, onChange, maxSizeMB]
  );

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    addFiles(files);
    // Reset para poder volver a seleccionar el mismo archivo
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files || []);
    addFiles(files);
  };

  const removeAt = (index: number) => {
    const item = items[index];
    if (item?.kind === "new") {
      URL.revokeObjectURL(item.preview);
    }
    const next = items.filter((_, i) => i !== index);

    let nextPrimary = primaryIndex;
    if (index === primaryIndex) {
      nextPrimary = 0;
    } else if (index < primaryIndex) {
      nextPrimary = primaryIndex - 1;
    }
    if (next.length === 0) nextPrimary = 0;

    onChange(next, nextPrimary);
  };

  const setPrimary = (index: number) => {
    onChange(items, index);
  };

  const previewSrc = (item: ImageItem) =>
    item.kind === "existing" ? item.url : item.preview;

  return (
    <div>
      <label className="label-tracking text-gray-200 block mb-3">
        {label}
      </label>

      {error && (
        <div className="mb-3 bg-red-50 border-l-4 border-red-500 text-red-700 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {/* Grid de imagenes */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {items.map((item, index) => {
            const isPrimary = index === primaryIndex;
            return (
              <div
                key={index}
                className={`relative group aspect-square border-2 ${
                  isPrimary ? "border-accent" : "border-transparent"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewSrc(item)}
                  alt={`Imagen ${index + 1}`}
                  className="w-full h-full object-cover"
                />

                {/* Overlay acciones */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />

                {/* Botones */}
                <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => removeAt(index)}
                    className="bg-red-500 hover:bg-red-600 text-white p-1.5"
                    aria-label="Eliminar imagen"
                    title="Eliminar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  {!isPrimary && (
                    <button
                      type="button"
                      onClick={() => setPrimary(index)}
                      className="bg-gray-950/80 hover:bg-accent/50 text-white p-1.5"
                      aria-label="Marcar como principal"
                      title="Hacer principal"
                    >
                      <Star className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Badge principal */}
                {isPrimary && (
                  <div className="absolute bottom-2 left-2 bg-accent/50 text-white text-xs px-2 py-1 label-tracking flex items-center gap-1">
                    <Star className="h-3 w-3 fill-current" />
                    <span>Principal</span>
                  </div>
                )}

                {/* Badge nuevo */}
                {item.kind === "new" && (
                  <div className="absolute top-2 left-2 bg-blue-500 text-white text-xs px-2 py-0.5 label-tracking">
                    Nueva
                  </div>
                )}

                {/* Tamano archivo nuevo */}
                {item.kind === "new" && (
                  <div className="absolute bottom-2 right-2 bg-gray-950/70 text-white text-[10px] px-1.5 py-0.5">
                    {formatBytes(item.file.size)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed transition-colors cursor-pointer p-8 text-center ${
          isDragging
            ? "border-accent bg-accent/5"
            : "border-gray-700 hover:border-accent"
        }`}
      >
        {isProcessing ? (
          <div className="flex flex-col items-center justify-center text-gray-400">
            <Loader2 className="h-8 w-8 mb-2 animate-spin" />
            <span className="label-tracking text-sm">
              Procesando imagenes...
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-gray-400">
            <Upload className="h-8 w-8 mb-2" />
            <span className="label-tracking text-sm mb-1">
              {isDragging
                ? "Solta las imagenes aqui"
                : "Arrastra imagenes o hace clic para seleccionar"}
            </span>
            <span className="text-xs text-gray-500">
              JPG, PNG, WebP. Se comprimen automaticamente. Max {maxSizeMB}MB
            </span>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleSelect}
          className="hidden"
        />
      </div>

      <p className="text-xs text-gray-400 mt-2">
        {helperText ||
          "Hace clic en la estrella de una imagen para marcarla como principal."}
      </p>
    </div>
  );
}
