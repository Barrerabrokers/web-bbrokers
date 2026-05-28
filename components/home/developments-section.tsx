import { getDevelopments } from "@/lib/developments-db";
import { InteractiveDevelopmentsSection } from "./interactive-developments-section";

export async function DevelopmentsSection() {
  const developments = await getDevelopments();

  return <InteractiveDevelopmentsSection developments={developments} />;
}
