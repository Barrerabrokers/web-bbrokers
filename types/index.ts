export type PropertyCategory = 
  | "desarrollo" 
  | "pozo" 
  | "usados" 
  | "rentals" 
  | "inversiones" 
  | "oportunidades";

export interface Property {
  id: string;
  title: string;
  description: string;
  category: PropertyCategory;
  price: number;
  location: string;
  address: string;
  bedrooms?: number;
  bathrooms?: number;
  area: number; // en m²
  images: string[];
  features: string[];
  agentId: string;
  status: "disponible" | "reservada" | "vendida";
  createdAt: Date;
  updatedAt: Date;
}

export interface Agent {
  id: string;
  name: string;
  email: string;
  password: string;
  phone?: string;
  photo?: string;
  role: "admin" | "agent";
  createdAt: Date;
}

export interface ContactForm {
  name: string;
  email: string;
  phone: string;
  message: string;
  propertyId?: string;
}

export const PROPERTY_CATEGORIES: { 
  value: PropertyCategory; 
  label: string; 
  description: string 
}[] = [
  {
    value: "desarrollo",
    label: "En Desarrollo",
    description: "Proyectos en construcción con entrega programada"
  },
  {
    value: "pozo",
    label: "En Pozo",
    description: "Proyectos en etapa inicial con financiación especial"
  },
  {
    value: "usados",
    label: "Usados",
    description: "Propiedades listas para escriturar"
  },
  {
    value: "rentals",
    label: "Alquileres",
    description: "Propiedades disponibles para renta"
  },
  {
    value: "inversiones",
    label: "Inversiones",
    description: "Oportunidades de inversión inmobiliaria"
  },
  {
    value: "oportunidades",
    label: "Oportunidades",
    description: "Propiedades con precios especiales"
  }
];
