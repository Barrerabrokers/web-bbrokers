"use client";

import { useState } from "react";
import { blogVideo } from "@/lib/blog";

export function BlogVideo({ url, title = "Video de la nota", poster, featured = false }: { url: string; title?: string; poster?: string; featured?: boolean }) {
  const video = blogVideo(url);
  const [portraitFile, setPortraitFile] = useState(false);
  if (!video) return null;
  const portrait = portraitFile || /youtube\.com\/shorts\//i.test(url);
  return <figure className={`blog-video${featured ? " blog-video-featured" : ""}${portrait ? " blog-video-portrait" : ""}`}>
    <div className="blog-video-frame">
      {video.kind === "embed" ? <iframe src={video.src} title={title} loading={featured ? "eager" : "lazy"} allow="encrypted-media; picture-in-picture; fullscreen" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /> : <video src={video.src} poster={poster} controls playsInline preload="metadata" aria-label={title} onLoadedMetadata={event => { const element = event.currentTarget; setPortraitFile(element.videoHeight > element.videoWidth); }}>Tu navegador no puede reproducir este video. Usá el enlace de abajo para verlo.</video>}
    </div>
    <figcaption><span>Video de la nota</span><a href={url} target="_blank" rel="noopener noreferrer">Ver en origen <span aria-hidden="true">↗</span></a></figcaption>
  </figure>;
}
