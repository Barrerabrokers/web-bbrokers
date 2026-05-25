import { getDevelopments } from "@/lib/developments-db";
import { DevelopmentsSectionView } from "./developments-section-view";

export async function DevelopmentsSection() {
  const all = await getDevelopments();

  // Pick highlighted one (or first) and up to 3 others
  const highlighted = all.find((d) => d.highlight) || all[0];
  const others = all
    .filter((d) => !highlighted || d.id !== highlighted.id)
    .slice(0, 3);

  return (
    <DevelopmentsSectionView highlighted={highlighted} others={others} />
  );
}
