"use client";

import { useCallback, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Camera,
  Image as ImageIcon,
  Loader2,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import { compressImage, formatBytes } from "@/lib/image-utils";
import { QrUpload } from "./qr-upload";

export type ImageItem =
  | { kind: "existing"; url: string; id?: string }
  | { kind: "new"; file: File; preview: string; id?: string };

interface ImageUploaderProps {
  items: ImageItem[];
  primaryIndex: number;
  onChange: (items: ImageItem[], primaryIndex: number) => void;
  maxSizeMB?: number;
  label?: string;
  helperText?: string;
  displayMode?: "list" | "grid";
  enableQrUpload?: boolean;
  maxItems?: number;
}

const MAX_SIZE_MB_DEFAULT = 15;

export function getImageItemStableId(item: ImageItem): string {
  if (item.id) return item.id;
  if (item.kind === "existing") return `existing-${item.url}`;
  return `new-${item.file.name}-${item.file.lastModified}-${item.file.size}`;
}

export function withStableImageItemIds(items: ImageItem[]): (ImageItem & { id: string })[] {
  const seen = new Map<string, number>();

  return items.map((item) => {
    const baseId = getImageItemStableId(item);
    const count = seen.get(baseId) || 0;
    seen.set(baseId, count + 1);
    const id = count === 0 ? baseId : `${baseId}-${count + 1}`;

    return { ...item, id };
  });
}

function itemPreview(item: ImageItem) {
  return item.kind === "existing" ? item.url : item.preview;
}

function itemLabel(item: ImageItem) {
  if (item.kind === "new") return item.file.name;
  try {
    const url = new URL(item.url);
    return decodeURIComponent(url.pathname.split("/").pop() || "Imagen cargada");
  } catch {
    return "Imagen cargada";
  }
}

function itemMeta(item: ImageItem) {
  if (item.kind === "new") return `Nueva · ${formatBytes(item.file.size)}`;
  return "Guardada";
}

export function ImageUploader({
  items,
  primaryIndex,
  onChange,
  maxSizeMB = MAX_SIZE_MB_DEFAULT,
  label = "Imágenes de la propiedad",
  helperText,
  displayMode = "list",
  enableQrUpload = false,
  maxItems,
}: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const isGrid = displayMode === "grid";

  const emit = useCallback(
    (nextItems: ImageItem[], nextPrimaryIndex = primaryIndex) => {
      const safePrimary =
        nextItems.length === 0
          ? 0
          : Math.min(Math.max(nextPrimaryIndex, 0), nextItems.length - 1);
      onChange(nextItems, safePrimary);
    },
    [onChange, primaryIndex]
  );

  const addFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setError("");
      setIsProcessing(true);

      try {
        const availableSlots =
          typeof maxItems === "number" ? Math.max(0, maxItems - items.length) : files.length;
        if (availableSlots <= 0) {
          setError(`Ya cargaste el máximo de ${maxItems} imagen${maxItems === 1 ? "" : "es"}.`);
          return;
        }
        const accepted: ImageItem[] = [];

        for (const file of files.slice(0, availableSlots)) {
          if (!file.type.startsWith("image/")) {
            setError(`${file.name} no es una imagen`);
            continue;
          }

          if (file.size > maxSizeMB * 1024 * 1024) {
            setError(`${file.name} es muy grande (máx ${maxSizeMB}MB)`);
            continue;
          }

          const compressed = await compressImage(file);
          accepted.push({
            kind: "new",
            file: compressed,
            preview: URL.createObjectURL(compressed),
            id: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          });
        }

        if (accepted.length > 0) {
          emit([...items, ...accepted], items.length === 0 ? 0 : primaryIndex);
        }
      } catch (err: any) {
        setError(err?.message || "No se pudieron procesar las imágenes");
      } finally {
        setIsProcessing(false);
      }
    },
    [emit, items, maxItems, maxSizeMB, primaryIndex]
  );

  const handleSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    addFiles(files);
    event.target.value = "";
  };

  const handleQrFiles = useCallback(
    (urls: string[]) => {
      const videoPattern = /\.(mp4|mov|m4v|webm|avi)(?:\?|$)/i;
      const imageUrls = urls.filter((url) => !videoPattern.test(url));

      if (imageUrls.length === 0) {
        setError("El QR recibió archivos, pero no había imágenes para agregar en esta sección.");
        return;
      }

      setError("");
      const now = Date.now();
      const availableSlots =
        typeof maxItems === "number" ? Math.max(0, maxItems - items.length) : imageUrls.length;
      if (availableSlots <= 0) {
        setError(`Ya cargaste el máximo de ${maxItems} imagen${maxItems === 1 ? "" : "es"}.`);
        return;
      }

      const nextItems: ImageItem[] = imageUrls.slice(0, availableSlots).map((url, index) => ({
        kind: "existing",
        url,
        id: `qr-image-${now}-${index}`,
      }));

      emit([...items, ...nextItems], items.length === 0 ? 0 : primaryIndex);
    },
    [emit, items, maxItems, primaryIndex]
  );

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    addFiles(Array.from(event.dataTransfer.files || []));
  };

  const removeAt = (index: number) => {
    const item = items[index];
    if (item?.kind === "new") URL.revokeObjectURL(item.preview);

    const nextItems = items.filter((_, itemIndex) => itemIndex !== index);
    let nextPrimaryIndex = primaryIndex;

    if (index === primaryIndex) nextPrimaryIndex = 0;
    else if (index < primaryIndex) nextPrimaryIndex = primaryIndex - 1;

    emit(nextItems, nextPrimaryIndex);
  };

  const setPrimary = (index: number) => {
    emit(items, index);
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const reordered = [...items];
    const [item] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, item);

    let nextPrimaryIndex = primaryIndex;
    if (index === primaryIndex) nextPrimaryIndex = targetIndex;
    else if (targetIndex === primaryIndex) nextPrimaryIndex = index;

    emit(reordered, nextPrimaryIndex);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="label-tracking block text-ink/85">{label}</label>
        <p className="mt-1 text-xs leading-relaxed text-ink/55">
          {helperText ||
            "Subí imágenes, marcá la portada y ordenalas con los botones. Sin arrastrar."}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {items.length > 0 ? (
        <div className="rounded-xl border border-ink/12 bg-white/55">
          <div className="flex items-center justify-between border-b border-ink/10 px-4 py-3">
            <span className="text-xs font-medium text-ink">
              {items.length} imagen{items.length !== 1 ? "es" : ""} cargada
              {items.length !== 1 ? "s" : ""}
            </span>
            <span className="text-[10px] uppercase tracking-[0.16em] text-ink/45">
              Portada: {items[primaryIndex] ? primaryIndex + 1 : "sin definir"}
            </span>
          </div>

          <div
            className={
              isGrid
                ? "grid grid-cols-1 gap-3 p-3 md:grid-cols-2 xl:grid-cols-3"
                : "divide-y divide-ink/8"
            }
          >
            {items.map((item, index) => {
              const isPrimary = index === primaryIndex;
              const key = `${item.id || getImageItemStableId(item)}-${index}`;

              return (
                <div
                  key={key}
                  className={
                    isGrid
                      ? `overflow-hidden rounded-xl border p-3 transition-colors ${
                          isPrimary
                            ? "border-accent bg-accent/10"
                            : "border-ink/10 bg-white"
                        }`
                      : `flex gap-3 p-3 sm:items-center ${
                          isPrimary ? "bg-accent/10" : "bg-transparent"
                        }`
                  }
                >
                  <div
                    className={
                      isGrid
                        ? "relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-ink/12 bg-cream-200"
                        : "relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-ink/12 bg-cream-200 sm:h-24 sm:w-24"
                    }
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={itemPreview(item)}
                      alt={`Imagen ${index + 1}`}
                      className="h-full w-full object-cover"
                      draggable={false}
                    />
                    <span className="absolute left-1.5 top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-ink px-1.5 text-[10px] font-semibold text-bone">
                      {index + 1}
                    </span>
                  </div>

                  <div className={isGrid ? "mt-3 min-w-0" : "min-w-0 flex-1"}>
                    <div
                      className={
                        isGrid
                          ? "flex flex-col gap-2"
                          : "flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
                      }
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">
                          {itemLabel(item)}
                        </p>
                        <p className="text-xs text-ink/55">{itemMeta(item)}</p>
                      </div>

                      {isPrimary ? (
                        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink">
                          <Star className="h-3 w-3 fill-current" />
                          Portada
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPrimary(index)}
                          className="inline-flex w-fit items-center gap-1 rounded-full border border-ink/15 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink transition-colors hover:border-accent hover:bg-accent/15"
                        >
                          <Star className="h-3 w-3" />
                          Hacer portada
                        </button>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => moveItem(index, -1)}
                        disabled={index === 0}
                        className="inline-flex h-9 items-center gap-1 rounded-lg border border-ink/12 bg-white px-3 text-xs font-medium text-ink transition-colors hover:border-ink/28 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                        <span className={isGrid ? "sr-only sm:not-sr-only" : ""}>
                          Subir
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => moveItem(index, 1)}
                        disabled={index === items.length - 1}
                        className="inline-flex h-9 items-center gap-1 rounded-lg border border-ink/12 bg-white px-3 text-xs font-medium text-ink transition-colors hover:border-ink/28 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                        <span className={isGrid ? "sr-only sm:not-sr-only" : ""}>
                          Bajar
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeAt(index)}
                        className="inline-flex h-9 items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-medium text-red-700 transition-colors hover:bg-red-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className={isGrid ? "sr-only sm:not-sr-only" : ""}>
                          Eliminar
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-ink/18 bg-white/45 px-4 py-8 text-center">
          <ImageIcon className="mx-auto h-8 w-8 text-ink/35" />
          <p className="mt-3 text-sm font-medium text-ink">Todavía no hay imágenes.</p>
          <p className="mt-1 text-xs text-ink/55">
            Agregá fotos desde la cámara, la galería o arrastrando archivos.
          </p>
        </div>
      )}

      <div className={enableQrUpload ? "grid gap-3 md:grid-cols-3" : "grid grid-cols-2 gap-3"}>
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={isProcessing}
          className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-ink/18 bg-white/50 p-4 text-ink transition-colors hover:border-accent hover:bg-accent/8 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Camera className="h-5 w-5 text-accent-700" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em]">
            Tomar foto
          </span>
          <span className="text-xs text-ink/50">Cámara del celular</span>
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
          className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-ink/18 bg-white/50 p-4 text-ink transition-colors hover:border-accent hover:bg-accent/8 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Upload className="h-5 w-5 text-accent-700" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em]">
            Elegir imágenes
          </span>
          <span className="text-xs text-ink/50">Permite múltiples</span>
        </button>

        {enableQrUpload && (
          <div className="md:col-span-1">
            <QrUpload
              onFilesReceived={handleQrFiles}
              buttonLabel="QR desde celular"
              title="Fotos desde celular"
              description="Escanealo con el celular. Podés sacar fotos con la cámara o elegirlas desde la galería; aparecen acá automáticamente."
              className="min-h-24 w-full flex-col justify-center rounded-xl border-ink/18 bg-white/50 p-4 text-ink hover:border-accent hover:bg-accent/8"
              mediaMode="images"
            />
          </div>
        )}
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`hidden rounded-xl border border-dashed px-4 py-5 text-center transition-colors md:block ${
          isDragging ? "border-accent bg-accent/10" : "border-ink/18 bg-white/35"
        }`}
      >
        {isProcessing ? (
          <div className="flex items-center justify-center gap-2 text-sm text-ink/60">
            <Loader2 className="h-4 w-4 animate-spin" />
            Procesando imágenes...
          </div>
        ) : (
          <p className="text-sm text-ink/55">
            Arrastrá imágenes acá si estás en computadora. JPG, PNG o WebP · máx{" "}
            {maxSizeMB}MB.
          </p>
        )}
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleSelect}
        className="hidden"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleSelect}
        className="hidden"
      />
    </div>
  );
}
