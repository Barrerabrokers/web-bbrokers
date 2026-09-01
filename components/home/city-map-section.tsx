import {
  BuenosAiresDevelopments,
  CityDevelopment,
} from "@/components/city/buenos-aires-developments";
import { getDevelopments } from "@/lib/developments-db";
import { getListingVisibilityFilter } from "@/lib/listing-access";
import { getDevelopmentVideo } from "@/lib/development-media";

export async function CityMapSection() {
  const visibility = await getListingVisibilityFilter();
  const developments = await getDevelopments({ visibility });
  const cityDevelopments: CityDevelopment[] = developments.map((dev) => ({
    id: dev.id,
    name: dev.name,
    slug: dev.slug,
    description: dev.description,
    shortDescription: dev.shortDescription,
    location: dev.location,
    address: dev.address,
    status: dev.status,
    progress: dev.progress,
    completionDate: dev.completionDate,
    priceFrom: dev.priceFrom,
    minPriceAvailable: dev.minPriceAvailable,
    availableUnits: dev.availableUnits,
    unitsCount: dev.unitsCount,
    amenities: dev.amenities || [],
    features: dev.features || [],
    image:
      dev.images.find((image) => image.isPrimary)?.url ||
      dev.images[0]?.url,
    video: getDevelopmentVideo(dev.name, dev.videoUrl, dev.videoIsPrimary),
  }));

  return <BuenosAiresDevelopments developments={cityDevelopments} embedded />;
}
