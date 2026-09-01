export const ALPHA_PLACE_LIBERTADOR_VIDEO =
  "/videos/alpha-place-libertador.mp4";

export function getDevelopmentVideo(
  name: string,
  uploadedVideo?: string,
  videoIsPrimary = false
): string | undefined {
  if (uploadedVideo) return videoIsPrimary ? uploadedVideo : undefined;

  return name.trim().toLowerCase().includes("alpha place libertador")
    ? ALPHA_PLACE_LIBERTADOR_VIDEO
    : undefined;
}
