import sharp from "sharp";
import { optimizePdfBytes } from "@/lib/pdf-optimize";

export async function optimizeServerUpload(file: File): Promise<File> {
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    const input = new Uint8Array(await file.arrayBuffer());
    const output = await optimizePdfBytes(input);
    return output === input ? file : new File([output], file.name, { type:"application/pdf" });
  }
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  const input = Buffer.from(await file.arrayBuffer());
  const image = sharp(input, { limitInputPixels: 40_000_000 });
  const metadata = await image.metadata();
  if ((metadata.pages || 1) > 1) return file;
  const output = await image.rotate().resize(1920,1920,{fit:"inside",withoutEnlargement:true}).webp({quality:80}).toBuffer();
  return output.length < input.length ? new File([output],file.name.replace(/\.[^.]+$/,'.webp'),{type:"image/webp"}) : file;
}
