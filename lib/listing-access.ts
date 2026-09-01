import { cache } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ListingVisibility } from "@/types";

export const getListingVisibilityFilter = cache(
  async (): Promise<ListingVisibility | undefined> => {
    const session = await getServerSession(authOptions);
    return session ? undefined : "public";
  }
);
