"use client";

const SILENT_VIDEO_MIME_TYPES = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
  "video/mp4",
];

function getSupportedVideoMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  return (
    SILENT_VIDEO_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ||
    ""
  );
}

function extensionForMimeType(mimeType: string) {
  return mimeType.includes("mp4") ? "mp4" : "webm";
}

function getBaseName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "") || "video";
}

export function isVideoFile(file: File) {
  return file.type.startsWith("video/");
}

export async function removeAudioFromVideoFile(file: File): Promise<File> {
  if (!isVideoFile(file)) return file;

  if (typeof document === "undefined") return file;

  const mimeType = getSupportedVideoMimeType();
  if (!mimeType) {
    throw new Error(
      "Tu navegador no permite preparar videos sin audio. Probá desde Chrome, Edge o Safari actualizado."
    );
  }

  const sourceUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  let outputStream: MediaStream | null = null;

  if (!ctx || !canvas.captureStream) {
    URL.revokeObjectURL(sourceUrl);
    throw new Error(
      "Tu navegador no permite preparar videos sin audio. Probá desde Chrome, Edge o Safari actualizado."
    );
  }

  video.src = sourceUrl;
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("No se pudo leer el video."));
    });

    const sourceWidth = video.videoWidth || 1280;
    const sourceHeight = video.videoHeight || 720;
    const maxSide = 1280;
    const ratio = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
    canvas.width = Math.max(2, Math.round(sourceWidth * ratio));
    canvas.height = Math.max(2, Math.round(sourceHeight * ratio));

    outputStream = canvas.captureStream(30);
    const recorder = new MediaRecorder(outputStream, {
      mimeType,
      videoBitsPerSecond: 4_000_000,
    });
    const chunks: BlobPart[] = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    const recordingDone = new Promise<Blob>((resolve, reject) => {
      recorder.onerror = () => reject(new Error("No se pudo preparar el video sin audio."));
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    });

    const drawFrame = () => {
      if (video.paused || video.ended) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      requestAnimationFrame(drawFrame);
    };

    video.currentTime = 0;
    recorder.start(1000);
    await video.play();
    drawFrame();

    await new Promise<void>((resolve) => {
      video.onended = () => resolve();
    });

    if (recorder.state !== "inactive") recorder.stop();
    const blob = await recordingDone;
    const ext = extensionForMimeType(mimeType);

    return new File([blob], `${getBaseName(file.name)}-sin-audio.${ext}`, {
      type: blob.type || mimeType,
      lastModified: Date.now(),
    });
  } finally {
    video.pause();
    URL.revokeObjectURL(sourceUrl);
    outputStream?.getTracks().forEach((track) => track.stop());
  }
}
