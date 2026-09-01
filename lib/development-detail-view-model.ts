import { DEVELOPMENT_STATUS_LABELS, type Development, type Unit } from "@/types";

export type DevelopmentDetailStat = {
  label: string;
  value: string;
  supporting?: string;
};

export type DevelopmentDetailDocument = {
  label: string;
  href: string;
  private?: boolean;
};

export type DevelopmentDetailModel = {
  development: Development;
  statusLabel: string;
  primaryImage?: string;
  coverVideo?: string;
  galleryVideoUrls: string[];
  priceFrom?: number;
  units: Unit[];
  availableUnits: Unit[];
  descriptionParagraphs: string[];
  typologies: string[];
  minArea?: number;
  maxArea?: number;
  highlights: string[];
  summaryStats: DevelopmentDetailStat[];
  locationLabel: string;
  fullAddress: string;
  mapEmbedUrl: string;
  mapExternalUrl: string;
  brochureHref?: string;
  priceListHref?: string;
};

function splitDescription(description: string) {
  return description
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function getAreaRange(units: Unit[]) {
  const totalAreas = units
    .map((unit) => unit.totalArea || unit.area)
    .filter((area): area is number => typeof area === "number" && area > 0);

  if (!totalAreas.length) return {};

  return {
    minArea: Math.min(...totalAreas),
    maxArea: Math.max(...totalAreas),
  };
}

function getTypologies(units: Unit[]) {
  return Array.from(
    new Set(
      units.map((unit) =>
        unit.bedrooms === 0
          ? "Monoambientes"
          : `${unit.bedrooms} ambiente${unit.bedrooms > 1 ? "s" : ""}`
      )
    )
  );
}

function safeStringList(values: unknown): string[] {
  return Array.isArray(values)
    ? values.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];
}

function safeDevelopmentImages(development: Development) {
  return Array.isArray(development.images)
    ? development.images.filter((image) => typeof image?.url === "string" && image.url.trim().length > 0)
    : [];
}

function safeUnits(development: Development): Unit[] {
  return Array.isArray(development.units)
    ? development.units.map((unit) => ({
        ...unit,
        bedrooms: Number.isFinite(unit.bedrooms) ? unit.bedrooms : 0,
        bathrooms: Number.isFinite(unit.bathrooms) ? unit.bathrooms : 0,
        area: Number.isFinite(unit.area) ? unit.area : 0,
        price: Number.isFinite(unit.price) ? unit.price : 0,
        features: safeStringList(unit.features),
        images: Array.isArray(unit.images)
          ? unit.images.filter((image) => typeof image?.url === "string" && image.url.trim().length > 0)
          : [],
      }))
    : [];
}

export function buildDevelopmentDetailModel({
  development,
  coverVideo,
  sessionCanSeePrices,
}: {
  development: Development;
  coverVideo?: string;
  sessionCanSeePrices: boolean;
}): DevelopmentDetailModel {
  const images = safeDevelopmentImages(development);
  const features = safeStringList(development.features);
  const amenities = safeStringList(development.amenities);
  const primaryImage =
    images.find((image) => image.isPrimary)?.url ||
    images[0]?.url;
  const videoUrls = Array.from(
    new Set([
      ...safeStringList(development.videoUrls),
      ...(development.videoUrl ? [development.videoUrl] : []),
    ])
  );
  const galleryVideoUrls = coverVideo
    ? videoUrls.filter((url) => url !== coverVideo)
    : videoUrls;
  const units = safeUnits(development);
  const availableUnits = units.filter((unit) => unit.status === "disponible");
  const { minArea, maxArea } = getAreaRange(units);
  const typologies = getTypologies(units);
  const statusLabel = DEVELOPMENT_STATUS_LABELS[development.status];
  const fullAddress = `${development.address}, ${development.location}, Ciudad de Buenos Aires, Argentina`;
  const encodedAddress = encodeURIComponent(fullAddress);
  const unitCount = development.unitsCount || development.totalUnits || units.length;
  const availableCount = development.availableUnits ?? availableUnits.length;

  const summaryStats: DevelopmentDetailStat[] = [
    {
      label: "Entrega",
      value: development.completionDate || "A confirmar",
    },
    {
      label: "Unidades",
      value: unitCount ? String(unitCount) : "Consultar",
      supporting: availableCount ? `${availableCount} disponibles` : undefined,
    },
    {
      label: "Tipologías",
      value: typologies.length ? typologies.join(" · ") : "Consultar",
    },
    {
      label: "Avance",
      value: `${development.progress}%`,
      supporting: statusLabel,
    },
  ];

  if (minArea || maxArea) {
    summaryStats.push({
      label: "Superficies",
      value:
        minArea === maxArea
          ? `${minArea} m²`
          : `${minArea || "-"} a ${maxArea || "-"} m²`,
    });
  }

  if (development.priceFrom || development.minPriceAvailable) {
    summaryStats.push({
      label: "Precio desde",
      value: "Disponible",
      supporting: "Ver propuesta comercial",
    });
  }

  return {
    development,
    statusLabel,
    primaryImage,
    coverVideo,
    galleryVideoUrls,
    priceFrom: development.minPriceAvailable ?? development.priceFrom,
    units,
    availableUnits,
    descriptionParagraphs: splitDescription(development.description || ""),
    typologies,
    minArea,
    maxArea,
    highlights: [...features, ...amenities].slice(0, 10),
    summaryStats,
    locationLabel: `${development.address} · ${development.location}`,
    fullAddress,
    mapEmbedUrl: `https://maps.google.com/maps?q=${encodedAddress}&output=embed`,
    mapExternalUrl: `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`,
    brochureHref: development.brochureUrl
      ? `/desarrollos/${development.slug}/brochure`
      : undefined,
    priceListHref:
      sessionCanSeePrices && development.priceListUrl
        ? `/api/developments/${development.id}/price-list`
        : undefined,
  };
}
