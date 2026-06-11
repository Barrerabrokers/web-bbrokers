export const SITE_URL = "https://barrerabrokers.com";

export const SITE_NAME = "Barrera Brokers";

export const DEFAULT_SEO_TITLE =
  "Barrera Brokers | Comprar departamentos e invertir en Buenos Aires";

export const DEFAULT_SEO_DESCRIPTION =
  "Barrera Brokers comercializa departamentos, desarrollos en pozo e inversiones inmobiliarias en Recoleta, Palermo, Belgrano, Nunez y las mejores zonas de Buenos Aires.";

export const SEO_KEYWORDS = [
  "comprar departamento",
  "comprar departamento en Buenos Aires",
  "inversion inmobiliaria",
  "inversion en pozo",
  "departamentos en Recoleta",
  "departamentos en Palermo",
  "departamentos en Belgrano",
  "departamentos en Nunez",
  "desarrollos inmobiliarios Buenos Aires",
  "Barrera Brokers",
];

export const TARGET_NEIGHBORHOODS = [
  "Recoleta",
  "Palermo",
  "Belgrano",
  "Nunez",
  "Puerto Madero",
];

export function absoluteUrl(path = "/") {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

export function truncateDescription(text?: string | null, maxLength = 155) {
  if (!text) return DEFAULT_SEO_DESCRIPTION;
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1).trim()}…`;
}

