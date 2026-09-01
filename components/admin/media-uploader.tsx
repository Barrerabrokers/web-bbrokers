"use client";

import { useCallback, useMemo, useState } from "react";
import { Image as ImageIcon, Star, Video } from "lucide-react";
import { ImageUploader, type ImageItem } from "./image-uploader";
import { VideoUploader } from "./video-uploader";
import { QrUpload } from "./qr-upload";

interface MediaUploaderProps {
  // Images
  items: ImageItem[];
  primaryIndex: number;
  onImagesChange: (items: ImageItem[], primaryIndex: number) => void;
  // Video
  videoUrl: string | null;
  onVideoChange: (url: string | null) => void;
  videoUrls?: string[];
  onVideosChange?: (urls: string[]) => void;
  videoIsPrimary?: boolean;
  onVideoPrimaryChange?: (isPrimary: boolean) => void;
  // Labels
  imageLabel?: string;
  videoLabel?: string;
  imageHelperText?: string;
}

export function MediaUploader({
  items,
  primaryIndex,
  onImagesChange,
  videoUrl,
  onVideoChange,
  videoUrls,
  onVideosChange,
  videoIsPrimary = false,
  onVideoPrimaryChange,
  imageLabel = "Imágenes",
  videoLabel = "Video",
  imageHelperText,
}: MediaUploaderProps) {
  const [activeTab, setActiveTab] = useState<"images" | "video">("images");
  const allVideoUrls = useMemo(
    () => videoUrls || (videoUrl ? [videoUrl] : []),
    [videoUrl, videoUrls]
  );

  // QR uploads can contain both images and a development video.
  const handleQrFiles = useCallback(
    (urls: string[]) => {
      const videoPattern = /\.(mp4|mov|m4v|webm|avi)(?:\?|$)/i;
      const videoUrls = urls.filter((url) => videoPattern.test(url));
      const imageUrls = urls.filter((url) => !videoPattern.test(url));
      const newItems: ImageItem[] = imageUrls.map((url) => ({
        kind: "existing" as const,
        url,
        id: `qr-${Date.now()}-${Math.random()}`,
      }));
      const next = [...items, ...newItems];
      const nextPrimary = items.length === 0 ? 0 : primaryIndex;
      if (newItems.length > 0) onImagesChange(next, nextPrimary);
      if (videoUrls.length > 0) {
        if (onVideosChange) onVideosChange([...allVideoUrls, ...videoUrls]);
        onVideoChange(videoUrl || videoUrls[0] || null);
        onVideoPrimaryChange?.(true);
      }
    },
    [items, primaryIndex, onImagesChange, onVideoChange, onVideoPrimaryChange, onVideosChange, allVideoUrls, videoUrl]
  );

  const handleVideosChange = useCallback(
    (urls: string[]) => {
      onVideosChange?.(urls);
      if (!urls.length) {
        onVideoChange(null);
        onVideoPrimaryChange?.(false);
      } else if (!videoUrl || !urls.includes(videoUrl)) {
        onVideoChange(urls[0]);
      }
    },
    [onVideosChange, onVideoChange, onVideoPrimaryChange, videoUrl]
  );

  const handleVideoChange = useCallback(
    (url: string | null) => {
      onVideoChange(url);
      if (!url) onVideoPrimaryChange?.(false);
      else onVideoPrimaryChange?.(true);
    },
    [onVideoChange, onVideoPrimaryChange]
  );

  return (
    <div>
      {/* Tabs */}
      <div className="flex border-b border-ink/15 mb-6">
        <button
          type="button"
          onClick={() => setActiveTab("images")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "images"
              ? "border-ink text-ink"
              : "border-transparent text-ink/50 hover:text-ink/75"
          }`}
        >
          <ImageIcon className="h-4 w-4" />
          Imágenes
          {items.length > 0 && (
            <span className="ml-1 bg-ink/10 text-ink/70 text-[10px] px-1.5 py-0.5 rounded-full">
              {items.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("video")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "video"
              ? "border-ink text-ink"
              : "border-transparent text-ink/50 hover:text-ink/75"
          }`}
        >
          <Video className="h-4 w-4" />
          Video
          {allVideoUrls.length > 0 && (
            <span className="ml-1 bg-ink/10 text-ink/70 text-[10px] px-1.5 py-0.5 rounded-full">
              {allVideoUrls.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "images" && (
        <>
          <ImageUploader
            items={items}
            primaryIndex={primaryIndex}
            onChange={onImagesChange}
            label={imageLabel}
            helperText={imageHelperText}
          />
          {/* QR Upload option */}
          <div className="mt-4">
            <QrUpload onFilesReceived={handleQrFiles} />
          </div>
        </>
      )}

      {activeTab === "video" && (
        <>
          <VideoUploader
            videoUrl={videoUrl}
            onChange={handleVideoChange}
            videoUrls={onVideosChange ? allVideoUrls : undefined}
            onUrlsChange={onVideosChange ? handleVideosChange : undefined}
            label={videoLabel}
          />
          {onVideosChange && allVideoUrls.length > 1 && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {allVideoUrls.map((url, index) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => {
                    onVideoChange(url);
                    onVideoPrimaryChange?.(true);
                  }}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    videoUrl === url && videoIsPrimary
                      ? "border-accent-700 bg-accent/10 text-ink"
                      : "border-ink/15 bg-white text-ink/65 hover:border-ink/35"
                  }`}
                >
                  <Star className={`h-4 w-4 shrink-0 ${videoUrl === url && videoIsPrimary ? "fill-current text-accent-700" : ""}`} />
                  <span>Video {index + 1} como portada</span>
                </button>
              ))}
            </div>
          )}
          {videoUrl && onVideoPrimaryChange && (
            <label className={`mt-4 flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
              videoIsPrimary
                ? "border-accent-700 bg-accent/10 text-ink"
                : "border-ink/20 bg-white text-ink/75 hover:border-ink/35"
            }`}>
              <input
                type="checkbox"
                checked={videoIsPrimary}
                onChange={(event) => onVideoPrimaryChange(event.target.checked)}
                className="sr-only"
              />
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                videoIsPrimary ? "bg-accent text-ink" : "bg-ink/7 text-ink/55"
              }`}>
                <Star className={`h-4 w-4 ${videoIsPrimary ? "fill-current" : ""}`} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">Usar video como portada</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-ink/58">
                  Se reproducirá en las tarjetas, el mapa y la cabecera de la ficha.
                </span>
              </span>
              <span className={`h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors ${
                videoIsPrimary ? "bg-accent-700" : "bg-ink/20"
              }`}>
                <span className={`block h-4 w-4 rounded-full bg-white transition-transform ${
                  videoIsPrimary ? "translate-x-4" : "translate-x-0"
                }`} />
              </span>
            </label>
          )}
          <div className="mt-4">
            <QrUpload onFilesReceived={handleQrFiles} />
          </div>
        </>
      )}
    </div>
  );
}
