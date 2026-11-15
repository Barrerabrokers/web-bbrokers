/** Public website events only. Never pass form contents, email or phone here. */
export const META_WEBSITE_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || "4377549835840146";
export type MetaWebsiteEvent = "PageView" | "ViewContent" | "Search" | "Lead" | "Contact";
export type MetaEventData = Record<string, string | string[] | number>;
type Pixel = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push?: Pixel;
  loaded?: boolean;
  version?: string;
};
declare global {
  interface Window { fbq?: Pixel; _fbq?: Pixel; }
}
let initialized = false;
let enabled = false;
let pageKey = "";
const pageEvents = new Set<string>();

export function isPublicTrackingUrl(url: URL): boolean {
  const path = url.pathname.replace(/^\/en(?=\/|$)/, "") || "/";
  if (!/^(\/$|\/(contacto|desarrollos|propiedades|blog|ciudad-de-buenos-aires|inversiones-real-estate-buenos-aires|invertir-en-real-estate-argentina|politica-de-privacidad)\/?$|\/(desarrollos|propiedades|blog)\/[^/]+\/?$)/.test(path)) return false;
  // Share/auth links can contain private tokens. Do not load the pixel there.
  return Array.from(url.searchParams.keys()).every(key =>
    ["categoria", "lang", "fbclid"].includes(key) || /^utm_(source|medium|campaign|term|content|id)$/.test(key));
}

function allowed() {
  return typeof window !== "undefined" && enabled && isPublicTrackingUrl(new URL(window.location.href));
}

export function setMetaTrackingEnabled(value: boolean) {
  enabled = value;
  if (!value) {
    pageKey = "";
    pageEvents.clear();
    if (initialized) window.fbq?.("consent", "revoke");
  } else if (initialized) window.fbq?.("consent", "grant");
}

function initializePixel() {
  if (initialized || !allowed() || !/^\d+$/.test(META_WEBSITE_PIXEL_ID)) return;
  if (!window.fbq) {
    const pixel: Pixel = Object.assign(function (...args: unknown[]) {
      if (pixel.callMethod) pixel.callMethod(...args);
      else pixel.queue.push(args);
    }, { queue: [] as unknown[][], loaded: true, version: "2.0" });
    pixel.push = pixel;
    window.fbq = pixel;
    window._fbq = pixel;
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);
  }
  // Only explicit events; do not let automatic matching inspect contact fields.
  window.fbq("set", "autoConfig", false, META_WEBSITE_PIXEL_ID);
  window.fbq("init", META_WEBSITE_PIXEL_ID);
  initialized = true;
}

export function trackMetaEvent(name: MetaWebsiteEvent, data: MetaEventData = {}) {
  if (!allowed()) return;
  try {
    initializePixel();
    if (!initialized) return;
    window.fbq?.("trackSingle", META_WEBSITE_PIXEL_ID, name, data, { eventID: crypto.randomUUID() });
  } catch { /* Analytics must never interrupt navigation or a successful inquiry. */ }
}

export function trackMetaPage() {
  if (!allowed()) return;
  const url = new URL(window.location.href);
  const key = url.pathname + url.search;
  if (pageKey === key) return;
  pageKey = key;
  pageEvents.clear();
  trackMetaEvent("PageView");
}

export function trackMetaPageEvent(name: "ViewContent" | "Search", data: MetaEventData) {
  if (!allowed()) return;
  trackMetaPage();
  const key = name + JSON.stringify(data);
  if (pageEvents.has(key)) return;
  pageEvents.add(key);
  trackMetaEvent(name, data);
}

export function isWhatsAppLink(href: string) {
  try {
    const url = new URL(href);
    return url.protocol === "https:" && ["wa.me", "api.whatsapp.com", "web.whatsapp.com"].includes(url.hostname);
  } catch { return false; }
}
