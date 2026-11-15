import { canManageListings } from "@/lib/roles";
import type { ListingVisibility } from "@/types";

export function listingVisibilityForRole(role?: string | null, requested?: string | null): ListingVisibility | undefined {
  if (!canManageListings(role)) return "public";
  return requested === "public" || requested === "agents" ? requested : undefined;
}

export function canReadListing(visibility: string | undefined, role?: string | null, sharedAccess = false) {
  return visibility !== "agents" || canManageListings(role) || sharedAccess;
}
