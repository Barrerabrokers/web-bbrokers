"use client";

import { useState, useCallback } from "react";
import { ImageUploader, ImageItem } from "./image-uploader";
import { Loader2, ImageIcon } from "lucide-react";
import { DevelopmentImage, DEVELOPMENT_IMAGE_TYPES, DevelopmentImageType } from "@/types";

interface DevelopmentImageManagerProps {
  initialImages: DevelopmentImage[];
  developmentId: string;
  onImagesChange: (images: DevelopmentImage[]) => void;
}

export function DevelopmentImageManager({
  initialImages,
  developmentId,
  onImagesChange,
}: DevelopmentImageManagerProps) {
  // Convert DevelopmentImage[] to ImageItem[] for the uploader
  const [items, setItems] = useState<ImageItem[]>(() =>
    initialImages.map((img) => ({
      kind: "existing" as const,
      url: img.url,
      id: img.id || `existing-${img.url}`,
    }))
  );

  const [primaryIndex, setPrimaryIndex] = useState<number>(() => {
    const idx = initialImages.findIndex((img) => img.isPrimary);
    return idx >= 0 ? idx : 0;
  });

  // Track image metadata (type, caption) per item
  const [imagesMeta, setImagesMeta] = useState<
    { type: DevelopmentImageType; caption: string }[]
  >(() =>
    initialImages.map((img) => ({
      type: img.type || "otro",
      caption: img.caption || "",
    }))
  );

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // Sync changes back to parent
  const syncToParent = useCallback(
    (
      currentItems: ImageItem[],
      currentMeta: { type: DevelopmentImageType; caption: string }[],
      currentPrimary: number
    ) => {
      const images: DevelopmentImage[] = currentItems.map((item, idx) => ({
        url: item.kind === "existing" ? item.url : "",
        type: currentMeta[idx]?.type || "otro",
        caption: currentMeta[idx]?.caption || "",
        displayOrder: idx,
        isPrimary: idx === currentPrimary,
      }));
      onImagesChange(images);
    },
    [onImagesChange]
  );

  const handleItemsChange = useCallback(
    (newItems: ImageItem[], newPrimary: number) => {
      // Update meta array to match new items length
      setImagesMeta((prev) => {
        const newMeta = newItems.map((item, idx) => {
          if (idx < items.length) {
            // Find original index if reordered
            const originalIdx = items.findIndex((old) => old.id === item.id);
            if (originalIdx >= 0 && originalIdx < prev.length) {
              return prev[originalIdx];
            }
          }
          // New item default
          return prev[idx] || { type: "otro" as DevelopmentImageType, caption: "" };
        });
        // Sync after state update
        setTimeout(() => syncToParent(newItems, newMeta, newPrimary), 0);
        return newMeta;
      });

      setItems(newItems);
      setPrimaryIndex(newPrimary);
    },
    [items, syncToParent]
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
      syncToParent(items, updated, primaryIndex);
      return updated;
    });
  };

  // Upload new files to server and convert to URLs
  const uploadNewImages = async (): Promise<DevelopmentImage[]> => {
    setUploadError("");
    setIsUploading(true);

    try {
      const result: DevelopmentImage[] = [];

      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        const meta = imagesMeta[idx] || { type: "otro", caption: "" };

        if (item.kind === "existing") {
          result.push({
            url: item.url,
            type: meta.type,
            caption: meta.caption,
            displayOrder: idx,
            isPrimary: idx === primaryIndex,
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
            const err = await response.json();
            throw new Error(err.error || "Error subiendo imagen");
          }

          const data = await response.json();
          const url = data.urls[0];

          result.push({
            url,
            type: meta.type,
            caption: meta.caption,
            displayOrder: idx,
            isPrimary: idx === primaryIndex,
          });
        }
      }

      return result;
    } catch (error: any) {
      setUploadError(error.message || "Error subiendo imágenes");
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {uploadError && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-2 text-sm">
          {uploadError}
        </div>
      )}

      {isUploading && (
        <div className="flex items-center gap-2 text-accent-700 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Subiendo imágenes...
        </div>
      )}

      <ImageUploader
        items={items}
        primaryIndex={primaryIndex}
        onChange={handleItemsChange}
        label="Imágenes del desarrollo"
        helperText="Agregá fotos, renders y planos del desarrollo. Tocá la estrella para elegir portada."
      />

      {/* Metadata editor for each image */}
      {items.length > 0 && (
        <div className="space-y-3 mt-4">
          <h4 className="text-xs uppercase tracking-widest text-ink/60 font-medium">
            Clasificación de imágenes
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {items.map((item, idx) => {
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
    </div>
  );
}

// Export the upload function so the parent can trigger it
export type { DevelopmentImageManagerProps };
export { DevelopmentImageManager as default };
