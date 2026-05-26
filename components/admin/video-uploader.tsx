"use client";

import { useRef, useState } from "react";
import { Video, Upload, X, Loader2, Film } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface VideoUploaderProps {
  videoUrl: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  maxSizeMB?: number;
}

const MAX_VIDEO_SIZE_MB = 100;

export function VideoUploader({
  videoUrl,
  onChange,
  label = "Video del desarrollo",
  maxSizeMB = MAX_VIDEO_SIZE_MB,
}: VideoUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  const handleFile = async (file: File) => {
    setError("");

    if (!file.type.startsWith("video/")) {
      setError("El archivo no es un video válido");
      return;
    }

    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`El video es muy grande (máx ${maxSizeMB}MB)`);
      return;
    }

    setIsUploading(true);
    setProgress(0);

    try {
      const ext = file.name.split(".").pop() || "mp4";
      const fileName = `video-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("properties")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) throw new Error(uploadError.message);

      const { data: urlData } = supabase.storage
        .from("properties")
        .getPublicUrl(fileName);

      onChange(urlData.publicUrl);
      setProgress(100);
    } catch (err: any) {
      setError(err.message || "Error al subir el video");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    if (e.target) e.target.value = "";
  };

  const handleRemove = () => {
    onChange(null);
    setProgress(0);
  };

  return (
    <div>
      <label className="label-tracking text-ink/85 block mb-3">{label}</label>

      {error && (
        <div className="mb-3 bg-red-50 border-l-4 border-red-500 text-red-700 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {/* Video preview si ya hay uno */}
      {videoUrl && (
        <div className="mb-4 relative rounded-lg overflow-hidden border border-ink/15">
          <video
            src={videoUrl}
            controls
            className="w-full max-h-[300px] object-contain bg-ink/5"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 bg-red-500/90 hover:bg-red-600 text-white p-1.5 rounded-md shadow-lg"
            aria-label="Eliminar video"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Botones de upload */}
      {!videoUrl && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {/* Grabar video desde cámara */}
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={isUploading}
              className="flex flex-col items-center justify-center gap-1.5 p-4 border border-ink/20 rounded-lg hover:border-ink/40 hover:bg-ink/5 transition-colors disabled:opacity-50"
            >
              <Film className="h-5 w-5 text-ink/70" />
              <span className="label-tracking text-xs text-ink">
                Grabar video
              </span>
              <span className="text-[10px] text-ink/50">Cámara</span>
            </button>

            {/* Elegir video de galería */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex flex-col items-center justify-center gap-1.5 p-4 border border-ink/20 rounded-lg hover:border-ink/40 hover:bg-ink/5 transition-colors disabled:opacity-50"
            >
              <Video className="h-5 w-5 text-ink/70" />
              <span className="label-tracking text-xs text-ink">
                Elegir video
              </span>
              <span className="text-[10px] text-ink/50">Galería / archivos</span>
            </button>
          </div>

          {/* Loading state */}
          {isUploading && (
            <div className="flex flex-col items-center justify-center p-6 border border-ink/15 rounded-lg">
              <Loader2 className="h-7 w-7 mb-2 animate-spin text-ink/60" />
              <span className="label-tracking text-sm text-ink/60">
                Subiendo video...
              </span>
              <span className="text-xs text-ink/40 mt-1">
                Esto puede tardar unos segundos
              </span>
            </div>
          )}

          {/* Inputs ocultos */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="video/*"
            capture="environment"
            onChange={handleSelect}
            className="hidden"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleSelect}
            className="hidden"
          />
        </div>
      )}

      <p className="text-xs text-ink/50 mt-3">
        MP4, MOV, WebM. Máx {maxSizeMB}MB. Desde el celular podés grabar directo.
      </p>
    </div>
  );
}
