import { BuenosAires3DMap } from "@/components/map/ba-3d-map";
import { getDevelopments } from "@/lib/developments-db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MapaPage() {
  const developments = await getDevelopments();

  return <BuenosAires3DMap developments={developments} />;
}
