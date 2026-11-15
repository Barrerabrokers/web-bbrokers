import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { normalizePressUrl } from "./press-links";

// Resolve and pin public IPv4 addresses to prevent private-network requests and DNS rebinding.
export function isPublicPressAddress(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = parts;
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && [0, 168].includes(b)) ||
    (a === 198 && [18, 19, 51].includes(b)) || (a === 203 && b === 0));
}

function decode(value: string) {
  return value.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi, entity => {
    const named: Record<string, string> = { "&amp;": "&", "&quot;": '"', "&apos;": "'", "&lt;": "<", "&gt;": ">" };
    if (named[entity.toLowerCase()]) return named[entity.toLowerCase()];
    const number = entity.toLowerCase().startsWith("&#x") ? parseInt(entity.slice(3, -1), 16) : Number(entity.slice(2, -1));
    return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : "";
  }).trim();
}

export function extractPressPreview(html: string, base: string) {
  const meta = new Map<string, string>();
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attrs = new Map<string, string>();
    for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) attrs.set(match[1].toLowerCase(), decode(match[2] ?? match[3] ?? match[4]));
    const name = attrs.get("property") || attrs.get("name");
    if (name && !meta.has(name.toLowerCase())) meta.set(name.toLowerCase(), attrs.get("content") || "");
  }
  const title = (meta.get("og:title") || meta.get("twitter:title") || decode(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "")).slice(0, 300);
  let image = "";
  try {
    const raw = meta.get("og:image:secure_url") || meta.get("og:image") || meta.get("twitter:image") || "";
    if (raw) {
      const candidate = normalizePressUrl(new URL(raw, base).toString());
      if (candidate?.startsWith("https://")) image = candidate;
    }
  } catch { /* The editor keeps manual image entry available. */ }
  return { title, image };
}

export async function fetchPressHtml(input: string) {
  const deadline = Date.now() + 10000;
  const visit = async (value: string, redirects: number): Promise<{ html: string; url: string }> => {
    const normalized = normalizePressUrl(value);
    if (!normalized) throw new Error("Ingresá un enlace válido.");
    const url = new URL(normalized);
    if (url.protocol !== "https:" || (url.port && url.port !== "443")) throw new Error("Usá el enlace https del portal.");
    const addresses = await new Promise<{ address: string; family: number }[]>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("El portal tardó demasiado. Completá la nota manualmente.")), Math.max(1, deadline - Date.now()));
      lookup(url.hostname, { all: true, family: 4 }).then(resolve, reject).finally(() => clearTimeout(timer));
    });
    if (!addresses.length || addresses.some(item => !isPublicPressAddress(item.address))) throw new Error("El enlace debe pertenecer a un portal público.");
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("El portal tardó demasiado. Podés completar la nota manualmente.");
    const result = await new Promise<{ html?: string; redirect?: string }>((resolve, reject) => {
      const req = request(url, { agent: false, headers: { "User-Agent": "BarreraBrokers-PressPreview/1.0", Accept: "text/html", "Accept-Encoding": "identity" }, lookup: (_host, options, callback) => options.all ? callback(null, addresses) : callback(null, addresses[0].address, 4) }, response => {
        if ([301, 302, 303, 307, 308].includes(response.statusCode || 0)) {
          response.resume();
          resolve({ redirect: response.headers.location });
          return;
        }
        if (response.statusCode !== 200 || !response.headers["content-type"]?.includes("text/html")) {
          response.resume(); reject(new Error("El portal no permite importar la nota. Completá título e imagen manualmente.")); return;
        }
        let size = 0;
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 2 * 1024 * 1024) { req.destroy(new Error("La página es demasiado grande. Completá la nota manualmente.")); return; }
          chunks.push(chunk);
        });
        response.on("end", () => resolve({ html: Buffer.concat(chunks).toString("utf8") }));
        response.on("error", reject);
      });
      const timer = setTimeout(() => req.destroy(new Error("El portal tardó demasiado. Completá la nota manualmente.")), remaining);
      req.on("close", () => clearTimeout(timer));
      req.on("error", reject);
      req.end();
    });
    if (result.redirect) {
      if (redirects >= 3) throw new Error("El portal redirige demasiadas veces.");
      return visit(new URL(result.redirect, url).toString(), redirects + 1);
    }
    return { html: result.html || "", url: url.toString() };
  };
  return visit(input, 0);
}

export async function fetchPressPreview(input: string) {
  const { html, url } = await fetchPressHtml(input);
  return extractPressPreview(html, url);
}
