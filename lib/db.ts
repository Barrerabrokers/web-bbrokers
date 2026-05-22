import { Property, Agent } from "@/types";
import { getServerSupabase } from "@/lib/supabase";

// ============================================================
// PROPERTIES
// ============================================================

export async function getProperties(filter?: {
  category?: string;
  status?: string;
}): Promise<Property[]> {
  const supabase = getServerSupabase();
  
  let query = supabase
    .from("properties")
    .select(`
      *,
      property_images (
        url,
        display_order,
        is_primary
      )
    `)
    .order("created_at", { ascending: false });

  if (filter?.category) {
    query = query.eq("category", filter.category);
  }
  if (filter?.status) {
    query = query.eq("status", filter.status);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching properties:", error);
    return [];
  }

  return (data || []).map(mapPropertyFromDb);
}

export async function getPropertyById(id: string): Promise<Property | null> {
  const supabase = getServerSupabase();
  
  const { data, error } = await supabase
    .from("properties")
    .select(`
      *,
      property_images (
        url,
        display_order,
        is_primary
      )
    `)
    .eq("id", id)
    .single();

  if (error || !data) {
    return null;
  }

  return mapPropertyFromDb(data);
}

export async function createProperty(
  data: Omit<Property, "id" | "createdAt" | "updatedAt">
): Promise<Property | null> {
  const supabase = getServerSupabase();
  
  const { images, ...propertyData } = data as any;
  
  const { data: property, error } = await supabase
    .from("properties")
    .insert({
      title: propertyData.title,
      description: propertyData.description,
      category: propertyData.category,
      price: propertyData.price,
      location: propertyData.location,
      address: propertyData.address,
      bedrooms: propertyData.bedrooms || null,
      bathrooms: propertyData.bathrooms || null,
      area: propertyData.area,
      features: propertyData.features || [],
      agent_id: propertyData.agentId,
      status: propertyData.status || "disponible",
    })
    .select()
    .single();

  if (error || !property) {
    console.error("Error creating property:", error);
    return null;
  }

  // Insertar imágenes si existen
  if (images && images.length > 0) {
    const imagesData = images.map((url: string, index: number) => ({
      property_id: property.id,
      url,
      display_order: index,
      is_primary: index === 0,
    }));

    await supabase.from("property_images").insert(imagesData);
  }

  return getPropertyById(property.id);
}

export async function updateProperty(
  id: string,
  data: Partial<Property>
): Promise<Property | null> {
  const supabase = getServerSupabase();
  
  const updateData: any = {};
  if (data.title) updateData.title = data.title;
  if (data.description) updateData.description = data.description;
  if (data.category) updateData.category = data.category;
  if (data.price !== undefined) updateData.price = data.price;
  if (data.location) updateData.location = data.location;
  if (data.address) updateData.address = data.address;
  if (data.bedrooms !== undefined) updateData.bedrooms = data.bedrooms;
  if (data.bathrooms !== undefined) updateData.bathrooms = data.bathrooms;
  if (data.area !== undefined) updateData.area = data.area;
  if (data.features) updateData.features = data.features;
  if (data.status) updateData.status = data.status;

  const { error } = await supabase
    .from("properties")
    .update(updateData)
    .eq("id", id);

  if (error) {
    console.error("Error updating property:", error);
    return null;
  }

  return getPropertyById(id);
}

export async function deleteProperty(id: string): Promise<boolean> {
  const supabase = getServerSupabase();
  
  const { error } = await supabase.from("properties").delete().eq("id", id);
  return !error;
}

// ============================================================
// AGENTS
// ============================================================

export async function getAgentByEmail(email: string): Promise<Agent | null> {
  const supabase = getServerSupabase();
  
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("email", email)
    .eq("active", true)
    .single();

  if (error || !data) return null;
  return mapAgentFromDb(data);
}

export async function getAgentById(id: string): Promise<Agent | null> {
  const supabase = getServerSupabase();
  
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return mapAgentFromDb(data);
}

export async function createAgent(data: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role?: "agent" | "admin";
}): Promise<{ agent: Agent | null; error: string | null }> {
  const supabase = getServerSupabase();
  
  const { data: agent, error } = await supabase
    .from("agents")
    .insert({
      name: data.name,
      email: data.email,
      password: data.password,
      phone: data.phone || null,
      role: data.role || "agent",
      active: true,
    })
    .select()
    .single();

  if (error || !agent) {
    console.error("Error creating agent:", error);
    return { agent: null, error: error?.message || "Unknown error" };
  }

  return { agent: mapAgentFromDb(agent), error: null };
}

export async function getAllAgents(): Promise<Agent[]> {
  const supabase = getServerSupabase();
  
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map(mapAgentFromDb);
}

// ============================================================
// CONTACTS
// ============================================================

export async function createContact(data: {
  name: string;
  email: string;
  phone?: string;
  message: string;
  propertyId?: string;
}) {
  const supabase = getServerSupabase();
  
  const { data: contact, error } = await supabase
    .from("contacts")
    .insert({
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      message: data.message,
      property_id: data.propertyId || null,
    })
    .select()
    .single();

  if (error) return null;
  return contact;
}

export async function getAllContacts() {
  const supabase = getServerSupabase();
  
  const { data, error } = await supabase
    .from("contacts")
    .select(`
      *,
      properties (
        id,
        title
      )
    `)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data;
}

// ============================================================
// HELPERS - Mappers
// ============================================================

function mapPropertyFromDb(data: any): Property {
  const images = (data.property_images || [])
    .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0))
    .map((img: any) => img.url);

  return {
    id: data.id,
    title: data.title,
    description: data.description,
    category: data.category,
    price: parseFloat(data.price),
    currency: data.currency,
    location: data.location,
    address: data.address,
    bedrooms: data.bedrooms,
    bathrooms: data.bathrooms,
    area: parseFloat(data.area),
    images: images.length > 0 ? images : ["https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800"],
    features: data.features || [],
    agentId: data.agent_id,
    status: data.status,
    featured: data.featured,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

function mapAgentFromDb(data: any): Agent {
  return {
    id: data.id,
    name: data.name,
    email: data.email,
    password: data.password,
    phone: data.phone,
    photo: data.photo,
    role: data.role,
    active: data.active,
    createdAt: data.created_at,
  };
}
