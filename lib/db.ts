import { Property, Agent } from "@/types";
import { getServerSupabase } from "@/lib/supabase";
import postgres from "postgres";

// Helper: get raw postgres connection
function getPgConnection() {
  const databaseUrl =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.SUPABASE_DB_URL;

  if (!databaseUrl) {
    throw new Error("No database connection URL found");
  }

  return postgres(databaseUrl, {
    ssl: "require",
    max: 1,
    prepare: false,
  });
}

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

// CREAR PROPIEDAD: Usar postgres directamente para evitar el schema cache de Supabase
export async function createProperty(
  data: any
): Promise<{ property: Property | null; error: string | null }> {
  const { images, ...propertyData } = data;

  let sql;
  try {
    sql = getPgConnection();

    let agentId: string | null = null;
    if (
      propertyData.agentId &&
      typeof propertyData.agentId === "string" &&
      propertyData.agentId.length > 10
    ) {
      agentId = propertyData.agentId;
    }

    // INSERT directo con SQL puro (no afectado por schema cache)
    const result = await sql`
      INSERT INTO properties (
        title,
        description,
        category,
        price,
        expenses,
        location,
        address,
        area,
        bedrooms,
        bathrooms,
        features,
        agent_id,
        status
      ) VALUES (
        ${propertyData.title},
        ${propertyData.description},
        ${propertyData.category},
        ${propertyData.price},
        ${propertyData.expenses || null},
        ${propertyData.location},
        ${propertyData.address},
        ${propertyData.area},
        ${propertyData.bedrooms || null},
        ${propertyData.bathrooms || null},
        ${propertyData.features || []},
        ${agentId},
        ${propertyData.status || "disponible"}
      )
      RETURNING id, title, status, created_at
    `;

    if (!result || result.length === 0) {
      await sql.end();
      return { property: null, error: "No se pudo insertar la propiedad" };
    }

    const propertyId = result[0].id;

    if (images && images.length > 0) {
      for (let i = 0; i < images.length; i++) {
        const url = images[i];
        try {
          await sql`
            INSERT INTO property_images (
              property_id,
              url,
              display_order,
              is_primary
            ) VALUES (
              ${propertyId},
              ${url},
              ${i},
              ${i === 0}
            )
          `;
        } catch (imgErr: any) {
          console.error("Error inserting image:", imgErr);
        }
      }
    }

    await sql.end();

    const fullProperty = await getPropertyById(propertyId);
    return { property: fullProperty, error: null };
  } catch (error: any) {
    if (sql) {
      try {
        await sql.end();
      } catch {}
    }
    console.error("Error creating property:", error);
    return {
      property: null,
      error: error.message || "Unknown error",
    };
  }
}

export async function updateProperty(
  id: string,
  data: Partial<Property> & { images?: string[] }
): Promise<{ property: Property | null; error: string | null }> {
  const { images, ...updateFields } = data as any;

  let sql;
  try {
    sql = getPgConnection();

    // Construir UPDATE dinamico
    const updates: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    if (updateFields.title !== undefined) {
      updates.push(`title = $${paramIdx++}`);
      values.push(updateFields.title);
    }
    if (updateFields.description !== undefined) {
      updates.push(`description = $${paramIdx++}`);
      values.push(updateFields.description);
    }
    if (updateFields.category !== undefined) {
      updates.push(`category = $${paramIdx++}`);
      values.push(updateFields.category);
    }
    if (updateFields.price !== undefined) {
      updates.push(`price = $${paramIdx++}`);
      values.push(updateFields.price);
    }
    if (updateFields.expenses !== undefined) {
      updates.push(`expenses = $${paramIdx++}`);
      values.push(updateFields.expenses);
    }
    if (updateFields.location !== undefined) {
      updates.push(`location = $${paramIdx++}`);
      values.push(updateFields.location);
    }
    if (updateFields.address !== undefined) {
      updates.push(`address = $${paramIdx++}`);
      values.push(updateFields.address);
    }
    if (updateFields.area !== undefined) {
      updates.push(`area = $${paramIdx++}`);
      values.push(updateFields.area);
    }
    if (updateFields.bedrooms !== undefined) {
      updates.push(`bedrooms = $${paramIdx++}`);
      values.push(updateFields.bedrooms);
    }
    if (updateFields.bathrooms !== undefined) {
      updates.push(`bathrooms = $${paramIdx++}`);
      values.push(updateFields.bathrooms);
    }
    if (updateFields.features !== undefined) {
      updates.push(`features = $${paramIdx++}`);
      values.push(updateFields.features);
    }
    if (updateFields.status !== undefined) {
      updates.push(`status = $${paramIdx++}`);
      values.push(updateFields.status);
    }
    updates.push(`updated_at = NOW()`);

    if (updates.length > 1) {
      const query = `UPDATE properties SET ${updates.join(", ")} WHERE id = $${paramIdx}`;
      values.push(id);
      await sql.unsafe(query, values);
    }

    // Actualizar imágenes si se enviaron
    if (images && Array.isArray(images)) {
      // Borrar imágenes existentes
      await sql`DELETE FROM property_images WHERE property_id = ${id}`;

      // Insertar nuevas
      for (let i = 0; i < images.length; i++) {
        await sql`
          INSERT INTO property_images (property_id, url, display_order, is_primary)
          VALUES (${id}, ${images[i]}, ${i}, ${i === 0})
        `;
      }
    }

    await sql.end();

    const updated = await getPropertyById(id);
    return { property: updated, error: null };
  } catch (error: any) {
    if (sql) {
      try {
        await sql.end();
      } catch {}
    }
    console.error("Error updating property:", error);
    return { property: null, error: error.message || "Unknown error" };
  }
}

export async function deleteProperty(id: string): Promise<boolean> {
  let sql;
  try {
    sql = getPgConnection();

    // Borrar imágenes (FK CASCADE deberia hacerlo pero por si acaso)
    await sql`DELETE FROM property_images WHERE property_id = ${id}`;
    // Borrar la propiedad
    await sql`DELETE FROM properties WHERE id = ${id}`;

    await sql.end();
    return true;
  } catch (error: any) {
    if (sql) {
      try {
        await sql.end();
      } catch {}
    }
    console.error("Error deleting property:", error);
    return false;
  }
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

export async function getTeamMembers(): Promise<Omit<Agent, "password" | "email">[]> {
  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from("agents")
    .select("id, name, phone, photo, title, role, active, created_at, email")
    .eq("active", true)
    .neq("email", "admin@barrerabrokers.com")
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data.map((d: any) => ({
    id: d.id,
    name: d.name,
    phone: d.phone,
    photo: d.photo,
    title: d.title,
    role: d.role,
    active: d.active,
    createdAt: d.created_at,
  }));
}

export async function deleteAgent(id: string): Promise<{ success: boolean; error: string | null }> {
  let sql;
  try {
    sql = getPgConnection();
    // Las FKs en properties.agent_id y developments.agent_id estan en ON DELETE SET NULL,
    // asi que basta con eliminar al agente.
    await sql`DELETE FROM agents WHERE id = ${id}`;
    await sql.end();
    return { success: true, error: null };
  } catch (error: any) {
    if (sql) {
      try {
        await sql.end();
      } catch {}
    }
    console.error("Error deleting agent:", error);
    return { success: false, error: error.message || "Unknown error" };
  }
}

export async function updateAgent(
  id: string,
  data: { name?: string; phone?: string; photo?: string; title?: string; role?: string; active?: boolean }
): Promise<{ agent: Agent | null; error: string | null }> {
  const supabase = getServerSupabase();

  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.photo !== undefined) updateData.photo = data.photo;
  if (data.title !== undefined) updateData.title = data.title;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.active !== undefined) updateData.active = data.active;
  updateData.updated_at = new Date().toISOString();

  const { data: agent, error } = await supabase
    .from("agents")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error || !agent) {
    return { agent: null, error: error?.message || "Error al actualizar" };
  }

  return { agent: mapAgentFromDb(agent), error: null };
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
    expenses: data.expenses ? parseFloat(data.expenses) : undefined,
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
    title: data.title,
    role: data.role,
    active: data.active,
    createdAt: data.created_at,
  };
}



// ============================================================
// SITE SETTINGS — singleton (id=1)
// ============================================================

export type SiteSettings = {
  companyName:     string;
  email:           string;
  phone:           string;
  whatsapp:        string;
  addressStreet:   string;
  addressCity:     string;
  whatsappMessage: string;
};

/**
 * Defaults usados cuando la DB no responde o la tabla aún no existe.
 * Mantienen los valores hardcodeados originales para que la UI nunca
 * quede vacía durante el primer deploy.
 */
export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  companyName:     "Barrera Brokers",
  email:           "info@barrerabrokers.com",
  phone:           "+54 11 1234-5678",
  whatsapp:        "541112345678",
  addressStreet:   "Av. Principal 123",
  addressCity:     "Buenos Aires, Argentina",
  whatsappMessage: "Hola! Me interesa conocer más sobre los desarrollos de Barrera Brokers.",
};

export async function getSiteSettings(): Promise<SiteSettings> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    sql = getPgConnection();
    const rows = await sql`SELECT * FROM site_settings WHERE id = 1 LIMIT 1`;
    await sql.end();

    if (!rows || rows.length === 0) return DEFAULT_SITE_SETTINGS;

    const r = rows[0];
    return {
      companyName:     r.company_name     ?? DEFAULT_SITE_SETTINGS.companyName,
      email:           r.email            ?? DEFAULT_SITE_SETTINGS.email,
      phone:           r.phone            ?? DEFAULT_SITE_SETTINGS.phone,
      whatsapp:        r.whatsapp         ?? DEFAULT_SITE_SETTINGS.whatsapp,
      addressStreet:   r.address_street   ?? DEFAULT_SITE_SETTINGS.addressStreet,
      addressCity:     r.address_city     ?? DEFAULT_SITE_SETTINGS.addressCity,
      whatsappMessage: r.whatsapp_message ?? DEFAULT_SITE_SETTINGS.whatsappMessage,
    };
  } catch (err) {
    // DB no disponible o tabla aún no creada → fallback
    try { await sql?.end(); } catch {}
    return DEFAULT_SITE_SETTINGS;
  }
}

export async function updateSiteSettings(
  data: Partial<SiteSettings>
): Promise<{ settings: SiteSettings | null; error: string | null }> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    sql = getPgConnection();

    // Asegurar que la fila singleton exista
    await sql`INSERT INTO site_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`;

    // Update individual de cada campo si vino en el payload.
    // Hacemos updates separados para evitar problemas con SET dinámico.
    if (data.companyName     !== undefined) await sql`UPDATE site_settings SET company_name     = ${data.companyName}     WHERE id = 1`;
    if (data.email           !== undefined) await sql`UPDATE site_settings SET email            = ${data.email}           WHERE id = 1`;
    if (data.phone           !== undefined) await sql`UPDATE site_settings SET phone            = ${data.phone}           WHERE id = 1`;
    if (data.whatsapp        !== undefined) await sql`UPDATE site_settings SET whatsapp         = ${data.whatsapp}        WHERE id = 1`;
    if (data.addressStreet   !== undefined) await sql`UPDATE site_settings SET address_street   = ${data.addressStreet}   WHERE id = 1`;
    if (data.addressCity     !== undefined) await sql`UPDATE site_settings SET address_city     = ${data.addressCity}     WHERE id = 1`;
    if (data.whatsappMessage !== undefined) await sql`UPDATE site_settings SET whatsapp_message = ${data.whatsappMessage} WHERE id = 1`;

    const rows = await sql`SELECT * FROM site_settings WHERE id = 1 LIMIT 1`;
    await sql.end();

    const r = rows[0];
    return {
      settings: {
        companyName:     r.company_name,
        email:           r.email,
        phone:           r.phone,
        whatsapp:        r.whatsapp,
        addressStreet:   r.address_street,
        addressCity:     r.address_city,
        whatsappMessage: r.whatsapp_message,
      },
      error: null,
    };
  } catch (err: any) {
    try { await sql?.end(); } catch {}
    return { settings: null, error: err?.message || "Error al guardar settings" };
  }
}



// ============================================================
// SITE SETTINGS — Extensión "Nosotros" (about-section)
// ============================================================

export type AboutSettings = {
  aboutImage:             string;
  aboutEyebrow:           string;
  aboutTitle:             string;
  aboutDescription:       string;
  aboutStatNumber:        string;
  aboutStatLabel:         string;
  aboutValue1Title:       string;
  aboutValue1Description: string;
  aboutValue2Title:       string;
  aboutValue2Description: string;
  aboutValue3Title:       string;
  aboutValue3Description: string;
};

export const DEFAULT_ABOUT_SETTINGS: AboutSettings = {
  aboutImage: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1200&q=90",
  aboutEyebrow: "Nosotros",
  aboutTitle: "Una inmobiliaria independiente",
  aboutDescription:
    "Nacimos en el año 2000 con la idea de ofrecer un servicio inmobiliario claro, profesional y centrado en cada cliente. Hoy, más de dos décadas después, seguimos con el mismo equipo y la misma forma de trabajar.",
  aboutStatNumber: "+500",
  aboutStatLabel: "Operaciones realizadas",
  aboutValue1Title: "Trayectoria",
  aboutValue1Description:
    "Más de 25 años operando en Buenos Aires, con conocimiento profundo de cada barrio y tipología de propiedad.",
  aboutValue2Title: "Equipo",
  aboutValue2Description:
    "Profesionales matriculados, especialistas en venta, alquiler, desarrollos e inversiones, trabajando en coordinación.",
  aboutValue3Title: "Atención",
  aboutValue3Description:
    "Cada cliente recibe asesoramiento personalizado, desde la primera visita hasta la firma de la escritura o el contrato.",
};

export type FullSiteSettings = SiteSettings & AboutSettings;

export const DEFAULT_FULL_SETTINGS: FullSiteSettings = {
  ...DEFAULT_SITE_SETTINGS,
  ...DEFAULT_ABOUT_SETTINGS,
};

export async function getFullSiteSettings(): Promise<FullSiteSettings> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    sql = getPgConnection();
    const rows = await sql`SELECT * FROM site_settings WHERE id = 1 LIMIT 1`;
    await sql.end();

    if (!rows || rows.length === 0) return DEFAULT_FULL_SETTINGS;

    const r = rows[0];
    return {
      companyName:     r.company_name     ?? DEFAULT_SITE_SETTINGS.companyName,
      email:           r.email            ?? DEFAULT_SITE_SETTINGS.email,
      phone:           r.phone            ?? DEFAULT_SITE_SETTINGS.phone,
      whatsapp:        r.whatsapp         ?? DEFAULT_SITE_SETTINGS.whatsapp,
      addressStreet:   r.address_street   ?? DEFAULT_SITE_SETTINGS.addressStreet,
      addressCity:     r.address_city     ?? DEFAULT_SITE_SETTINGS.addressCity,
      whatsappMessage: r.whatsapp_message ?? DEFAULT_SITE_SETTINGS.whatsappMessage,
      aboutImage:             r.about_image               ?? DEFAULT_ABOUT_SETTINGS.aboutImage,
      aboutEyebrow:           r.about_eyebrow             ?? DEFAULT_ABOUT_SETTINGS.aboutEyebrow,
      aboutTitle:             r.about_title               ?? DEFAULT_ABOUT_SETTINGS.aboutTitle,
      aboutDescription:       r.about_description         ?? DEFAULT_ABOUT_SETTINGS.aboutDescription,
      aboutStatNumber:        r.about_stat_number         ?? DEFAULT_ABOUT_SETTINGS.aboutStatNumber,
      aboutStatLabel:         r.about_stat_label          ?? DEFAULT_ABOUT_SETTINGS.aboutStatLabel,
      aboutValue1Title:       r.about_value_1_title       ?? DEFAULT_ABOUT_SETTINGS.aboutValue1Title,
      aboutValue1Description: r.about_value_1_description ?? DEFAULT_ABOUT_SETTINGS.aboutValue1Description,
      aboutValue2Title:       r.about_value_2_title       ?? DEFAULT_ABOUT_SETTINGS.aboutValue2Title,
      aboutValue2Description: r.about_value_2_description ?? DEFAULT_ABOUT_SETTINGS.aboutValue2Description,
      aboutValue3Title:       r.about_value_3_title       ?? DEFAULT_ABOUT_SETTINGS.aboutValue3Title,
      aboutValue3Description: r.about_value_3_description ?? DEFAULT_ABOUT_SETTINGS.aboutValue3Description,
    };
  } catch {
    try { await sql?.end(); } catch {}
    return DEFAULT_FULL_SETTINGS;
  }
}

export async function updateFullSiteSettings(
  data: Partial<FullSiteSettings>
): Promise<{ settings: FullSiteSettings | null; error: string | null }> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    sql = getPgConnection();
    await sql`INSERT INTO site_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`;

    if (data.companyName     !== undefined) await sql`UPDATE site_settings SET company_name     = ${data.companyName}     WHERE id = 1`;
    if (data.email           !== undefined) await sql`UPDATE site_settings SET email            = ${data.email}           WHERE id = 1`;
    if (data.phone           !== undefined) await sql`UPDATE site_settings SET phone            = ${data.phone}           WHERE id = 1`;
    if (data.whatsapp        !== undefined) await sql`UPDATE site_settings SET whatsapp         = ${data.whatsapp}        WHERE id = 1`;
    if (data.addressStreet   !== undefined) await sql`UPDATE site_settings SET address_street   = ${data.addressStreet}   WHERE id = 1`;
    if (data.addressCity     !== undefined) await sql`UPDATE site_settings SET address_city     = ${data.addressCity}     WHERE id = 1`;
    if (data.whatsappMessage !== undefined) await sql`UPDATE site_settings SET whatsapp_message = ${data.whatsappMessage} WHERE id = 1`;

    if (data.aboutImage             !== undefined) await sql`UPDATE site_settings SET about_image               = ${data.aboutImage}             WHERE id = 1`;
    if (data.aboutEyebrow           !== undefined) await sql`UPDATE site_settings SET about_eyebrow             = ${data.aboutEyebrow}           WHERE id = 1`;
    if (data.aboutTitle             !== undefined) await sql`UPDATE site_settings SET about_title               = ${data.aboutTitle}             WHERE id = 1`;
    if (data.aboutDescription       !== undefined) await sql`UPDATE site_settings SET about_description         = ${data.aboutDescription}       WHERE id = 1`;
    if (data.aboutStatNumber        !== undefined) await sql`UPDATE site_settings SET about_stat_number         = ${data.aboutStatNumber}        WHERE id = 1`;
    if (data.aboutStatLabel         !== undefined) await sql`UPDATE site_settings SET about_stat_label          = ${data.aboutStatLabel}         WHERE id = 1`;
    if (data.aboutValue1Title       !== undefined) await sql`UPDATE site_settings SET about_value_1_title       = ${data.aboutValue1Title}       WHERE id = 1`;
    if (data.aboutValue1Description !== undefined) await sql`UPDATE site_settings SET about_value_1_description = ${data.aboutValue1Description} WHERE id = 1`;
    if (data.aboutValue2Title       !== undefined) await sql`UPDATE site_settings SET about_value_2_title       = ${data.aboutValue2Title}       WHERE id = 1`;
    if (data.aboutValue2Description !== undefined) await sql`UPDATE site_settings SET about_value_2_description = ${data.aboutValue2Description} WHERE id = 1`;
    if (data.aboutValue3Title       !== undefined) await sql`UPDATE site_settings SET about_value_3_title       = ${data.aboutValue3Title}       WHERE id = 1`;
    if (data.aboutValue3Description !== undefined) await sql`UPDATE site_settings SET about_value_3_description = ${data.aboutValue3Description} WHERE id = 1`;

    await sql.end();

    const settings = await getFullSiteSettings();
    return { settings, error: null };
  } catch (err: any) {
    try { await sql?.end(); } catch {}
    return { settings: null, error: err?.message || "Error al guardar settings" };
  }
}
