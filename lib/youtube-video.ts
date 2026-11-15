/** Accept only YouTube video URLs; never embed an arbitrary supplied origin. */
export function getYouTubeVideoId(value?: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const host = url.hostname.toLowerCase();
    const parts = url.pathname.split("/").filter(Boolean);
    let id: string | null = null;
    if (host === "youtu.be" || host === "www.youtu.be") {
      if (parts.length === 1) id = parts[0];
    } else if (["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"].includes(host)) {
      if (url.pathname === "/watch") id = url.searchParams.get("v");
      else if (["embed", "shorts", "live"].includes(parts[0]) && parts.length === 2) id = parts[1];
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function normalizeYouTubeVideoUrl(value: string): string | null {
  const id = getYouTubeVideoId(value);
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
}

export function getYouTubeEmbedUrl(
  value: string,
  options: { autoPlay?: boolean; muted?: boolean; loop?: boolean } = {}
): string | null {
  const id = getYouTubeVideoId(value);
  if (!id) return null;
  const params = ["playsinline=1", "rel=0"];
  if (options.autoPlay) params.push("autoplay=1");
  // Muted playback is needed for browser autoplay policies.
  if (options.autoPlay || options.muted) params.push("mute=1");
  if (options.loop) params.push("loop=1", `playlist=${id}`);
  return `https://www.youtube-nocookie.com/embed/${id}?${params.join("&")}`;
}
