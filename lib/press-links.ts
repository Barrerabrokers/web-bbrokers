import { z } from "zod";

export type PressEntry = { title: string; url: string; image?: string };
export type PressItem = PressEntry & { host: string; label: string };

export function normalizePressUrl(value: string): string | null {
  try {
    const raw = value.trim();
    if (!raw) return null;
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : `https://${raw}`);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || !url.hostname.includes(".")) return null;
    return url.toString();
  } catch { return null; }
}

function legacyTitle(url: string) {
  try {
    const path = new URL(normalizePressUrl(url) || url).pathname.split("/").filter(Boolean).pop();
    return path ? decodeURIComponent(path).replace(/[-_]+/g, " ").trim() : "Ver nota completa";
  } catch { return "Ver nota completa"; }
}

/** Existing newline-separated URLs remain editable until the next save. */
export function readPressEntries(value?: string): PressEntry[] {
  if (!value?.trim()) return [];
  if (value.trim().startsWith("[")) {
    try {
      const entries: unknown = JSON.parse(value);
      if (Array.isArray(entries)) return entries.map(entry => ({
        title: typeof entry?.title === "string" ? entry.title : "",
        url: typeof entry?.url === "string" ? entry.url : "",
        image: typeof entry?.image === "string" ? entry.image : "",
      }));
    } catch { return [{ title: "", url: value }]; }
  }
  return value.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(url => ({ title: legacyTitle(url), url: normalizePressUrl(url) || url }));
}

const imageSchema = z.string().trim().max(2048).optional().transform((value, context) => {
  if (!value) return "";
  const image = normalizePressUrl(value);
  if (!image || !image.startsWith("https://")) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "La imagen debe tener un enlace https válido." });
    return z.NEVER;
  }
  return image;
});

const entriesSchema = z.array(z.object({
  image: imageSchema,
  title: z.string().trim().min(1, "Completá el título de cada nota.").max(300, "El título puede tener hasta 300 caracteres."),
  url: z.string().trim().max(2048).transform((value, context) => {
    const url = normalizePressUrl(value);
    if (!url) { context.addIssue({ code: z.ZodIssueCode.custom, message: "Ingresá un link válido de la nota (http o https)." }); return z.NEVER; }
    return url;
  }),
}));

export function serializePressLinks(value: string): string {
  return JSON.stringify(entriesSchema.parse(readPressEntries(value)));
}

export function parsePressLinks(value?: string): PressItem[] {
  return readPressEntries(value).map(entry => {
    const url = normalizePressUrl(entry.url);
    const title = entry.title.trim() || legacyTitle(entry.url);
    return { image: entry.image && normalizePressUrl(entry.image)?.startsWith("https://") ? normalizePressUrl(entry.image)! : "", url: url || "", title, label: title, host: url ? new URL(url).hostname.replace(/^www\./, "") : "Prensa" };
  });
}
