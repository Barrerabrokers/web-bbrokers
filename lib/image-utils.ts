/**
 * Utilidades para procesamiento de imagenes en el cliente.
 * Comprime y redimensiona imagenes antes de subirlas a Supabase
 * para reducir tiempo de carga y costos de storage.
 */

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0..1
  mimeType?: "image/jpeg" | "image/webp";
}

const DEFAULTS: Required<CompressOptions> = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.85,
  mimeType: "image/jpeg",
};

/**
 * Comprime y redimensiona un archivo de imagen usando Canvas.
 * Devuelve un nuevo File con extension acorde al mimeType.
 */
export async function compressImage(
  file: File,
  opts: CompressOptions = {}
): Promise<File> {
  const options = { ...DEFAULTS, ...opts };

  // Si no es una imagen, devolverla tal cual
  if (!file.type.startsWith("image/")) {
    return file;
  }

  // GIFs y SVGs no se comprimen (perderian animacion / vectores)
  if (file.type === "image/gif" || file.type === "image/svg+xml") {
    return file;
  }

  const dataUrl = await readAsDataURL(file);
  const img = await loadImage(dataUrl);

  // Calcular nuevas dimensiones manteniendo aspect ratio
  let { width, height } = img;
  const ratio = Math.min(
    options.maxWidth / width,
    options.maxHeight / height,
    1
  );
  width = Math.round(width * ratio);
  height = Math.round(height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  ctx.drawImage(img, 0, 0, width, height);

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, options.mimeType, options.quality)
  );

  if (!blob) return file;

  // Si la "compresion" agrando el archivo, devolver el original
  if (blob.size >= file.size) {
    return file;
  }

  const ext = options.mimeType === "image/webp" ? "webp" : "jpg";
  const baseName = file.name.replace(/\.[^.]+$/, "");
  const newName = `${baseName}.${ext}`;

  return new File([blob], newName, {
    type: options.mimeType,
    lastModified: Date.now(),
  });
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo cargar la imagen"));
    img.src = src;
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
