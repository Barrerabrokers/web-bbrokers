"use client";
import { getYouTubeEmbedUrl } from "@/lib/youtube-video";
import { useEffect, useRef, useState, type VideoHTMLAttributes } from "react";

// Load videos only as they enter the page viewport. Retain the source once
// loaded, so scrolling back does not trigger another full download.
export function ViewportVideo(props: VideoHTMLAttributes<HTMLVideoElement>) {
  const embedUrl = typeof props.src === "string" ? getYouTubeEmbedUrl(props.src, { autoPlay: props.autoPlay, muted: props.muted, loop: props.loop }) : null;
  if (embedUrl) {
    return (
      <iframe
        key={embedUrl}
        src={embedUrl}
        title={props["aria-label"]?.replace(" sin audio", "") || "Video de YouTube"}
        className={props.className}
        style={{ border: 0, ...props.style }}
        loading="lazy"
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    );
  }
  return <LocalViewportVideo {...props} />;
}

/** Keep social videos in their original 9:16 frame, without a landscape stage. */
export function PortraitVideo({ className, style, ...props }: VideoHTMLAttributes<HTMLVideoElement>) {
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-xl bg-black ${className || ""}`}
      style={{ width: "min(100%, 420px, 45svh)", aspectRatio: "9 / 16", ...style }}
    >
      <ViewportVideo {...props} className="absolute inset-0 h-full w-full object-contain" />
    </div>
  );
}

function LocalViewportVideo({ src, autoPlay, preload, ...props }: VideoHTMLAttributes<HTMLVideoElement>) {
  const ref = useRef<HTMLVideoElement>(null);
  const [loaded,setLoaded] = useState(false);
  const [visible,setVisible] = useState(false);
  const [allowAutoplay,setAllowAutoplay] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as Navigator & {connection?:{saveData?:boolean}}).connection;
    const sync = () => setAllowAutoplay(!motion.matches && !connection?.saveData);
    sync(); motion.addEventListener("change",sync);
    const observer = new IntersectionObserver(entries => {
      const inView = entries.some(e=>e.isIntersecting);
      setVisible(inView);
      if(inView)setLoaded(true);
    },{rootMargin:"100px",threshold:0.01});
    observer.observe(element);
    return () => {observer.disconnect();motion.removeEventListener("change",sync);};
  },[src]);
  useEffect(() => {
    const element = ref.current;
    if(!element)return;
    if(autoPlay && allowAutoplay && visible && loaded)void element.play().catch(()=>{});
    else if(autoPlay)element.pause();
  },[autoPlay,allowAutoplay,visible,loaded,src]);
  return <video {...props} ref={ref} src={loaded?src:undefined} autoPlay={Boolean(autoPlay&&allowAutoplay&&visible)} preload={loaded?(preload||"metadata"):"none"}/>;
}
