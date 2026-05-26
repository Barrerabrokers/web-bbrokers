"use client";

import { useState } from "react";
import { Image as ImageIcon, Video } from "lucide-react";
import { ImageUploader, type ImageItem } from "./image-uploader";
import { VideoUploader } from "./video-uploader";

interface MediaUploaderProps {
  // Images
  items: ImageItem[];
  primaryIndex: number;
  onImagesChange: (items: ImageItem[], primaryIndex: number) => void;
  // Video
  videoUrl: string | null;
  onVideoChange: (url: string | null) => void;
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
  imageLabel = "Imágenes",
  videoLabel = "Video",
  imageHelperText,
}: MediaUploaderProps) {
  const [activeTab, setActiveTab] = useState<"images" | "video">("images");

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
          {videoUrl && (
            <span className="ml-1 bg-ink/10 text-ink/70 text-[10px] px-1.5 py-0.5 rounded-full">
              1
            </span>
          )}
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "images" && (
        <ImageUploader
          items={items}
          primaryIndex={primaryIndex}
          onChange={onImagesChange}
          label={imageLabel}
          helperText={imageHelperText}
        />
      )}

      {activeTab === "video" && (
        <VideoUploader
          videoUrl={videoUrl}
          onChange={onVideoChange}
          label={videoLabel}
        />
      )}
    </div>
  );
}
