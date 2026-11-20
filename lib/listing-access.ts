import { getDevelopments } from "./developments-db";
import { developmentForPriceViewer } from "./development-price-visibility";
import { listingVisibilityForRole } from "@/lib/listing-visibility-policy";
import { cache } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ListingVisibility } from "@/types";

const getListingSession = cache(() => getServerSession(authOptions));

export const getListingVisibilityFilter = cache(
  async (): Promise<ListingVisibility | undefined> => {
    const session = await getListingSession();
    return listingVisibilityForRole(session?.user.role);
  }
);


export async function getDevelopmentsForViewer(filter?: Parameters<typeof getDevelopments>[0]) {
  const [developments, session] = await Promise.all([getDevelopments(filter), getListingSession()]);
  return developments.map(development => developmentForPriceViewer(development, session?.user.role));
}
