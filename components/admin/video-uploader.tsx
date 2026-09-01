"use client";

import { useRef, useState } from "react";
import { Video, Upload, X, Loader2, Film } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { removeAudioFromVideoFile } from "@/lib/video-utils";

interface VideoUploaderProps {
  videoUrl?: string | null;
  onChange?: (url: string | null) => void;
  videoUrls?: string[];
  onUrlsChange?: (urls: string[]) => void;
  label?: string;
  maxSizeMB?: number;
}

const MAX_VIDEO_SIZE_MB = 50;

export function VideoUploader({
  videoUrl,
  onChange,
  videoUrls,
  onUrlsChange,
  label = "Video del desarrollo",
  maxSizeMB = MAX_VIDEO_SIZE_MB,
}: VideoUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const urls = videoUrls || (videoUrl ? [videoUrl] : []);
  const allowsMultiple = Boolean(onUrlsChange);

  const emitChange = (nextUrls: string[]) => {
    if (onUrlsChange) onUrlsChange(nextUrls);
    else onChange?.(nextUrls[0] || null);
  };

  const handleFile = async (file: File, currentUrls = urls): Promise<string | null> => {
    setError("");

    if (!file.type.startsWith("video/")) {
      setError("El archivo no es un video válido");
      return null;
    }

    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`El video es muy grande (máx ${maxSizeMB}MB)`);
      return null;
    }

    setIsUploading(true);
    setIsPreparing(true);
    setProgress(0);

    try {
      const silentFile = await removeAudioFromVideoFile(file);
      setIsPreparing(false);

      if (silentFile.size > maxSizeMB * 1024 * 1024) {
        setError(`El video sin audio es muy grande (máx ${maxSizeMB}MB)`);
        return null;
      }

      const ext = silentFile.name.split(".").pop() || "webm";
      const fileName = `video-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("properties")
        .upload(fileName, silentFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: silentFile.type,
        });

      if (uploadError) throw new Error(uploadError.message);

      const { data: urlData } = supabase.storage
        .from("properties")
        .getPublicUrl(fileName);

      emitChange([...currentUrls, urlData.publicUrl]);
      setProgress(100);
      return urlData.publicUrl;
    } catch (err: any) {
      setError(err.message || "Error al subir el video");
      return null;
    } finally {
      setIsPreparing(false);
      setIsUploading(false);
    }
  };

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    let nextUrls = [...urls];
    for (const file of files) {
      const uploadedUrl = await handleFile(file, nextUrls);
      if (uploadedUrl) nextUrls = [...nextUrls, uploadedUrl];
    }
    if (e.target) e.target.value = "";
  };

  const handleRemove = (url: string) => {
    emitChange(urls.filter((candidate) => candidate !== url));
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

      {urls.length > 0 && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          {urls.map((url, index) => (
            <div key={url} className="relative overflow-hidden rounded-lg border border-ink/15 bg-ink/5">
              <video
                src={url}
                muted
                playsInline
                preload="metadata"
                className="aspect-video w-full object-cover"
              />
              <span className="absolute bottom-2 left-2 rounded-full bg-ink/75 px-2 py-1 text-[10px] text-white">
                Video {index + 1}
              </span>
              <button
                type="button"
                onClick={() => handleRemove(url)}
                className="absolute right-2 top-2 rounded-md bg-red-500/90 p-1.5 text-white shadow-lg hover:bg-red-600"
                aria-label={`Eliminar video ${index + 1}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Botones de upload */}
      {(allowsMultiple || urls.length === 0) && (
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
                {isPreparing ? "Preparando video sin audio..." : "Subiendo video..."}
              </span>
              <span className="text-xs text-ink/40 mt-1">
                {isPreparing
                  ? "El archivo se regraba sin pistas de audio antes de guardarse."
                  : "Esto puede tardar unos segundos"}
              </span>
            </div>
          )}

          {/* Inputs ocultos */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="video/*"
            multiple={allowsMultiple}
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
        MP4, MOV, WebM. Máx {maxSizeMB}MB por video. Se sube una copia sin audio.
      </p>
    </div>
  );
}
