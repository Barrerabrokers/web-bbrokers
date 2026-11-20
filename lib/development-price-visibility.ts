import type { Development, Unit } from "@/types";
import { canManageListings } from "./roles";

export function hasAgentOnlyPrices(slug?: string) {
  return slug === "alpha-place-belgrano" || slug === "alpha-place-libertador";
}

export function canSeeDevelopmentPrices(slug: string, role?: string | null) {
  return !hasAgentOnlyPrices(slug) || canManageListings(role);
}

export function unitForPriceViewer(unit: Unit, slug: string, role?: string | null): Unit {
  return canSeeDevelopmentPrices(slug, role) ? unit : { ...unit, price: 0 };
}

/** Redact before rendering or serializing, including props for client components. */
export function developmentForPriceViewer(development: Development, role?: string | null): Development {
  if (canSeeDevelopmentPrices(development.slug, role)) return development;
  const { priceFrom, minPriceAvailable, priceListUrl, ...publicDevelopment } = development;
  return {
    ...publicDevelopment,
    units: development.units?.map(unit => unitForPriceViewer(unit, development.slug, role)),
  };
}
