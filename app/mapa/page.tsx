import type { Metadata } from "next";
import { BuenosAiresMap } from "@/components/map/BuenosAiresMap";

export const metadata: Metadata = {
  title: "Mapa de Buenos Aires | Barrera Brokers",
  description:
    "Mapa interactivo de barrios de Buenos Aires para analizar zonas de inversión, demanda y oportunidades inmobiliarias.",
  openGraph: {
    title: "Mapa de Buenos Aires | Barrera Brokers",
    description:
      "Explorá las zonas con mayor demanda para invertir, vivir o generar renta temporaria en Buenos Aires.",
    type: "website",
    locale: "es_AR",
  },
};

export default function MapaPage() {
  return <BuenosAiresMap />;
}
