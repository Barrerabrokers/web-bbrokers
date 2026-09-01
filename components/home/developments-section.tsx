import { getDevelopments } from "@/lib/developments-db";
import { getListingVisibilityFilter } from "@/lib/listing-access";
import { InteractiveDevelopmentsSection } from "./interactive-developments-section";

export async function DevelopmentsSection() {
  const visibility = await getListingVisibilityFilter();
  const developments = (await getDevelopments({ visibility })).filter(
    (development) => {
      const isFinished =
        development.status === "finalizado" || development.status === "entregado";
      return !isFinished || (development.availableUnits ?? 0) > 0;
    }
  );

  return <InteractiveDevelopmentsSection developments={developments} />;
}
