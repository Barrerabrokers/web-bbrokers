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
  expenses?: number;
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

// ====================================================================
// DEVELOPMENTS & UNITS
// ====================================================================

export type DevelopmentStatus =
  | "pre_venta"
  | "en_construccion"
  | "finalizado"
  | "entregado";

export type UnitStatus = "disponible" | "reservada" | "vendida";

export type DevelopmentImageType =
  | "fachada"
  | "espacios_comunes"
  | "render"
  | "amenities"
  | "otro";

export type UnitImageType = "foto" | "plano" | "render" | "otro";

export interface DevelopmentImage {
  id?: string;
  url: string;
  type?: DevelopmentImageType;
  caption?: string;
  displayOrder?: number;
  isPrimary?: boolean;
}

export interface UnitImage {
  id?: string;
  url: string;
  type?: UnitImageType;
  displayOrder?: number;
  isPrimary?: boolean;
}

export interface Unit {
  id: string;
  developmentId: string;
  unitNumber: string;
  floor?: string;
  bedrooms: number;
  bathrooms: number;
  area: number;
  balconyArea?: number;
  totalArea?: number;
  price: number;
  currency?: string;
  expenses?: number;
  orientation?: string;
  status: UnitStatus;
  description?: string;
  features: string[];
  images: UnitImage[];
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface Development {
  id: string;
  name: string;
  slug: string;
  shortDescription?: string;
  description: string;
  location: string;
  address: string;
  status: DevelopmentStatus;
  totalUnits?: number;
  completionDate?: string;
  progress: number;
  priceFrom?: number;
  currency?: string;
  amenities: string[];
  features: string[];
  highlight?: boolean;
  agentId?: string;
  brochureUrl?: string;
  images: DevelopmentImage[];
  units?: Unit[];
  // Stats from view
  availableUnits?: number;
  unitsCount?: number;
  minPriceAvailable?: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export const DEVELOPMENT_STATUS_LABELS: Record<DevelopmentStatus, string> = {
  pre_venta: "Pre-venta",
  en_construccion: "En construcción",
  finalizado: "Finalizado",
  entregado: "Entregado",
};

export const DEVELOPMENT_IMAGE_TYPES: {
  value: DevelopmentImageType;
  label: string;
}[] = [
  { value: "fachada", label: "Fachada" },
  { value: "espacios_comunes", label: "Espacios comunes" },
  { value: "amenities", label: "Amenities" },
  { value: "render", label: "Render" },
  { value: "otro", label: "Otro" },
];

export const UNIT_IMAGE_TYPES: { value: UnitImageType; label: string }[] = [
  { value: "foto", label: "Foto" },
  { value: "plano", label: "Plano" },
  { value: "render", label: "Render" },
  { value: "otro", label: "Otro" },
];

export const COMMON_AMENITIES = [
  "Pileta",
  "Gimnasio",
  "SUM",
  "Laundry",
  "Solarium",
  "Parrilla",
  "Sala de juegos",
  "Coworking",
  "Seguridad 24hs",
  "Bauleras",
  "Cocheras",
  "Roof top",
  "Spa",
  "Jardín",
];

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
