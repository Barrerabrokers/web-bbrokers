"use client";

import { useEffect, useRef, useState } from "react";

interface YouTubeBackgroundProps {
  videoId: string;
  /** Fallback video URL (local mp4) shown until iframe loads or if iframe blocked */
  fallbackSrc?: string;
  /** Poster image while loading */
  posterSrc?: string;
  className?: string;
}

/**
 * YouTube video as fullscreen background.
 *
 * - Uses youtube-nocookie + minimal branding params
 * - Scales the 16:9 iframe to fill any aspect ratio (no black bars)
 * - pointer-events-none so the iframe doesn't capture clicks or show controls
 * - Local mp4 fallback (poster + autoplay) shown until YouTube loads
 */
export function YouTubeBackground({
  videoId,
  fallbackSrc,
  posterSrc,
  className = "",
}: YouTubeBackgroundProps) {
  const [iframeReady, setIframeReady] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // Marca el iframe como listo despues de un delay corto para que el video
    // de YouTube tenga tiempo de empezar antes de fadear el fallback.
    const t = setTimeout(() => setIframeReady(true), 1500);
    return () => clearTimeout(t);
  }, []);

  const params = new URLSearchParams({
    autoplay: "1",
    mute: "1",
    loop: "1",
    playlist: videoId, // requerido para loop
    controls: "0",
    showinfo: "0",
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
    iv_load_policy: "3", // hide annotations
    disablekb: "1",
    fs: "0",
    cc_load_policy: "0",
  });

  const youtubeUrl = `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;

  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`}>
      {/* Fallback poster image (visible inmediatamente) */}
      {posterSrc && !iframeReady && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${posterSrc})` }}
        />
      )}

      {/* Local mp4 fallback - se muestra primero, fade out cuando iframe esta listo */}
      {fallbackSrc && (
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
            iframeReady ? "opacity-0" : "opacity-100"
          }`}
        >
          <source src={fallbackSrc} type="video/mp4" />
        </video>
      )}

      {/* YouTube iframe scaled to fill (16:9 aspect preserved, cropping the longer dimension) */}
      <div
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                   w-[max(100vw,177.78vh)] h-[max(56.25vw,100vh)]
                   pointer-events-none transition-opacity duration-1000 ${
                     iframeReady ? "opacity-100" : "opacity-0"
                   }`}
        aria-hidden="true"
      >
        <iframe
          ref={iframeRef}
          src={youtubeUrl}
          title="Buenos Aires Background Video"
          frameBorder={0}
          allow="autoplay; encrypted-media; picture-in-picture"
          className="absolute inset-0 w-full h-full"
          loading="eager"
        />
      </div>
    </div>
  );
}
