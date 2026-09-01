"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

interface DevelopmentCoverMediaProps {
  name: string;
  image?: string;
  video?: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
}

export function DevelopmentCoverMedia({
  name,
  image,
  video,
  priority = false,
  sizes = "100vw",
  className = "object-cover",
}: DevelopmentCoverMediaProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playVideo, setPlayVideo] = useState(false);

  useEffect(() => {
    if (!video) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );
    const syncPlayback = () => setPlayVideo(!reducedMotion.matches);

    syncPlayback();
    reducedMotion.addEventListener("change", syncPlayback);
    return () => reducedMotion.removeEventListener("change", syncPlayback);
  }, [video]);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;

    if (playVideo) {
      element.play().catch(() => undefined);
    } else {
      element.pause();
    }
  }, [playVideo]);

  if (video) {
    return (
      <video
        ref={videoRef}
        src={video}
        poster={image}
        muted
        loop
        playsInline
        autoPlay={playVideo}
        preload={priority ? "auto" : "metadata"}
        aria-label={`Video de ${name}`}
        className={`absolute inset-0 h-full w-full ${className}`}
      />
    );
  }

  if (!image) return null;

  return (
    <Image
      src={image}
      alt={name}
      fill
      priority={priority}
      className={className}
      sizes={sizes}
    />
  );
}
