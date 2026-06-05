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
  { id: "puerto-madero", name: "Puerto Madero", x: 74, y: 56, price: "USD 4.500 - 6.500", demand: "Premium", profile: "Inversión premium · renta ejecutiva · compradores internacionales", accent: "#ff6b4a", description: "La zona más premium de Buenos Aires, con fuerte presencia corporativa, turística y residencial de alto poder adquisitivo." },
  { id: "recoleta", name: "Recoleta", x: 55, y: 35, price: "USD 2.500 - 3.800", demand: "Alta", profile: "Renta temporaria · vivienda · inversión patrimonial", accent: "#f1b36d", description: "Barrio clásico y elegante, muy buscado por extranjeros, estudiantes, profesionales y compradores patrimoniales." },
  { id: "palermo", name: "Palermo", x: 39, y: 24, price: "USD 2.700 - 3.500", demand: "Alta", profile: "Inversión · estudiantes · turismo · renta temporaria", accent: "#ff6b4a", description: "Uno de los barrios con mayor demanda residencial, turística y estudiantil de Buenos Aires." },
  { id: "belgrano", name: "Belgrano", x: 25, y: 17, price: "USD 2.600 - 3.600", demand: "Alta", profile: "Vivienda · renta familiar · inversión patrimonial", accent: "#e8c79a", description: "Zona residencial consolidada, con excelente conectividad, servicios y demanda sostenida." },
  { id: "nunez", name: "Núñez", x: 16, y: 11, price: "USD 2.700 - 3.800", demand: "En crecimiento", profile: "Inversión · vivienda joven · renta premium", accent: "#c08a5a", description: "Barrio en crecimiento, cercano al río y con fuerte desarrollo inmobiliario en los últimos años." },
  { id: "retiro", name: "Retiro", x: 62, y: 43, price: "USD 2.200 - 3.400", demand: "Alta", profile: "Corporativo · turismo · renta temporaria", accent: "#f1b36d", description: "Ubicación estratégica junto a Plaza San Martín, hoteles, oficinas y conexión metropolitana." },
  { id: "san-telmo", name: "San Telmo", x: 63, y: 70, price: "USD 1.900 - 2.700", demand: "Alta", profile: "Turismo · renta temporaria · compradores extranjeros", accent: "#ff6b4a", description: "Histórico, turístico y con gran atractivo para alquiler temporario y experiencias urbanas." },
  { id: "montserrat", name: "Montserrat", x: 59, y: 61, price: "USD 1.800 - 2.500", demand: "En crecimiento", profile: "Estudiantes · turismo · profesionales · renta temporaria", accent: "#c08a5a", description: "Zona estratégica por su cercanía al Congreso, universidades, UADE, Fundación Favaloro y Microcentro." },
  { id: "microcentro", name: "Microcentro", x: 67, y: 53, price: "USD 1.700 - 2.400", demand: "Media", profile: "Turismo · oficinas reconvertidas · renta temporal", accent: "#e8c79a", description: "Centro financiero y turístico con oportunidades de reconversión y cercanía a puntos icónicos." },
  { id: "caballito", name: "Caballito", x: 38, y: 59, price: "USD 2.000 - 2.900", demand: "Alta", profile: "Vivienda · renta tradicional · familias", accent: "#f1b36d", description: "Centro geográfico de la ciudad, con demanda residencial estable y buena conectividad." },
  { id: "villa-crespo", name: "Villa Crespo", x: 36, y: 40, price: "USD 2.100 - 3.000", demand: "En crecimiento", profile: "Inversión · jóvenes profesionales · renta temporaria", accent: "#ff6b4a", description: "Alternativa cercana a Palermo con precios más competitivos y fuerte crecimiento comercial." },
  { id: "colegiales", name: "Colegiales", x: 30, y: 26, price: "USD 2.500 - 3.400", demand: "Alta", profile: "Vivienda premium · renta residencial · inversión", accent: "#e8c79a", description: "Barrio tranquilo, conectado y muy buscado por perfiles residenciales de alto valor." },
  { id: "barrio-norte", name: "Barrio Norte", x: 50, y: 40, price: "USD 2.400 - 3.500", demand: "Alta", profile: "Estudiantes · profesionales · salud · renta temporaria", accent: "#c08a5a", description: "Zona de universidades, sanatorios, comercios y excelente movilidad urbana." },
  { id: "las-canitas", name: "Las Cañitas", x: 35, y: 20, price: "USD 2.800 - 3.900", demand: "Premium", profile: "Renta premium · gastronomía · vivienda joven", accent: "#ff6b4a", description: "Microzona premium, gastronómica y residencial, con alta demanda de alquiler." },
  { id: "chacarita", name: "Chacarita", x: 29, y: 36, price: "USD 2.000 - 2.900", demand: "En crecimiento", profile: "Desarrollos · jóvenes profesionales · renta", accent: "#f1b36d", description: "Zona emergente con buena conectividad y potencial de valorización." }
];
