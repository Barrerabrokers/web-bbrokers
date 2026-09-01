export const SITE_URL = "https://barrerabrokers.com";

export const SITE_NAME = "Barrera Brokers";

export const DEFAULT_SEO_TITLE =
  "Barrera Brokers | Inversiones en Real Estate en Buenos Aires";

export const DEFAULT_SEO_DESCRIPTION =
  "Barrera Brokers asesora inversiones en real estate, desarrollos en pozo y departamentos para invertir en Recoleta, Palermo, Belgrano, Nuñez, Puerto Madero y Buenos Aires.";

export const SEO_KEYWORDS = [
  "inversiones en real estate",
  "real estate Buenos Aires",
  "inversion real estate Buenos Aires",
  "comprar departamento",
  "comprar departamento en Buenos Aires",
  "inversion inmobiliaria",
  "inversión inmobiliaria",
  "inversion en pozo",
  "inversión en pozo",
  "departamentos para invertir",
  "invertir en departamentos",
  "invertir en Buenos Aires",
  "desarrollos en pozo Buenos Aires",
  "departamentos en Recoleta",
  "departamentos en Palermo",
  "departamentos en Belgrano",
  "departamentos en Nunez",
  "departamentos en Nuñez",
  "departamentos en Puerto Madero",
  "desarrollos inmobiliarios Buenos Aires",
  "Barrera Brokers real estate",
  "Barrera Brokers",
];

export const TARGET_NEIGHBORHOODS = [
  "Recoleta",
  "Palermo",
  "Belgrano",
  "Nuñez",
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
