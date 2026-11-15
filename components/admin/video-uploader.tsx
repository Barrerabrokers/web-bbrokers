"use client";

import { useId, useRef, useState } from "react";
import { Video, X, Loader2, Film } from "lucide-react";
import { PortraitVideo } from "@/components/viewport-video";
import { normalizeYouTubeVideoUrl, getYouTubeVideoId } from "@/lib/youtube-video";
import { uploadPublicFile } from "@/lib/authorized-upload";
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
  const youtubeInputId = useId();
  const [youtubeUrl, setYoutubeUrl] = useState("");
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

  const addYouTubeVideo = (value = youtubeUrl) => {
    const normalized = normalizeYouTubeVideoUrl(value);
    if (!normalized) {
      setError("Pegá un enlace válido de un video de YouTube (normal, compartido o Shorts).");
      return;
    }
    if (urls.some((url) => getYouTubeVideoId(url) === getYouTubeVideoId(normalized))) {
      setError("Ese video de YouTube ya está agregado.");
      return;
    }
    emitChange(allowsMultiple ? [...urls, normalized] : [normalized]);
    setYoutubeUrl("");
    setError("");
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

      const { error: uploadError, url: uploadedUrl } = await uploadPublicFile(fileName, silentFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: silentFile.type,
        });

      if (uploadError) throw new Error(uploadError.message);

      const urlData = { publicUrl: uploadedUrl! };

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
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="label-tracking text-ink/85">{label}</span>
        {allowsMultiple && urls.length > 0 && (
          <span className="text-xs text-ink/70" aria-live="polite">{urls.length} {urls.length === 1 ? "video agregado" : "videos agregados"}</span>
        )}
      </div>
      {allowsMultiple && (
        <p className="mb-4 text-sm text-ink/70">Agregá avances de obra y videos de marketing. Cada video nuevo se suma a los anteriores.</p>
      )}

      {error && (
        <div role="alert" className="mb-3 bg-red-50 border-l-4 border-red-500 text-red-700 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {urls.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-4">
          {urls.map((url, index) => (
            <div key={url} className="relative w-full max-w-[220px] overflow-hidden rounded-lg border border-ink/15 bg-ink/5">
              <PortraitVideo
                src={url}
                aria-label={`Video ${index + 1}`}
                controls
                muted
                playsInline
                preload="metadata"
              />
              <span className="pointer-events-none absolute bottom-12 left-2 rounded-full bg-ink/75 px-2 py-1 text-[10px] text-white">
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
          <div className="space-y-2">
            <label htmlFor={youtubeInputId} className="block text-sm font-medium text-ink">Enlace de YouTube</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id={youtubeInputId}
                type="url"
                value={youtubeUrl}
                onChange={(event) => {
                  const value = event.target.value;
                  setYoutubeUrl(value);
                  event.target.setCustomValidity(value.trim() && !normalizeYouTubeVideoUrl(value) ? "Pegá un enlace válido de YouTube." : "");
                }}
                onPaste={(event) => {
                  const value = event.clipboardData.getData("text");
                  if (normalizeYouTubeVideoUrl(value)) {
                    event.preventDefault();
                    event.currentTarget.setCustomValidity("");
                    addYouTubeVideo(value);
                  }
                }}
                onBlur={() => {
                  if (youtubeUrl.trim() && !isUploading) addYouTubeVideo();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (youtubeUrl.trim() && !isUploading) addYouTubeVideo();
                  }
                }}
                placeholder="https://www.youtube.com/watch?v=..."
                disabled={isUploading}
                className="min-w-0 flex-1 rounded-lg border border-ink/20 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/60"
                aria-describedby={`${youtubeInputId}-help`}
              />
              <button type="button" onClick={() => addYouTubeVideo()} disabled={isUploading || !youtubeUrl.trim()} className="rounded-lg bg-ink px-4 py-2 text-sm text-white disabled:opacity-50">Agregar video</button>
            </div>
            <p id={`${youtubeInputId}-help`} className="text-xs text-ink/70">Al pegar un enlace válido, el video se agrega automáticamente. Guardá la ficha para conservarlo.</p>
          </div>
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
                {allowsMultiple ? "Elegir videos" : "Elegir video"}
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
            multiple={allowsMultiple}
            onChange={handleSelect}
            className="hidden"
          />
        </div>
      )}

      <p className="text-xs text-ink/50 mt-3">
        Enlaces de YouTube sin subir archivos. MP4, MOV, WebM: máx {maxSizeMB}MB por archivo; se guarda una copia sin audio.
      </p>
    </div>
  );
}
