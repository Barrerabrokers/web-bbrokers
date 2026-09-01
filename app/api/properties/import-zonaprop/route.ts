import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { randomUUID } from "crypto";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { canManageListings } from "@/lib/roles";
import { getServerSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const importSchema = z.object({
  url: z.string().url(),
});

type ImportedProperty = {
  title: string;
  description: string;
  price?: number;
  expenses?: number;
  location: string;
  address: string;
  bedrooms?: number;
  bathrooms?: number;
  area?: number;
  features: string[];
  images: string[];
  sourceUrl: string;
};

const browserHeaders = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "es-AR,es;q=0.9,en;q=0.7",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
};

function decodeHtml(value: string) {
  return value
    .replace(/\\u002F/g, "/")
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function isCloudflareChallenge(response: Response, html?: string) {
  const mitigated = response.headers.get("cf-mitigated");
  const server = response.headers.get("server");

  return (
    mitigated === "challenge" ||
    /cloudflare/i.test(server || "") && response.status === 403 ||
    /challenge-platform|challenges\.cloudflare\.com|cf-ray|Just a moment/i.test(html || "")
  );
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 18000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchZonapropHtml(url: URL) {
  const response = await fetchWithTimeout(url.toString(), {
    cache: "no-store",
    headers: browserHeaders,
  });

  const html = await response.text();

  if (isCloudflareChallenge(response, html)) {
    throw new Error(
      "Zonaprop bloqueó la lectura automática de esta publicación con una verificación de seguridad. Probá nuevamente en unos minutos; si persiste, cargá los datos manualmente."
    );
  }

  if (!response.ok) {
    throw new Error(`Zonaprop no permitió leer la publicación (${response.status}).`);
  }

  if (!html.trim()) {
    throw new Error("Zonaprop respondió sin contenido para importar.");
  }

  return html;
}

function stripTags(value: string) {
  return decodeHtml(value.replace(/<[^>]+>/g, " "));
}

function compact(value?: string | null) {
  return decodeHtml(value || "").replace(/\s+/g, " ").trim();
}

function metaContent(html: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>|<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`,
    "i"
  );
  const match = html.match(pattern);
  return compact(match?.[1] || match?.[2]);
}

function pageTitle(html: string) {
  return compact(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
}

function parseNumber(value?: string | number | null) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value || "");
  if (!raw.trim()) return undefined;
  const normalized = raw.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function firstNumberNear(htmlText: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = htmlText.match(pattern);
    const value = parseNumber(match?.[1]);
    if (value !== undefined) return value;
  }
  return undefined;
}

function normalizeImageUrl(raw: string, sourceUrl: string) {
  const decoded = decodeHtml(raw);
  if (!decoded || decoded.startsWith("data:")) return "";

  try {
    return new URL(decoded, sourceUrl).toString();
  } catch {
    return "";
  }
}

function collectImages(html: string, jsonLdObjects: unknown[], sourceUrl: string) {
  const urls = new Set<string>();

  const addImage = (value: unknown) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(addImage);
      return;
    }
    if (typeof value === "object") {
      const maybeObject = value as Record<string, unknown>;
      addImage(maybeObject.url || maybeObject.contentUrl);
      return;
    }
    if (typeof value !== "string") return;
    const url = normalizeImageUrl(value, sourceUrl);
    if (url && /^https?:\/\//i.test(url)) urls.add(url);
  };

  jsonLdObjects.forEach((item) => {
    if (item && typeof item === "object") {
      addImage((item as Record<string, unknown>).image);
      addImage((item as Record<string, unknown>).photo);
    }
  });

  addImage(metaContent(html, "og:image"));
  addImage(metaContent(html, "twitter:image"));

  Array.from(html.matchAll(/(?:src|data-src|content)=["']([^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?)["']/gi)).forEach((match) => {
    addImage(match[1]);
  });

  Array.from(html.matchAll(/https?:\\?\/\\?\/[^"'\\\s]+?\.(?:jpg|jpeg|png|webp)(?:\?[^"'\\\s<]*)?/gi)).forEach((match) => {
    addImage(match[0]);
  });

  return Array.from(urls).slice(0, 24);
}

function imageExtension(url: string, contentType: string | null) {
  if (contentType?.includes("png")) return "png";
  if (contentType?.includes("webp")) return "webp";
  if (contentType?.includes("jpeg") || contentType?.includes("jpg")) return "jpg";

  try {
    const extension = new URL(url).pathname.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (extension && ["jpg", "jpeg", "png", "webp"].includes(extension)) return extension;
  } catch {}

  return "jpg";
}

async function mirrorImagesToSupabase(imageUrls: string[], sourceUrl: string) {
  const supabase = getServerSupabase();
  const mirroredUrls: string[] = [];
  const fallbackUrls: string[] = [];

  for (const imageUrl of imageUrls.slice(0, 16)) {
    try {
      const response = await fetch(imageUrl, {
        cache: "no-store",
        headers: {
          Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          Referer: sourceUrl,
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        },
      });

      if (!response.ok) {
        fallbackUrls.push(imageUrl);
        continue;
      }

      const contentType = response.headers.get("content-type") || "image/jpeg";
      if (!contentType.startsWith("image/")) {
        fallbackUrls.push(imageUrl);
        continue;
      }

      const buffer = await response.arrayBuffer();
      if (buffer.byteLength === 0 || buffer.byteLength > 5 * 1024 * 1024) {
        fallbackUrls.push(imageUrl);
        continue;
      }

      const ext = imageExtension(imageUrl, contentType);
      const filePath = `properties/zonaprop/${Date.now()}-${randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("properties").upload(filePath, buffer, {
        contentType,
        upsert: false,
      });

      if (error) {
        console.error("Zonaprop image upload error:", error.message);
        fallbackUrls.push(imageUrl);
        continue;
      }

      const { data } = supabase.storage.from("properties").getPublicUrl(filePath);
      mirroredUrls.push(data.publicUrl);
    } catch (error) {
      console.error("Zonaprop image mirror error:", error);
      fallbackUrls.push(imageUrl);
    }
  }

  return mirroredUrls.length ? mirroredUrls : fallbackUrls.slice(0, 16);
}

function extractJsonLd(html: string) {
  const objects: unknown[] = [];
  Array.from(html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)).forEach((match) => {
    const raw = stripTags(match[1]);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) objects.push(...parsed);
      else if (parsed?.["@graph"] && Array.isArray(parsed["@graph"])) objects.push(...parsed["@graph"]);
      else objects.push(parsed);
    } catch {
      // Algunos portales inyectan JSON-LD parcialmente escapado; seguimos con metadatos HTML.
    }
  });
  return objects;
}

function findFirstString(objects: unknown[], keys: string[]) {
  for (const item of objects) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return compact(value);
      if (value && typeof value === "object") {
        const nested = value as Record<string, unknown>;
        if (typeof nested.name === "string") return compact(nested.name);
        if (typeof nested.streetAddress === "string") return compact(nested.streetAddress);
      }
    }
  }
  return "";
}

function findOfferPrice(objects: unknown[]) {
  for (const item of objects) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const offers = record.offers;
    if (offers && typeof offers === "object") {
      const offer = Array.isArray(offers) ? offers[0] : offers;
      const price = parseNumber((offer as Record<string, unknown>)?.price as string | number | undefined);
      if (price !== undefined) return price;
    }
    const price = parseNumber(record.price as string | number | undefined);
    if (price !== undefined) return price;
  }
  return undefined;
}

function extractFeatures(text: string) {
  const features = new Set<string>();
  const candidates = [
    /balc[oó]n/gi,
    /terraza/gi,
    /cochera/gi,
    /pileta/gi,
    /piscina/gi,
    /parrilla/gi,
    /sum\b/gi,
    /laundry/gi,
    /seguridad(?:\s*24\s*hs)?/gi,
    /luminoso/gi,
    /apto profesional/gi,
    /amenities/gi,
    /baulera/gi,
  ];

  for (const pattern of candidates) {
    const match = text.match(pattern)?.[0];
    if (match) features.add(match.charAt(0).toUpperCase() + match.slice(1).toLowerCase());
  }

  return Array.from(features).slice(0, 12);
}

function inferLocation(address: string, title: string, description: string) {
  const haystack = `${address} ${title} ${description}`;
  const neighborhoods = [
    "Palermo",
    "Recoleta",
    "Belgrano",
    "Nuñez",
    "Núñez",
    "Puerto Madero",
    "San Telmo",
    "Balvanera",
    "Caballito",
    "Colegiales",
    "Villa Crespo",
    "Almagro",
    "Retiro",
    "Barrio Norte",
  ];
  const found = neighborhoods.find((item) => new RegExp(`\\b${item}\\b`, "i").test(haystack));
  return found ? `${found.replace("Nuñez", "Núñez")}, CABA` : "Ciudad de Buenos Aires";
}

function parseZonapropHtml(html: string, sourceUrl: string): ImportedProperty {
  const jsonLdObjects = extractJsonLd(html);
  const plainText = stripTags(html);
  const title =
    findFirstString(jsonLdObjects, ["name", "headline"]) ||
    metaContent(html, "og:title") ||
    pageTitle(html).replace(/\s*\|\s*Zonaprop.*$/i, "");
  const description =
    findFirstString(jsonLdObjects, ["description"]) ||
    metaContent(html, "og:description") ||
    metaContent(html, "description");
  const address = findFirstString(jsonLdObjects, ["address", "streetAddress"]) || "";
  const price =
    findOfferPrice(jsonLdObjects) ||
    firstNumberNear(plainText, [
      /(?:USD|U\$S|US\$)\s*([\d.,]+)/i,
      /precio\s*(?:USD|U\$S|US\$)?\s*([\d.,]+)/i,
    ]);

  const area = firstNumberNear(plainText, [
    /([\d.,]+)\s*m(?:²|2)\s*(?:totales|total|cubiertos|cubierta|superficie)/i,
    /superficie[^0-9]{0,30}([\d.,]+)\s*m/i,
  ]);
  const bedrooms = firstNumberNear(plainText, [
    /(\d+)\s*dormitorios?/i,
    /(\d+)\s*habitaciones?/i,
    /(\d+)\s*ambientes?/i,
  ]);
  const bathrooms = firstNumberNear(plainText, [/(\d+)\s*bañ(?:o|os)/i, /(\d+)\s*bath/i]);
  const expenses = firstNumberNear(plainText, [/expensas[^0-9]{0,20}\$?\s*([\d.,]+)/i]);
  const images = collectImages(html, jsonLdObjects, sourceUrl);
  const safeTitle = title || "Propiedad importada de Zonaprop";
  const safeDescription = description || `Propiedad importada desde Zonaprop.\n\nFuente: ${sourceUrl}`;

  return {
    title: safeTitle,
    description: safeDescription,
    price,
    expenses,
    location: inferLocation(address, safeTitle, safeDescription),
    address: address || inferLocation("", safeTitle, safeDescription),
    bedrooms: bedrooms !== undefined ? Math.max(0, Math.round(bedrooms)) : undefined,
    bathrooms: bathrooms !== undefined ? Math.max(0, Math.round(bathrooms)) : undefined,
    area,
    features: extractFeatures(`${plainText} ${safeDescription}`),
    images,
    sourceUrl,
  };
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "No autorizado. Debes iniciar sesion." }, { status: 401 });
  }
  if (!canManageListings(session.user.role)) {
    return NextResponse.json({ error: "No autorizado para gestionar propiedades" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Pegá un link válido de Zonaprop." }, { status: 400 });
  }

  const url = new URL(parsed.data.url);
  if (!/(^|\.)zonaprop\.com(\.ar)?$/i.test(url.hostname)) {
    return NextResponse.json({ error: "Por seguridad solo se aceptan links de Zonaprop." }, { status: 400 });
  }

  try {
    const html = await fetchZonapropHtml(url);
    const property = parseZonapropHtml(html, url.toString());

    try {
      property.images = await mirrorImagesToSupabase(property.images, url.toString());
    } catch (error) {
      console.error("Zonaprop image mirror failed, keeping source images:", error);
      property.images = property.images.slice(0, 16);
    }

    return NextResponse.json({ property });
  } catch (error) {
    console.error("Zonaprop import error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo leer la publicación de Zonaprop.",
      },
      { status: 500 }
    );
  }
}
