import { getDevelopments } from "@/lib/developments-db";
import { InteractiveDevelopmentsSection } from "./interactive-developments-section";

export async function DevelopmentsSection() {
  const developments = (await getDevelopments({ visibility: "public" })).filter(
    (development) => {
      const isFinished =
        development.status === "finalizado" || development.status === "entregado";
      return !isFinished || (development.availableUnits ?? 0) > 0;
    }
  );

  return <InteractiveDevelopmentsSection developments={developments} />;
}
