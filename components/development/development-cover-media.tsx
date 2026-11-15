"use client";

import Image from "next/image";
import { ViewportVideo } from "@/components/viewport-video";

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
  if (video) {
    return (
      <ViewportVideo
        src={video}
        poster={image}
        muted
        loop
        playsInline
        autoPlay
        preload="metadata"
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
