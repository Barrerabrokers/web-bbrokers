import type { Metadata } from "next";
import { getDevelopments } from "@/lib/developments-db";
import { DevelopmentsOnlyMap } from "@/components/map/DevelopmentsOnlyMap";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Mapa de desarrollos | Barrera Brokers",
  description:
    "Mapa interactivo con los desarrollos reales cargados en Barrera Brokers.",
  openGraph: {
    title: "Mapa de desarrollos | Barrera Brokers",
    description:
      "Visualizá los emprendimientos cargados en la base de datos de Barrera Brokers.",
    type: "website",
    locale: "es_AR",
  },
};

export default async function MapaPage() {
  const developments = await getDevelopments();

  return <DevelopmentsOnlyMap developments={developments} />;
}
