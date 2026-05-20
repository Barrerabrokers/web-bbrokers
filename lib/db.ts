import { Property, Agent } from "@/types";

// Mock database - En producción usar Prisma, MongoDB, PostgreSQL, etc.
// Esta es una implementación simple con datos en memoria

let properties: Property[] = [
  {
    id: "1",
    title: "Departamento moderno en Palermo",
    description: "Hermoso departamento de 2 ambientes con balcón y excelente ubicación en el corazón de Palermo.",
    category: "usados",
    price: 180000,
    location: "Palermo, CABA",
    address: "Av. Santa Fe 3500",
    bedrooms: 1,
    bathrooms: 1,
    area: 45,
    images: ["https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800"],
    features: ["Balcón", "Cocina equipada", "Seguridad 24hs", "Gimnasio"],
    agentId: "1",
    status: "disponible",
    createdAt: new Date("2024-01-15"),
    updatedAt: new Date("2024-01-15"),
  },
  {
    id: "2",
    title: "Casa en desarrollo - Nordelta",
    description: "Proyecto de casas modernas en barrio privado con amenities de primer nivel.",
    category: "desarrollo",
    price: 350000,
    location: "Nordelta, Buenos Aires",
    address: "Barrio Los Sauces",
    bedrooms: 3,
    bathrooms: 2,
    area: 150,
    images: ["https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800"],
    features: ["Pileta", "Quincho", "Jardín", "Cochera doble"],
    agentId: "1",
    status: "disponible",
    createdAt: new Date("2024-02-01"),
    updatedAt: new Date("2024-02-01"),
  },
  {
    id: "3",
    title: "Inversión - Local comercial",
    description: "Excelente local comercial sobre avenida principal, ideal para inversión.",
    category: "inversiones",
    price: 250000,
    location: "Caballito, CABA",
    address: "Av. Rivadavia 5500",
    area: 80,
    images: ["https://images.unsplash.com/photo-1497366216548-37526070297c?w=800"],
    features: ["Sobre avenida", "Vidriera", "Baño", "Depósito"],
    agentId: "1",
    status: "disponible",
    createdAt: new Date("2024-02-10"),
    updatedAt: new Date("2024-02-10"),
  },
];

let agents: Agent[] = [
  {
    id: "1",
    name: "Admin Barrera",
    email: "admin@barrerabrokers.com",
    password: "$2a$10$YourHashedPasswordHere", // En producción: bcrypt.hash
    phone: "+54 11 1234-5678",
    role: "admin",
    createdAt: new Date("2024-01-01"),
  },
];

// Funciones para propiedades
export async function getProperties(filter?: { category?: string; status?: string }) {
  let filtered = [...properties];
  
  if (filter?.category) {
    filtered = filtered.filter(p => p.category === filter.category);
  }
  
  if (filter?.status) {
    filtered = filtered.filter(p => p.status === filter.status);
  }
  
  return filtered;
}

export async function getPropertyById(id: string) {
  return properties.find(p => p.id === id);
}

export async function createProperty(data: Omit<Property, "id" | "createdAt" | "updatedAt">) {
  const newProperty: Property = {
    ...data,
    id: Date.now().toString(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  properties.push(newProperty);
  return newProperty;
}

export async function updateProperty(id: string, data: Partial<Property>) {
  const index = properties.findIndex(p => p.id === id);
  
  if (index === -1) return null;
  
  properties[index] = {
    ...properties[index],
    ...data,
    updatedAt: new Date(),
  };
  
  return properties[index];
}

export async function deleteProperty(id: string) {
  const index = properties.findIndex(p => p.id === id);
  
  if (index === -1) return false;
  
  properties.splice(index, 1);
  return true;
}

// Funciones para agentes
export async function getAgentByEmail(email: string) {
  return agents.find(a => a.email === email);
}

export async function getAgentById(id: string) {
  return agents.find(a => a.id === id);
}

export async function createAgent(data: Omit<Agent, "id" | "createdAt">) {
  const newAgent: Agent = {
    ...data,
    id: Date.now().toString(),
    createdAt: new Date(),
  };
  
  agents.push(newAgent);
  return newAgent;
}
