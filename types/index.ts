export type PropertyCategory =
  | "desarrollo"
  | "pozo"
  | "usados"
  | "rentals"
  | "inversiones"
  | "oportunidades";

export type PropertyStatus = "disponible" | "reservada" | "vendida";

export type AgentRole = "agent" | "admin";

export interface Property {
  id: string;
  title: string;
  description: string;
  category: PropertyCategory;
  price: number;
  currency?: string;
  location: string;
  address: string;
  bedrooms?: number;
  bathrooms?: number;
  area: number;
  images: string[];
  features: string[];
  agentId: string;
  status: PropertyStatus;
  featured?: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface PropertyImage {
  id: string;
  propertyId: string;
  url: string;
  storagePath?: string;
  displayOrder: number;
  isPrimary: boolean;
}

export interface Agent {
  id: string;
  name: string;
  email: string;
  password: string;
  phone?: string;
  photo?: string;
  role: AgentRole;
  active: boolean;
  createdAt: Date | string;
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
  description: string;
}[] = [
  {
    value: "desarrollo",
    label: "En Desarrollo",
    description: "Proyectos en construcción con entrega programada",
  },
  {
    value: "pozo",
    label: "En Pozo",
    description: "Proyectos en etapa inicial con financiación especial",
  },
  {
    value: "usados",
    label: "Usados",
    description: "Propiedades listas para escriturar",
  },
  {
    value: "rentals",
    label: "Alquileres",
    description: "Propiedades disponibles para renta",
  },
  {
    value: "inversiones",
    label: "Inversiones",
    description: "Oportunidades de inversión inmobiliaria",
  },
  {
    value: "oportunidades",
    label: "Oportunidades",
    description: "Propiedades con precios especiales",
  },
];
