export type MapNeighborhood = {
  id: string;
  name: string;
  x: number;
  y: number;
  price: string;
  demand: "Alta" | "Media" | "Premium" | "En crecimiento";
  profile: string;
  description: string;
  accent: string;
};

export const mapNeighborhoods: MapNeighborhood[] = [
  { id: "puerto-madero", name: "Puerto Madero", x: 74, y: 70, price: "USD 4.500 - 6.500", demand: "Premium", profile: "Inversión premium · renta ejecutiva · compradores internacionales", accent: "#ff6b4a", description: "La zona más premium de Buenos Aires, con fuerte presencia corporativa, turística y residencial de alto poder adquisitivo." },
  { id: "san-telmo", name: "San Telmo", x: 65, y: 76, price: "USD 1.900 - 2.700", demand: "Alta", profile: "Turismo · renta temporaria · compradores extranjeros", accent: "#f1b36d", description: "Histórico, turístico y con gran atractivo para alquiler temporario y experiencias urbanas." },
  { id: "centro", name: "Centro", x: 63, y: 60, price: "USD 1.700 - 2.500", demand: "Media", profile: "Turismo · oficinas reconvertidas · renta temporal", accent: "#e8c79a", description: "Área central con cercanía a teatros, oficinas, universidades, transporte y puntos icónicos de la ciudad." },
  { id: "recoleta", name: "Recoleta", x: 54, y: 47, price: "USD 2.500 - 3.800", demand: "Alta", profile: "Renta temporaria · vivienda · inversión patrimonial", accent: "#c08a5a", description: "Barrio clásico y elegante, muy buscado por extranjeros, estudiantes, profesionales y compradores patrimoniales." },
  { id: "palermo", name: "Palermo", x: 42, y: 35, price: "USD 2.700 - 3.500", demand: "Alta", profile: "Inversión · estudiantes · turismo · renta temporaria", accent: "#ff6b4a", description: "Uno de los barrios con mayor demanda residencial, turística y estudiantil de Buenos Aires." },
  { id: "belgrano", name: "Belgrano", x: 28, y: 24, price: "USD 2.600 - 3.600", demand: "Alta", profile: "Vivienda · renta familiar · inversión patrimonial", accent: "#f1b36d", description: "Zona residencial consolidada, con excelente conectividad, servicios y demanda sostenida." },
  { id: "nunez", name: "Núñez", x: 17, y: 15, price: "USD 2.700 - 3.800", demand: "En crecimiento", profile: "Inversión · vivienda joven · renta premium", accent: "#e8c79a", description: "Barrio en crecimiento, cercano al río y con fuerte desarrollo inmobiliario en los últimos años." }
];
