/** Lossless structural compression. Never rewrite encrypted or signed PDFs. */
export async function optimizePdfBytes(input: Uint8Array): Promise<Uint8Array> {
  if (input.byteLength < 100_000) return input;
  const marker = new TextDecoder("latin1").decode(input);
  if (marker.includes("/ByteRange") || marker.includes("/Encrypt")) return input;
  try {
    const { PDFDocument } = await import("pdf-lib");
    const pdf = await PDFDocument.load(input, { updateMetadata: false });
    const output = await pdf.save({ useObjectStreams: true, addDefaultPage: false, updateFieldAppearances: false });
    return output.byteLength < input.byteLength * 0.95 ? output : input;
  } catch { return input; }
}

export async function optimizePdfFile(file: File): Promise<File> {
  if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) return file;
  const input = new Uint8Array(await file.arrayBuffer());
  const output = await optimizePdfBytes(input);
  return output === input ? file : new File([output], file.name, { type: "application/pdf", lastModified: file.lastModified });
}
