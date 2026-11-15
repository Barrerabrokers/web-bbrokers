import { compressImage } from "@/lib/image-utils";
import { optimizePdfFile } from "@/lib/pdf-optimize";

export async function optimizeUploadFile(file: File): Promise<File> {
  if (file.type.startsWith("image/")) return compressImage(file);
  return optimizePdfFile(file);
}
