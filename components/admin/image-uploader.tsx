"use client";

import { useCallback, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Upload,
  X,
  Star,
  Loader2,
  Camera,
  Image as ImageIcon,
  GripVertical,
} from "lucide-react";
import { compressImage, formatBytes } from "@/lib/image-utils";

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
}

const MAX_SIZE_MB_DEFAULT = 15;

// Helper to ensure each item has a stable id for dnd-kit
function ensureIds(items: ImageItem[]): (ImageItem & { id: string })[] {
  return items.map((item, idx) => ({
    ...item,
    id: item.id || `${item.kind}-${idx}-${Date.now()}-${Math.random()}`,
  }));
}



export function ImageUploader({
  items,
  primaryIndex,
  onChange,
  maxSizeMB = MAX_SIZE_MB_DEFAULT,
  label = "Imágenes de la propiedad",
  helperText,
}: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");

  // Items con IDs estables para dnd-kit
  const itemsWithIds = ensureIds(items);

  // Sensors: pointer (mouse), touch, keyboard
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
            setError(`${file.name} es muy grande (máx ${maxSizeMB}MB)`);
            continue;
          }
          const compressed = await compressImage(file);
          const preview = URL.createObjectURL(compressed);
          accepted.push({
            kind: "new",
            file: compressed,
            preview,
            id: `new-${Date.now()}-${Math.random()}`,
          });
        }

        if (accepted.length > 0) {
          const next = [...items, ...accepted];
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
    if (e.target) e.target.value = "";
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
    if (index === primaryIndex) nextPrimary = 0;
    else if (index < primaryIndex) nextPrimary = primaryIndex - 1;
    if (next.length === 0) nextPrimary = 0;

    onChange(next, nextPrimary);
  };

  const setPrimary = (index: number) => onChange(items, index);

  // Reorder via drag-and-drop
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = itemsWithIds.findIndex((i) => i.id === active.id);
    const newIndex = itemsWithIds.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(items, oldIndex, newIndex);

    // Recalcular primary index siguiendo al item original
    let nextPrimary = primaryIndex;
    if (oldIndex === primaryIndex) {
      nextPrimary = newIndex;
    } else if (oldIndex < primaryIndex && newIndex >= primaryIndex) {
      nextPrimary = primaryIndex - 1;
    } else if (oldIndex > primaryIndex && newIndex <= primaryIndex) {
      nextPrimary = primaryIndex + 1;
    }

    onChange(reordered, nextPrimary);
  };



  return (
    <div>
      <label className="label-tracking text-ink/85 block mb-3">{label}</label>

      {error && (
        <div className="mb-3 bg-red-50 border-l-4 border-red-500 text-red-700 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {/* Grid de imágenes con drag & drop sortable */}
      {items.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={itemsWithIds.map((i) => i.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4">
              {itemsWithIds.map((item, index) => (
                <SortableImageCard
                  key={item.id}
                  id={item.id}
                  item={item}
                  index={index}
                  isPrimary={index === primaryIndex}
                  onRemove={() => removeAt(index)}
                  onSetPrimary={() => setPrimary(index)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {items.length > 1 && (
        <p className="text-[11px] text-accent-700 mb-3 flex items-center gap-1.5">
          <GripVertical className="h-3 w-3" />
          Arrastrá las imágenes para reordenar. La primera (#1) es la portada.
        </p>
      )}

      {/* Botones explícitos para mobile + drop zone para desktop */}
      <div className="space-y-3">
        {/* Botones rápidos: cámara y galería */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={isProcessing}
            className="flex flex-col items-center justify-center gap-1.5 p-4 border border-ink/20 rounded-lg hover:border-accent hover:bg-accent/5 transition-colors disabled:opacity-50"
          >
            <Camera className="h-5 w-5 text-accent-700" />
            <span className="label-tracking text-xs text-ink">
              Tomar foto
            </span>
            <span className="text-[10px] text-ink/50">Cámara</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="flex flex-col items-center justify-center gap-1.5 p-4 border border-ink/20 rounded-lg hover:border-accent hover:bg-accent/5 transition-colors disabled:opacity-50"
          >
            <ImageIcon className="h-5 w-5 text-accent-700" />
            <span className="label-tracking text-xs text-ink">
              Elegir de galería
            </span>
            <span className="text-[10px] text-ink/50">Múltiples permitidas</span>
          </button>
        </div>

        {/* Drop zone (desktop) */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`hidden md:block border-2 border-dashed transition-colors cursor-pointer p-6 text-center rounded-lg ${
            isDragging
              ? "border-accent bg-accent/5"
              : "border-ink/20 hover:border-accent"
          }`}
        >
          {isProcessing ? (
            <div className="flex flex-col items-center justify-center text-ink/60">
              <Loader2 className="h-7 w-7 mb-2 animate-spin" />
              <span className="label-tracking text-sm">
                Procesando imágenes...
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-ink/60">
              <Upload className="h-7 w-7 mb-2" />
              <span className="label-tracking text-sm mb-1">
                {isDragging
                  ? "Soltá las imágenes acá"
                  : "O arrastrá imágenes acá"}
              </span>
              <span className="text-xs text-ink/50">
                JPG, PNG, WebP · se comprimen automáticamente · máx {maxSizeMB}MB
              </span>
            </div>
          )}
        </div>

        {/* Inputs ocultos */}
        {/* Cámara (móvil): capture="environment" abre la cámara trasera */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleSelect}
          className="hidden"
        />
        {/* Galería: multiple permite seleccionar varias */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleSelect}
          className="hidden"
        />
      </div>

      <p className="text-xs text-ink/60 mt-3">
        {helperText ||
          "Tocá la estrella para marcar una imagen como portada. Arrastrá para reordenar."}
      </p>
    </div>
  );
}



// ============================================================
// SortableImageCard — una imagen individual draggable
// ============================================================
interface SortableImageCardProps {
  id: string;
  item: ImageItem & { id: string };
  index: number;
  isPrimary: boolean;
  onRemove: () => void;
  onSetPrimary: () => void;
}

function SortableImageCard({
  id,
  item,
  index,
  isPrimary,
  onRemove,
  onSetPrimary,
}: SortableImageCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : "auto",
  };

  const previewSrc = item.kind === "existing" ? item.url : item.preview;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group aspect-square rounded-lg overflow-hidden border-2 ${
        isPrimary ? "border-accent-700" : "border-transparent"
      } ${isDragging ? "ring-2 ring-accent-700 shadow-2xl" : ""}`}
    >
      {/* Imagen */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={previewSrc}
        alt={`Imagen ${index + 1}`}
        className="w-full h-full object-cover pointer-events-none select-none"
        draggable={false}
      />

      {/* Drag handle: cubre la mayor parte de la card */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="absolute inset-0 cursor-grab active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-accent-700"
        aria-label={`Arrastrar imagen ${index + 1}`}
      />

      {/* Overlay oscuro al hover */}
      <div className="absolute inset-0 bg-ink/0 group-hover:bg-ink/20 transition-colors pointer-events-none" />

      {/* Número de orden — esquina superior izquierda */}
      <div className="absolute top-2 left-2 bg-ink/85 backdrop-blur-sm text-bone text-xs font-display font-light h-7 w-7 rounded-full flex items-center justify-center pointer-events-none">
        {index + 1}
      </div>

      {/* Drag indicator — visible en hover */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-ink/85 backdrop-blur-sm text-bone p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <GripVertical className="h-3.5 w-3.5" />
      </div>

      {/* Acciones — esquina superior derecha */}
      <div className="absolute top-2 right-2 flex flex-col gap-1.5 z-10">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="bg-red-500/90 hover:bg-red-600 text-white p-1.5 rounded-md backdrop-blur-sm shadow-lg"
          aria-label="Eliminar imagen"
          title="Eliminar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        {!isPrimary && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSetPrimary();
            }}
            className="bg-bone/90 hover:bg-accent text-ink p-1.5 rounded-md backdrop-blur-sm shadow-lg"
            aria-label="Marcar como portada"
            title="Hacer portada"
          >
            <Star className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Badge "Portada" */}
      {isPrimary && (
        <div className="absolute bottom-2 left-2 bg-accent text-ink text-[10px] uppercase tracking-widest font-medium px-2 py-1 rounded-full flex items-center gap-1 pointer-events-none">
          <Star className="h-2.5 w-2.5 fill-current" />
          Portada
        </div>
      )}

      {/* Badge "Nueva" */}
      {item.kind === "new" && (
        <div className="absolute bottom-2 right-2 bg-ink/85 text-bone text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded pointer-events-none">
          {formatBytes(item.file.size)}
        </div>
      )}
    </div>
  );
}
