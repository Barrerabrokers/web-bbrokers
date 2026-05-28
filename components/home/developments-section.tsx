import { getDevelopments } from "@/lib/developments-db";
import { InteractiveDevelopmentsSection } from "./interactive-developments-section";

export async function DevelopmentsSection() {
  let developments: Awaited<ReturnType<typeof getDevelopments>> = [];
  try {
    developments = await getDevelopments();
  } catch {
    // DB no disponible — renderizamos la sección vacía sin crashear la página
  }

  return <InteractiveDevelopmentsSection developments={developments} />;
}
