import { Property, Agent } from "@/types";
import { getServerSupabase } from "@/lib/supabase";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import postgres from "postgres";
import type { CrmLeadStatus } from "@/lib/crm-statuses";
import { normalizeSmtpPassword } from "@/lib/crm-email-errors";
import { splitInternationalPhone } from "@/lib/phone-countries";
export type { CrmLeadStatus } from "@/lib/crm-statuses";

// Helper: get raw postgres connection
function getPgConnection() {
  const databaseUrl =
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
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
  visibility?: string;
}): Promise<Property[]> {
  return getPropertiesViaPostgres(filter);
}

export async function getPropertyById(id: string): Promise<Property | null> {
  return getPropertyByIdViaPostgres(id);
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
        status,
        visibility,
        video_urls,
        video_is_primary
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
        ${propertyData.status || "disponible"},
        ${propertyData.visibility || "public"},
        ${propertyData.videoUrls || []},
        ${Boolean(propertyData.videoIsPrimary)}
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
    if (updateFields.visibility !== undefined) {
      updates.push(`visibility = $${paramIdx++}`);
      values.push(updateFields.visibility);
    }
    if (updateFields.videoUrls !== undefined) {
      updates.push(`video_urls = $${paramIdx++}`);
      values.push(updateFields.videoUrls);
    }
    if (updateFields.videoIsPrimary !== undefined) {
      updates.push(`video_is_primary = $${paramIdx++}`);
      values.push(Boolean(updateFields.videoIsPrimary));
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
  role?: "agent" | "admin" | "marketing";
  active?: boolean;
}): Promise<{ agent: Agent | null; error: string | null }> {
  const supabase = getServerSupabase();
  const { count } = await supabase
    .from("agents")
    .select("id", { count: "exact", head: true });

  const insertData = {
    name: data.name,
    email: data.email,
    password: data.password,
    phone: data.phone || null,
    role: data.role || "agent",
    active: data.active ?? false,
    sort_order: count ?? 0,
  };

  let { data: agent, error } = await supabase
    .from("agents")
    .insert(insertData)
    .select()
    .single();

  if (error?.message?.includes("sort_order")) {
    const { sort_order, ...fallbackData } = insertData;
    const retry = await supabase
      .from("agents")
      .insert(fallbackData)
      .select()
      .single();
    agent = retry.data;
    error = retry.error;
  }

  if (error || !agent) {
    console.error("Error creating agent:", error);
    return { agent: null, error: error?.message || "Unknown error" };
  }

  return { agent: mapAgentFromDb(agent), error: null };
}

export async function getAllAgents(): Promise<Agent[]> {
  return getAllAgentsViaPostgres();
}

export async function getTeamMembers(): Promise<Omit<Agent, "password" | "email">[]> {
  return getTeamMembersViaPostgres();
}

async function getPropertiesViaPostgres(filter?: {
  category?: string;
  status?: string;
  visibility?: string;
}): Promise<Property[]> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    sql = getPgConnection();
    const conditions: string[] = [];
    const values: any[] = [];

    if (filter?.category) {
      values.push(filter.category);
      conditions.push(`p.category = $${values.length}`);
    }
    if (filter?.status) {
      values.push(filter.status);
      conditions.push(`p.status = $${values.length}`);
    }
    if (filter?.visibility) {
      values.push(filter.visibility);
      conditions.push(`p.visibility = $${values.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = await sql.unsafe(
      `
        SELECT
          p.*,
          COALESCE(
            json_agg(
              json_build_object(
                'url', pi.url,
                'display_order', pi.display_order,
                'is_primary', pi.is_primary
              )
              ORDER BY pi.display_order
            ) FILTER (WHERE pi.id IS NOT NULL),
            '[]'::json
          ) AS property_images
        FROM properties p
        LEFT JOIN property_images pi ON pi.property_id = p.id
        ${where}
        GROUP BY p.id
        ORDER BY p.created_at DESC
      `,
      values
    );

    return rows.map(mapPropertyFromDb);
  } catch (error) {
    console.error("Error fetching properties via Postgres:", error);
    return [];
  } finally {
    try {
      await sql?.end();
    } catch {}
  }
}

async function getPropertyByIdViaPostgres(id: string): Promise<Property | null> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    sql = getPgConnection();
    const rows = await sql`
      SELECT
        p.*,
        COALESCE(
          json_agg(
            json_build_object(
              'url', pi.url,
              'display_order', pi.display_order,
              'is_primary', pi.is_primary
            )
            ORDER BY pi.display_order
          ) FILTER (WHERE pi.id IS NOT NULL),
          '[]'::json
        ) AS property_images
      FROM properties p
      LEFT JOIN property_images pi ON pi.property_id = p.id
      WHERE p.id = ${id}
      GROUP BY p.id
      LIMIT 1
    `;
    return rows[0] ? mapPropertyFromDb(rows[0]) : null;
  } catch (error) {
    console.error("Error fetching property by id via Postgres:", error);
    return null;
  } finally {
    try {
      await sql?.end();
    } catch {}
  }
}

async function getAllAgentsViaPostgres(): Promise<Agent[]> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    sql = getPgConnection();
    const rows = await sql`
      SELECT *
      FROM agents
      ORDER BY sort_order ASC NULLS LAST, created_at ASC
    `;
    return rows.map(mapAgentFromDb);
  } catch (error) {
    console.error("Error fetching agents via Postgres:", error);
    return [];
  } finally {
    try {
      await sql?.end();
    } catch {}
  }
}

async function getTeamMembersViaPostgres(): Promise<Omit<Agent, "password" | "email">[]> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    sql = getPgConnection();
    const rows = await sql`
      SELECT id, name, phone, photo, title, role, active, sort_order, created_at
      FROM agents
      WHERE active = true
        AND email <> 'admin@barrerabrokers.com'
      ORDER BY sort_order ASC NULLS LAST, created_at ASC
    `;
    return rows.map((d: any) => ({
      id: d.id,
      name: d.name,
      phone: d.phone,
      photo: d.photo,
      title: d.title,
      role: d.role,
      active: d.active,
      sortOrder: d.sort_order,
      createdAt: d.created_at,
    }));
  } catch (error) {
    console.error("Error fetching team members via Postgres:", error);
    return [];
  } finally {
    try {
      await sql?.end();
    } catch {}
  }
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
  data: {
    name?: string;
    email?: string;
    password?: string;
    phone?: string;
    photo?: string;
    title?: string;
    role?: string;
    active?: boolean;
    sortOrder?: number;
  }
): Promise<{ agent: Agent | null; error: string | null }> {
  const supabase = getServerSupabase();

  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.password !== undefined) updateData.password = data.password;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.photo !== undefined) updateData.photo = data.photo;
  if (data.title !== undefined) updateData.title = data.title;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.active !== undefined) updateData.active = data.active;
  if (data.sortOrder !== undefined) updateData.sort_order = data.sortOrder;
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

export async function updateAgentsOrder(
  order: { id: string; sortOrder: number }[]
): Promise<{ success: boolean; error: string | null }> {
  let sql;
  try {
    sql = getPgConnection();
    await sql.unsafe(`ALTER TABLE agents ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;`);

    for (const item of order) {
      await sql`
        UPDATE agents
        SET sort_order = ${item.sortOrder}, updated_at = NOW()
        WHERE id = ${item.id}
      `;
    }

    await sql.end();
    return { success: true, error: null };
  } catch (error: any) {
    if (sql) {
      try {
        await sql.end();
      } catch {}
    }
    return { success: false, error: error.message || "Error al ordenar agentes" };
  }
}

async function ensurePasswordResetTable(sql: ReturnType<typeof getPgConnection>) {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS agent_password_reset_tokens (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      token_hash TEXT UNIQUE NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      approve_on_use BOOLEAN DEFAULT false,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await sql.unsafe(`
    ALTER TABLE agent_password_reset_tokens
    ADD COLUMN IF NOT EXISTS approve_on_use BOOLEAN DEFAULT false;
  `);
  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_agent_password_reset_tokens_token_hash
    ON agent_password_reset_tokens(token_hash);
  `);
  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_agent_password_reset_tokens_agent_id
    ON agent_password_reset_tokens(agent_id);
  `);
}

export async function createAgentPasswordResetToken(data: {
  agentId: string;
  tokenHash: string;
  expiresAt: Date;
  approveOnUse?: boolean;
}): Promise<{ success: boolean; error: string | null }> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    sql = getPgConnection();
    await ensurePasswordResetTable(sql);
    await sql`
      UPDATE agent_password_reset_tokens
      SET used_at = NOW()
      WHERE agent_id = ${data.agentId}
        AND used_at IS NULL
    `;
    await sql`
      INSERT INTO agent_password_reset_tokens (agent_id, token_hash, expires_at, approve_on_use)
      VALUES (${data.agentId}, ${data.tokenHash}, ${data.expiresAt.toISOString()}, ${data.approveOnUse ?? false})
    `;
    return { success: true, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al crear token";
    console.error("Error creating password reset token:", error);
    return { success: false, error: message };
  } finally {
    try {
      await sql?.end();
    } catch {}
  }
}

export async function updateAgentPasswordWithResetToken(data: {
  tokenHash: string;
  passwordHash: string;
}): Promise<{ success: boolean; error: string | null }> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    sql = getPgConnection();
    await ensurePasswordResetTable(sql);

    const rows = await sql`
      SELECT id, agent_id, approve_on_use
      FROM agent_password_reset_tokens
      WHERE token_hash = ${data.tokenHash}
        AND used_at IS NULL
        AND expires_at > NOW()
      LIMIT 1
    `;

    const resetToken = rows[0];
    if (!resetToken) {
      return { success: false, error: "El enlace venció o ya fue utilizado." };
    }

    await sql.begin(async (tx) => {
      await tx`
        UPDATE agents
        SET
          password = ${data.passwordHash},
          active = CASE
            WHEN ${resetToken.approve_on_use} = true THEN true
            ELSE active
          END,
          updated_at = NOW()
        WHERE id = ${resetToken.agent_id}
      `;
      await tx`
        UPDATE agent_password_reset_tokens
        SET used_at = NOW()
        WHERE id = ${resetToken.id}
      `;
    });

    return { success: true, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al actualizar contraseña";
    console.error("Error updating password with reset token:", error);
    return { success: false, error: message };
  } finally {
    try {
      await sql?.end();
    } catch {}
  }
}

// ============================================================
// MOBILE UPLOAD SESSIONS
// ============================================================

async function ensureMobileUploadSessionsTable(sql: ReturnType<typeof getPgConnection>) {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS mobile_upload_sessions (
      id TEXT PRIMARY KEY,
      file_urls TEXT[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    );
  `);
  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_mobile_upload_sessions_expires_at
    ON mobile_upload_sessions(expires_at);
  `);
}

export async function createMobileUploadSession(data: {
  id: string;
  expiresAt: Date;
}): Promise<{ success: boolean; error: string | null }> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    sql = getPgConnection();
    await ensureMobileUploadSessionsTable(sql);
    await sql`DELETE FROM mobile_upload_sessions WHERE expires_at <= NOW()`;
    await sql`
      INSERT INTO mobile_upload_sessions (id, expires_at)
      VALUES (${data.id}, ${data.expiresAt.toISOString()})
    `;
    return { success: true, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al crear sesion";
    console.error("Error creating mobile upload session:", error);
    return { success: false, error: message };
  } finally {
    try {
      await sql?.end();
    } catch {}
  }
}

export async function getMobileUploadSessionFiles(
  id: string
): Promise<{ files: string[] | null; expired: boolean; error: string | null }> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    sql = getPgConnection();
    await ensureMobileUploadSessionsTable(sql);
    const rows = await sql`
      SELECT file_urls, expires_at
      FROM mobile_upload_sessions
      WHERE id = ${id}
      LIMIT 1
    `;

    const session = rows[0];
    if (!session) {
      return { files: null, expired: true, error: "Sesion expirada o invalida" };
    }

    if (new Date(session.expires_at).getTime() <= Date.now()) {
      await sql`DELETE FROM mobile_upload_sessions WHERE id = ${id}`;
      return { files: null, expired: true, error: "Sesion expirada" };
    }

    return { files: Array.isArray(session.file_urls) ? session.file_urls : [], expired: false, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al consultar sesion";
    console.error("Error reading mobile upload session:", error);
    return { files: null, expired: false, error: message };
  } finally {
    try {
      await sql?.end();
    } catch {}
  }
}

export async function appendMobileUploadSessionFile(data: {
  id: string;
  fileUrl: string;
}): Promise<{ success: boolean; totalFiles: number; expired: boolean; error: string | null }> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    sql = getPgConnection();
    await ensureMobileUploadSessionsTable(sql);
    const rows = await sql`
      UPDATE mobile_upload_sessions
      SET file_urls = array_append(file_urls, ${data.fileUrl})
      WHERE id = ${data.id}
        AND expires_at > NOW()
      RETURNING cardinality(file_urls) AS total_files
    `;

    const updated = rows[0];
    if (!updated) {
      await sql`DELETE FROM mobile_upload_sessions WHERE id = ${data.id} AND expires_at <= NOW()`;
      return { success: false, totalFiles: 0, expired: true, error: "Sesion expirada o invalida" };
    }

    return {
      success: true,
      totalFiles: Number(updated.total_files || 0),
      expired: false,
      error: null,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al guardar archivo";
    console.error("Error appending mobile upload file:", error);
    return { success: false, totalFiles: 0, expired: false, error: message };
  } finally {
    try {
      await sql?.end();
    } catch {}
  }
}

// ============================================================
// CRM LEADS
// ============================================================

export type CrmHubSpotProperties = Record<string, string | number | boolean | null>;
export type CrmLeadTemperature = "" | "frio" | "tibio" | "caliente";

export type CrmLead = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  countryCode: string;
  phone: string;
  status: CrmLeadStatus;
  temperature: CrmLeadTemperature;
  source: string;
  developmentId?: string;
  developmentName?: string;
  developmentNameText?: string;
  assignedAgentId?: string;
  assignedAgentName?: string;
  notes?: string;
  hubspotObjectId?: string;
  hubspotProperties?: CrmHubSpotProperties;
  metaLeadId?: string;
  metaFormId?: string;
  metaPageId?: string;
  metaProperties?: CrmHubSpotProperties;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
};

export type CrmActivityType =
  | "nota"
  | "correo"
  | "whatsapp"
  | "llamada"
  | "reunion"
  | "tarea";

export type CrmActivity = {
  id: string;
  leadId: string;
  type: CrmActivityType;
  title: string;
  body: string;
  scheduledAt?: string;
  createdBy?: string;
  createdByName?: string;
  externalSource?: string;
  externalId?: string;
  createdAt: string;
};

export type CrmEmailTracking = {
  id: string;
  trackingId: string;
  leadId: string;
  agentId?: string;
  recipientEmail: string;
  subject: string;
  openCount: number;
  firstOpenedAt?: string;
  lastOpenedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type CrmEmailAttachmentTracking = {
  id: string;
  trackingId: string;
  emailTrackingId?: string;
  leadId: string;
  agentId?: string;
  fileName: string;
  fileUrl: string;
  openCount: number;
  firstOpenedAt?: string;
  lastOpenedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type CrmLeadInput = {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  countryCode: string;
  phone: string;
  status: CrmLeadStatus;
  temperature?: CrmLeadTemperature;
  source?: string;
  developmentId?: string;
  developmentNameText?: string;
  assignedAgentId?: string;
  notes?: string;
  hubspotObjectId?: string;
  hubspotProperties?: CrmHubSpotProperties;
  metaLeadId?: string;
  metaFormId?: string;
  metaPageId?: string;
  metaProperties?: CrmHubSpotProperties;
  createdBy?: string | null;
  createdAt?: string | null;
};

function metaSubmissions(value: unknown): Array<Record<string, unknown>> {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
      : [];
  } catch {
    return [];
  }
}

function mergeMetaProperties(
  existing: CrmHubSpotProperties | undefined,
  incoming: CrmHubSpotProperties | undefined
) {
  if (!incoming) return existing;
  const submissions = [
    ...metaSubmissions(existing?.meta_submissions),
    ...metaSubmissions(incoming.meta_submissions),
  ];
  const byLeadId = new Map<string, Record<string, unknown>>();
  for (const submission of submissions) {
    const key = String(submission.leadId || submission.metaLeadId || "").trim();
    if (key) byLeadId.set(key, submission);
  }
  return {
    ...(existing || {}),
    ...incoming,
    ...(byLeadId.size > 0 ? { meta_submissions: JSON.stringify(Array.from(byLeadId.values())) } : {}),
  } satisfies CrmHubSpotProperties;
}

export type CrmExtensionContactTab = {
  id: string;
  name: string;
  status: string;
  kind?: string;
};

export type CrmExtensionPreferences = {
  contactTabs: CrmExtensionContactTab[];
  featuredLeadIds: string[];
};

type CrmLeadRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  country_code: string | null;
  phone: string | null;
  status: CrmLeadStatus;
  temperature: CrmLeadTemperature | null;
  source: string | null;
  development_id: string | null;
  development_name: string | null;
  development_name_text: string | null;
  assigned_agent_id: string | null;
  assigned_agent_name: string | null;
  notes: string | null;
  hubspot_object_id: string | null;
  hubspot_properties: CrmHubSpotProperties | null;
  meta_lead_id: string | null;
  meta_form_id: string | null;
  meta_page_id: string | null;
  meta_properties: CrmHubSpotProperties | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

let crmLeadsSchemaReady = false;
let crmLeadsSchemaPromise: Promise<void> | null = null;
let crmActivitiesSchemaReady = false;
let crmActivitiesSchemaPromise: Promise<void> | null = null;
let crmEmailTrackingSchemaReady = false;
let crmEmailTrackingSchemaPromise: Promise<void> | null = null;
let crmEmailAccountsSchemaReady = false;
let crmEmailAccountsSchemaPromise: Promise<void> | null = null;
let crmEmailTemplatesSchemaReady = false;
let crmEmailTemplatesSchemaPromise: Promise<void> | null = null;
let crmWorkflowsSchemaReady = false;
let crmWorkflowsSchemaPromise: Promise<void> | null = null;
let crmDataPropertiesSchemaReady = false;
let crmDataPropertiesSchemaPromise: Promise<void> | null = null;
let crmExtensionPreferencesSchemaReady = false;
let crmExtensionPreferencesSchemaPromise: Promise<void> | null = null;

export type CrmDataPropertyType = "lead_status" | "development";

export type CrmDataProperty = {
  id: string;
  type: CrmDataPropertyType;
  value: string;
  label: string;
  hubspotValue?: string;
  localDevelopmentId?: string;
  localDevelopmentName?: string;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type CrmDataPropertyInput = {
  id?: string;
  type: CrmDataPropertyType;
  value: string;
  label: string;
  hubspotValue?: string;
  localDevelopmentId?: string;
  active?: boolean;
  sortOrder?: number;
};

export type CrmEmailAccount = {
  id: string;
  agentId: string;
  provider: string;
  email: string;
  fromName: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  signature: string;
  googleScopes?: string;
  connectedAt: string;
  updatedAt: string;
};

export type CrmEmailAccountInput = {
  agentId: string;
  provider?: string;
  email: string;
  fromName?: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  signature?: string;
  googleScopes?: string;
};

export type CrmEmailTemplateContentBlock =
  | {
      id: string;
      type: "text";
      text: string;
      html?: string;
      color?: string;
      fontFamily?: string;
      fontSize?: number;
      align?: "left" | "center" | "right";
      backgroundColor?: string;
      padding?: number;
    }
  | {
      id: string;
      type: "image";
      url: string;
      width: number;
      align?: "left" | "center" | "right";
      alt?: string;
      borderRadius?: number;
      caption?: string;
      linkUrl?: string;
    }
  | {
      id: string;
      type: "button";
      label: string;
      url: string;
      align?: "left" | "center" | "right";
      backgroundColor?: string;
      textColor?: string;
      borderRadius?: number;
    }
  | {
      id: string;
      type: "divider";
      color?: string;
      thickness?: number;
      width?: number;
    }
  | {
      id: string;
      type: "spacer";
      height: number;
    }
  | {
      id: string;
      type: "attachment";
      url: string;
      name: string;
    }
  | {
      id: string;
      type: "columns";
      gap?: number;
      widths?: number[];
      columns: Array<
        | { type: "text"; text: string; html?: string; color?: string; fontSize?: number; fontFamily?: string; align?: "left" | "center" | "right"; bold?: boolean }
        | { type: "image"; url: string; alt?: string; borderRadius?: number }
      >;
    };

export type CrmEmailTemplate = {
  id: string;
  channel: "email" | "whatsapp";
  name: string;
  category: string;
  subject: string;
  body: string;
  imageUrls: string[];
  contentBlocks: CrmEmailTemplateContentBlock[];
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
};

export type CrmEmailTemplateInput = {
  id?: string;
  channel?: "email" | "whatsapp";
  name: string;
  category?: string;
  subject: string;
  body: string;
  imageUrls?: string[];
  contentBlocks?: CrmEmailTemplateContentBlock[];
  createdBy?: string | null;
};

export type CrmWorkflowTriggerType = "lead_status_changed";
export type CrmWorkflowActionType = "send_email_template";
export type CrmWorkflowDelayHours = 0 | 24 | 72 | 168;

export type CrmWorkflow = {
  id: string;
  name: string;
  active: boolean;
  triggerType: CrmWorkflowTriggerType;
  triggerStatus: CrmLeadStatus;
  actionType: CrmWorkflowActionType;
  templateId: string;
  templateName?: string;
  templateSubject?: string;
  runOncePerLead: boolean;
  deliveryDelayHours: CrmWorkflowDelayHours;
  repeatEnabled: boolean;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
};

export type CrmWorkflowInput = {
  id?: string;
  name: string;
  active?: boolean;
  triggerType?: CrmWorkflowTriggerType;
  triggerStatus: CrmLeadStatus;
  actionType?: CrmWorkflowActionType;
  templateId: string;
  runOncePerLead?: boolean;
  deliveryDelayHours?: CrmWorkflowDelayHours;
  repeatEnabled?: boolean;
  createdBy?: string | null;
};

export type CrmWorkflowExecution = {
  id: string;
  workflowId: string;
  leadId: string;
  previousStatus?: CrmLeadStatus;
  nextStatus: CrmLeadStatus;
  actionType: CrmWorkflowActionType;
  templateId?: string;
  activityId?: string;
  success: boolean;
  error?: string;
  executedBy?: string;
  createdAt: string;
};

export type CrmWorkflowJob = {
  id: string;
  workflowId: string;
  leadId: string;
  previousStatus?: CrmLeadStatus;
  nextStatus: CrmLeadStatus;
  executedBy?: string;
  scheduledFor: string;
  attempts: number;
};

type CrmEmailAccountRow = {
  id: string;
  agent_id: string;
  provider: string;
  email: string;
  from_name: string | null;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  encrypted_password?: string | null;
  signature: string | null;
  google_scopes?: string | null;
  connected_at: string;
  updated_at: string;
};

type CrmEmailTemplateRow = {
  id: string;
  channel: "email" | "whatsapp" | null;
  name: string;
  category: string | null;
  subject: string;
  body: string;
  image_urls: string[] | null;
  content_blocks: CrmEmailTemplateContentBlock[] | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
};

type CrmWorkflowRow = {
  id: string;
  name: string;
  active: boolean;
  trigger_type: CrmWorkflowTriggerType;
  trigger_status: CrmLeadStatus;
  action_type: CrmWorkflowActionType;
  template_id: string;
  template_name: string | null;
  template_subject: string | null;
  run_once_per_lead: boolean;
  delivery_delay_hours: CrmWorkflowDelayHours;
  repeat_enabled: boolean;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
};

type CrmWorkflowExecutionRow = {
  id: string;
  workflow_id: string;
  lead_id: string;
  previous_status: CrmLeadStatus | null;
  next_status: CrmLeadStatus;
  action_type: CrmWorkflowActionType;
  template_id: string | null;
  activity_id: string | null;
  success: boolean;
  error: string | null;
  executed_by: string | null;
  created_at: string;
};

export type CrmEmailAccountWithSecret = CrmEmailAccount & {
  smtpPassword: string;
};

function crmEmailEncryptionKey() {
  const secret = process.env.CRM_EMAIL_SECRET || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("Falta configurar CRM_EMAIL_SECRET o NEXTAUTH_SECRET para cifrar cuentas de correo.");
  }
  return createHash("sha256").update(secret).digest();
}

function encryptCrmEmailSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", crmEmailEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

function decryptCrmEmailSecret(value: string) {
  const [ivValue, tagValue, encryptedValue] = value.split(":");
  if (!ivValue || !tagValue || !encryptedValue) {
    throw new Error("La cuenta de correo guardada tiene un formato inválido.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    crmEmailEncryptionKey(),
    Buffer.from(ivValue, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function formatNamePart(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("es-AR")
    .replace(/(^|[\s'-])([a-záéíóúüñ])/gi, (_, prefix: string, letter: string) => {
      return `${prefix}${letter.toLocaleUpperCase("es-AR")}`;
    });
}

async function ensureCrmLeadsTable(sql: ReturnType<typeof getPgConnection>) {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS crm_leads (
      id UUID PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT NOT NULL,
      country_code TEXT DEFAULT '+54',
      phone TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'nuevo',
      temperature TEXT DEFAULT '',
      source TEXT DEFAULT '',
      development_id UUID NULL,
      assigned_agent_id UUID NULL REFERENCES agents(id) ON DELETE SET NULL,
      notes TEXT DEFAULT '',
      created_by UUID NULL REFERENCES agents(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await sql.unsafe(`ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT '+54';`);
  await sql.unsafe(`ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS temperature TEXT DEFAULT '';`);
  await sql.unsafe(`ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS source TEXT DEFAULT '';`);
  await sql.unsafe(`ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS development_id UUID NULL;`);
  await sql.unsafe(`ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS development_name_text TEXT DEFAULT '';`);
  await sql.unsafe(`ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS assigned_agent_id UUID NULL REFERENCES agents(id) ON DELETE SET NULL;`);
  await sql.unsafe(`ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';`);
  await sql.unsafe(`ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS hubspot_object_id TEXT NULL;`);
  await sql.unsafe(`ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS hubspot_properties JSONB DEFAULT '{}'::jsonb;`);
  await sql.unsafe(`ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS meta_lead_id TEXT NULL;`);
  await sql.unsafe(`ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS meta_form_id TEXT NULL;`);
  await sql.unsafe(`ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS meta_page_id TEXT NULL;`);
  await sql.unsafe(`ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS meta_properties JSONB DEFAULT '{}'::jsonb;`);
  await sql.unsafe(`ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS created_by UUID NULL REFERENCES agents(id) ON DELETE SET NULL;`);
  await sql.unsafe(`ALTER TABLE crm_leads ALTER COLUMN email DROP NOT NULL;`);
  await sql.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_leads_email_unique ON crm_leads (lower(email));`);
  await sql.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_leads_hubspot_object_id ON crm_leads (hubspot_object_id) WHERE hubspot_object_id IS NOT NULL;`);
  await sql.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_leads_meta_lead_id ON crm_leads (meta_lead_id) WHERE meta_lead_id IS NOT NULL;`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_crm_leads_status ON crm_leads(status);`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_crm_leads_assigned_agent ON crm_leads(assigned_agent_id);`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_crm_leads_updated_at ON crm_leads(updated_at DESC);`);
}

export async function upsertCrmLeadFromHubSpot(data: {
  objectId: string;
  properties: CrmHubSpotProperties;
  developmentId?: string;
  developmentNameText?: string;
  assignedAgentId?: string;
  createdBy?: string;
}): Promise<{ lead: CrmLead | null; created: boolean; error: string | null }> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    sql = getPgConnection();
    const props = data.properties;
    const stringProperty = (value: unknown) => typeof value === "string" ? value : null;
    const normalizedPhone = splitInternationalPhone(
      stringProperty(props.phone) ||
        stringProperty(props.hs_calculated_phone_number) ||
        stringProperty(props.mobilephone) ||
        stringProperty(props.hs_whatsapp_phone_number),
      stringProperty(props.hs_calculated_phone_number_country_code)
    );
    const rawEmail = typeof props.email === "string" && props.email.length > 0 ? props.email : null;
    const existing = rawEmail
      ? await sql`SELECT id FROM crm_leads WHERE hubspot_object_id = ${data.objectId} OR lower(email) = lower(${rawEmail}) ORDER BY hubspot_object_id = ${data.objectId} DESC LIMIT 1`
      : await sql`SELECT id FROM crm_leads WHERE hubspot_object_id = ${data.objectId} LIMIT 1`;
    const id = (existing[0]?.id as string | undefined) || crypto.randomUUID();
    const created = !existing[0];
    const createdAt = typeof props.createdate === "string" && !Number.isNaN(Date.parse(props.createdate))
      ? props.createdate
      : new Date().toISOString();
    const updatedAt = typeof props.lastmodifieddate === "string" && !Number.isNaN(Date.parse(props.lastmodifieddate))
      ? props.lastmodifieddate
      : new Date().toISOString();
    const rows = await sql`
      INSERT INTO crm_leads (
        id, first_name, last_name, email, country_code, phone, status, temperature,
        source, development_id, development_name_text, assigned_agent_id, notes, hubspot_object_id, hubspot_properties,
        created_by, created_at, updated_at
      ) VALUES (
        ${id}, ${props.firstname || ""}, ${props.lastname || ""}, ${rawEmail},
        ${normalizedPhone.countryCode}, ${normalizedPhone.phone},
        ${props.hs_lead_status || props.lifecyclestage || ""}, '',
        ${props.hs_analytics_source || props.hs_latest_source || ""},
        ${data.developmentId || null}, ${data.developmentNameText || ""},
        ${data.assignedAgentId || null}, ${props.notes_last_contacted || ""},
        ${data.objectId}, ${sql.json(props)}, ${data.createdBy || null}, ${createdAt}, ${updatedAt}
      )
      ON CONFLICT (id) DO UPDATE SET
        first_name = CASE WHEN crm_leads.first_name = '' THEN EXCLUDED.first_name ELSE crm_leads.first_name END,
        last_name = CASE WHEN crm_leads.last_name = '' THEN EXCLUDED.last_name ELSE crm_leads.last_name END,
        email = COALESCE(crm_leads.email, EXCLUDED.email),
        country_code = CASE WHEN crm_leads.phone = '' THEN EXCLUDED.country_code ELSE crm_leads.country_code END,
        phone = CASE WHEN crm_leads.phone = '' THEN EXCLUDED.phone ELSE crm_leads.phone END,
        status = CASE WHEN EXCLUDED.status = '' THEN crm_leads.status ELSE EXCLUDED.status END,
        source = CASE WHEN crm_leads.source = '' THEN EXCLUDED.source ELSE crm_leads.source END,
        development_id = COALESCE(crm_leads.development_id, EXCLUDED.development_id),
        development_name_text = CASE WHEN crm_leads.development_name_text = '' THEN EXCLUDED.development_name_text ELSE crm_leads.development_name_text END,
        assigned_agent_id = COALESCE(EXCLUDED.assigned_agent_id, crm_leads.assigned_agent_id),
        notes = CASE WHEN crm_leads.notes = '' THEN EXCLUDED.notes ELSE crm_leads.notes END,
        hubspot_object_id = EXCLUDED.hubspot_object_id,
        hubspot_properties = EXCLUDED.hubspot_properties,
        updated_at = EXCLUDED.updated_at
      RETURNING crm_leads.*, NULL::text AS development_name, NULL::text AS assigned_agent_name
    `;
    return { lead: rows[0] ? mapCrmLead(rows[0] as unknown as CrmLeadRow) : null, created, error: null };
  } catch (error) {
    console.error("Error mirroring HubSpot contact:", error);
    return { lead: null, created: false, error: error instanceof Error ? error.message : "Error al reflejar contacto de HubSpot" };
  } finally {
    try { await sql?.end(); } catch {}
  }
}

async function ensureCrmLeadsSchema() {
  if (crmLeadsSchemaReady) return;
  if (!crmLeadsSchemaPromise) {
    crmLeadsSchemaPromise = (async () => {
      let sql: ReturnType<typeof getPgConnection> | null = null;
      try {
        sql = getPgConnection();
        await ensureCrmLeadsTable(sql);
        crmLeadsSchemaReady = true;
      } finally {
        try {
          await sql?.end();
        } catch {}
        if (!crmLeadsSchemaReady) crmLeadsSchemaPromise = null;
      }
    })();
  }
  await crmLeadsSchemaPromise;
}

async function ensureCrmExtensionPreferencesSchema() {
  if (crmExtensionPreferencesSchemaReady) return;
  if (!crmExtensionPreferencesSchemaPromise) {
    crmExtensionPreferencesSchemaPromise = (async () => {
      let sql: ReturnType<typeof getPgConnection> | null = null;
      try {
        sql = getPgConnection();
        await sql.unsafe(`
          CREATE TABLE IF NOT EXISTS crm_extension_preferences (
            agent_id UUID PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
            contact_tabs JSONB NOT NULL DEFAULT '[]'::jsonb,
            featured_lead_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );
        `);
        crmExtensionPreferencesSchemaReady = true;
      } finally {
        try {
          await sql?.end();
        } catch {}
        if (!crmExtensionPreferencesSchemaReady) crmExtensionPreferencesSchemaPromise = null;
      }
    })();
  }
  await crmExtensionPreferencesSchemaPromise;
}

export async function getCrmExtensionPreferences(
  agentId: string
): Promise<CrmExtensionPreferences> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    await ensureCrmExtensionPreferencesSchema();
    sql = getPgConnection();
    const rows = await sql`
      SELECT contact_tabs, featured_lead_ids
      FROM crm_extension_preferences
      WHERE agent_id = ${agentId}
      LIMIT 1
    `;
    const row = rows[0];
    return {
      contactTabs: Array.isArray(row?.contact_tabs) ? row.contact_tabs : [],
      featuredLeadIds: Array.isArray(row?.featured_lead_ids)
        ? row.featured_lead_ids.map(String)
        : [],
    };
  } finally {
    try {
      await sql?.end();
    } catch {}
  }
}

export async function upsertCrmExtensionPreferences(
  agentId: string,
  preferences: CrmExtensionPreferences
): Promise<CrmExtensionPreferences> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    await ensureCrmExtensionPreferencesSchema();
    sql = getPgConnection();
    const contactTabs = JSON.stringify(preferences.contactTabs);
    const featuredLeadIds = JSON.stringify(preferences.featuredLeadIds);
    const rows = await sql`
      INSERT INTO crm_extension_preferences (agent_id, contact_tabs, featured_lead_ids)
      VALUES (${agentId}, ${contactTabs}::jsonb, ${featuredLeadIds}::jsonb)
      ON CONFLICT (agent_id) DO UPDATE SET
        contact_tabs = EXCLUDED.contact_tabs,
        featured_lead_ids = EXCLUDED.featured_lead_ids,
        updated_at = NOW()
      RETURNING contact_tabs, featured_lead_ids
    `;
    return {
      contactTabs: Array.isArray(rows[0]?.contact_tabs) ? rows[0].contact_tabs : [],
      featuredLeadIds: Array.isArray(rows[0]?.featured_lead_ids)
        ? rows[0].featured_lead_ids.map(String)
        : [],
    };
  } finally {
    try {
      await sql?.end();
    } catch {}
  }
}

async function ensureCrmDataPropertiesTable(sql: ReturnType<typeof getPgConnection>) {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS crm_data_properties (
      id UUID PRIMARY KEY,
      type TEXT NOT NULL,
      value TEXT NOT NULL,
      label TEXT NOT NULL,
      hubspot_value TEXT DEFAULT '',
      local_development_id UUID NULL,
      active BOOLEAN DEFAULT TRUE,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await sql.unsafe(`ALTER TABLE crm_data_properties ADD COLUMN IF NOT EXISTS hubspot_value TEXT DEFAULT '';`);
  await sql.unsafe(`ALTER TABLE crm_data_properties ADD COLUMN IF NOT EXISTS local_development_id UUID NULL;`);
  await sql.unsafe(`ALTER TABLE crm_data_properties ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;`);
  await sql.unsafe(`ALTER TABLE crm_data_properties ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;`);
  await sql.unsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_data_properties_type_value
    ON crm_data_properties (type, lower(value));
  `);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_crm_data_properties_type ON crm_data_properties(type, active, sort_order);`);
}

async function ensureCrmDataPropertiesSchema() {
  if (crmDataPropertiesSchemaReady) return;
  if (!crmDataPropertiesSchemaPromise) {
    crmDataPropertiesSchemaPromise = (async () => {
      let sql: ReturnType<typeof getPgConnection> | null = null;
      try {
        sql = getPgConnection();
        await ensureCrmDataPropertiesTable(sql);
        crmDataPropertiesSchemaReady = true;
      } finally {
        try {
          await sql?.end();
        } catch {}
        if (!crmDataPropertiesSchemaReady) crmDataPropertiesSchemaPromise = null;
      }
    })();
  }
  await crmDataPropertiesSchemaPromise;
}

function mapCrmDataProperty(row: {
  id: string;
  type: CrmDataPropertyType;
  value: string;
  label: string;
  hubspot_value: string | null;
  local_development_id: string | null;
  local_development_name?: string | null;
  active: boolean;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
}): CrmDataProperty {
  return {
    id: row.id,
    type: row.type,
    value: row.value,
    label: row.label,
    hubspotValue: row.hubspot_value || undefined,
    localDevelopmentId: row.local_development_id || undefined,
    localDevelopmentName: row.local_development_name || undefined,
    active: row.active,
    sortOrder: row.sort_order || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getCrmDataProperties(
  type?: CrmDataPropertyType
): Promise<CrmDataProperty[]> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    sql = getPgConnection();
    const rows = type
      ? await sql`
          SELECT p.*, d.name AS local_development_name
          FROM crm_data_properties p
          LEFT JOIN developments d ON d.id = p.local_development_id
          WHERE p.type = ${type}
          ORDER BY p.sort_order ASC, p.label ASC
        `
      : await sql`
          SELECT p.*, d.name AS local_development_name
          FROM crm_data_properties p
          LEFT JOIN developments d ON d.id = p.local_development_id
          ORDER BY p.type ASC, p.sort_order ASC, p.label ASC
        `;
    return (rows as unknown as Parameters<typeof mapCrmDataProperty>[0][]).map(mapCrmDataProperty);
  } catch (error) {
    console.error("Error fetching CRM data properties:", error);
    return [];
  } finally {
    try {
      await sql?.end();
    } catch {}
  }
}

export async function upsertCrmDataProperty(
  data: CrmDataPropertyInput
): Promise<{ property: CrmDataProperty | null; error: string | null }> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    await ensureCrmDataPropertiesSchema();
    sql = getPgConnection();
    const id = data.id || crypto.randomUUID();
    const rows = await sql`
      INSERT INTO crm_data_properties (
        id,
        type,
        value,
        label,
        hubspot_value,
        local_development_id,
        active,
        sort_order,
        updated_at
      ) VALUES (
        ${id},
        ${data.type},
        ${data.value.trim()},
        ${data.label.trim()},
        ${data.hubspotValue?.trim() || ""},
        ${data.localDevelopmentId || null},
        ${data.active ?? true},
        ${data.sortOrder || 0},
        NOW()
      )
      ON CONFLICT (type, lower(value)) DO UPDATE SET
        label = EXCLUDED.label,
        hubspot_value = EXCLUDED.hubspot_value,
        local_development_id = EXCLUDED.local_development_id,
        active = EXCLUDED.active,
        sort_order = EXCLUDED.sort_order,
        updated_at = NOW()
      RETURNING
        crm_data_properties.*,
        NULL::text AS local_development_name
    `;

    return {
      property: rows[0] ? mapCrmDataProperty(rows[0] as unknown as Parameters<typeof mapCrmDataProperty>[0]) : null,
      error: null,
    };
  } catch (error) {
    console.error("Error saving CRM data property:", error);
    return {
      property: null,
      error: error instanceof Error ? error.message : "No se pudo guardar la propiedad",
    };
  } finally {
    try {
      await sql?.end();
    } catch {}
  }
}

export async function deleteCrmDataProperty(id: string) {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    await ensureCrmDataPropertiesSchema();
    sql = getPgConnection();
    await sql`DELETE FROM crm_data_properties WHERE id = ${id}`;
    return { success: true, error: null };
  } catch (error) {
    console.error("Error deleting CRM data property:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "No se pudo eliminar la propiedad",
    };
  } finally {
    try {
      await sql?.end();
    } catch {}
  }
}

function mapCrmLead(row: CrmLeadRow): CrmLead {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    countryCode: row.country_code || "+54",
    phone: row.phone || "",
    status: row.status,
    temperature: row.temperature || "",
    source: row.source || "",
    developmentId: row.development_id || undefined,
    developmentName: row.development_name_text || row.development_name || undefined,
    developmentNameText: row.development_name_text || undefined,
    assignedAgentId: row.assigned_agent_id || undefined,
    assignedAgentName: row.assigned_agent_name || undefined,
    notes: row.notes || undefined,
    hubspotObjectId: row.hubspot_object_id || undefined,
    hubspotProperties: row.hubspot_properties || undefined,
    metaLeadId: row.meta_lead_id || undefined,
    metaFormId: row.meta_form_id || undefined,
    metaPageId: row.meta_page_id || undefined,
    metaProperties: row.meta_properties || undefined,
    createdBy: row.created_by || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getCrmLeads(options?: {
  agentId?: string;
  includeAll?: boolean;
}): Promise<CrmLead[]> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    sql = getPgConnection();
    const rows = options?.includeAll
      ? await sql`
          SELECT
            l.*,
            d.name AS development_name,
            a.name AS assigned_agent_name
          FROM crm_leads l
          LEFT JOIN developments d ON d.id = l.development_id
          LEFT JOIN agents a ON a.id = l.assigned_agent_id
          ORDER BY l.updated_at DESC
          LIMIT 5000
        `
      : await sql`
          SELECT
            l.*,
            d.name AS development_name,
            a.name AS assigned_agent_name
          FROM crm_leads l
          LEFT JOIN developments d ON d.id = l.development_id
          LEFT JOIN agents a ON a.id = l.assigned_agent_id
          WHERE l.assigned_agent_id = ${options?.agentId || ""}
          ORDER BY l.updated_at DESC
          LIMIT 5000
        `;

    return (rows as unknown as CrmLeadRow[]).map(mapCrmLead);
  } catch (error) {
    console.error("Error fetching CRM leads:", error);
    return [];
  } finally {
    try {
      await sql?.end();
    } catch {}
  }
}

export type CrmLeadPageOptions = {
  agentId?: string;
  includeAll?: boolean;
  ownerId?: string;
  status?: string;
  query?: string;
  page?: number;
  pageSize?: number;
  sortColumn?: "name" | "email" | "phone" | "whatsapp" | "status" | "temperature" | "development" | "createdAt" | "owner";
  sortDirection?: "asc" | "desc";
};

export async function getCrmLeadsPage(
  options: CrmLeadPageOptions
): Promise<{ leads: CrmLead[]; total: number }> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    sql = getPgConnection();
    const page = Math.max(1, Math.floor(options.page || 1));
    const pageSize = Math.min(500, Math.max(1, Math.floor(options.pageSize || 50)));
    const values: (string | number)[] = [];
    const conditions: string[] = [];
    const addValue = (value: string | number) => {
      values.push(value);
      return `$${values.length}`;
    };

    if (!options.includeAll) {
      conditions.push(`l.assigned_agent_id = ${addValue(options.agentId || "")}::uuid`);
    } else if (options.ownerId && options.ownerId !== "all") {
      conditions.push(`l.assigned_agent_id = ${addValue(options.ownerId)}::uuid`);
    }
    if (options.status && options.status !== "all") {
      conditions.push(`l.status = ${addValue(options.status)}`);
    }
    const needle = options.query?.trim();
    if (needle) {
      const search = addValue(`%${needle}%`);
      conditions.push(`concat_ws(' ', l.first_name, l.last_name, l.email, l.country_code, l.phone, l.status, l.source, l.development_name_text, d.name, a.name) ILIKE ${search}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const sortColumns: Record<NonNullable<CrmLeadPageOptions["sortColumn"]>, string> = {
      name: "lower(concat_ws(' ', l.first_name, l.last_name))",
      email: "lower(COALESCE(l.email, ''))",
      phone: "lower(concat_ws(' ', l.country_code, l.phone))",
      whatsapp: "lower(concat_ws(' ', l.country_code, l.phone))",
      status: "lower(COALESCE(l.status, ''))",
      temperature: "lower(COALESCE(l.temperature, ''))",
      development: "lower(COALESCE(NULLIF(l.development_name_text, ''), d.name, ''))",
      createdAt: "l.created_at",
      owner: "lower(COALESCE(a.name, ''))",
    };
    const orderBy = sortColumns[options.sortColumn || "createdAt"];
    const direction = options.sortDirection === "asc" ? "ASC" : "DESC";

    const countRows = await sql.unsafe(
      `SELECT COUNT(*)::int AS total
       FROM crm_leads l
       LEFT JOIN developments d ON d.id = l.development_id
       LEFT JOIN agents a ON a.id = l.assigned_agent_id
       ${where}`,
      values
    );
    const total = Number(countRows[0]?.total || 0);
    const dataValues = [...values, pageSize, (page - 1) * pageSize];
    const rows = await sql.unsafe(
      `SELECT l.*, d.name AS development_name, a.name AS assigned_agent_name
       FROM crm_leads l
       LEFT JOIN developments d ON d.id = l.development_id
       LEFT JOIN agents a ON a.id = l.assigned_agent_id
       ${where}
       ORDER BY ${orderBy} ${direction}, l.id ASC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      dataValues
    );

    return { leads: (rows as unknown as CrmLeadRow[]).map(mapCrmLead), total };
  } catch (error) {
    console.error("Error fetching paginated CRM leads:", error);
    return { leads: [], total: 0 };
  } finally {
    try { await sql?.end(); } catch {}
  }
}

export async function getCrmLeadById(
  id: string,
  options?: {
    agentId?: string;
    includeAll?: boolean;
  }
): Promise<CrmLead | null> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    sql = getPgConnection();
    const rows = options?.includeAll
      ? await sql`
          SELECT
            l.*,
            d.name AS development_name,
            a.name AS assigned_agent_name
          FROM crm_leads l
          LEFT JOIN developments d ON d.id = l.development_id
          LEFT JOIN agents a ON a.id = l.assigned_agent_id
          WHERE l.id = ${id}
          LIMIT 1
        `
      : await sql`
          SELECT
            l.*,
            d.name AS development_name,
            a.name AS assigned_agent_name
          FROM crm_leads l
          LEFT JOIN developments d ON d.id = l.development_id
          LEFT JOIN agents a ON a.id = l.assigned_agent_id
          WHERE l.id = ${id}
            AND l.assigned_agent_id = ${options?.agentId || ""}
          LIMIT 1
        `;

    return rows[0] ? mapCrmLead(rows[0] as unknown as CrmLeadRow) : null;
  } catch (error) {
    console.error("Error fetching CRM lead by id:", error);
    return null;
  } finally {
    try {
      await sql?.end();
    } catch {}
  }
}

export async function upsertCrmLead(
  data: CrmLeadInput
): Promise<{ lead: CrmLead | null; error: string | null }> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    sql = getPgConnection();

    const id = data.id || crypto.randomUUID();
    const email = data.email.trim().toLowerCase();
    const firstName = formatNamePart(data.firstName);
    const lastName = data.lastName.trim() === "-" ? "-" : formatNamePart(data.lastName);
    const importedCreatedAt =
      data.createdAt && !Number.isNaN(Date.parse(data.createdAt))
        ? new Date(data.createdAt).toISOString()
        : null;
    const rows = await sql`
      INSERT INTO crm_leads (
        id,
        first_name,
        last_name,
        email,
        country_code,
        phone,
        status,
        temperature,
        source,
        development_id,
        development_name_text,
        assigned_agent_id,
        notes,
        hubspot_object_id,
        hubspot_properties,
        meta_lead_id,
        meta_form_id,
        meta_page_id,
        meta_properties,
        created_by,
        created_at,
        updated_at
      ) VALUES (
        ${id},
        ${firstName},
        ${lastName},
        ${email},
        ${data.countryCode.trim() || "+54"},
        ${data.phone.trim()},
        ${data.status},
        ${data.temperature || ""},
        ${data.source?.trim() || ""},
        ${data.developmentId || null},
        ${data.developmentNameText?.trim() || ""},
        ${data.assignedAgentId || null},
        ${data.notes?.trim() || ""},
        ${data.hubspotObjectId || null},
        ${sql.json(data.hubspotProperties || {})},
        ${data.metaLeadId || null},
        ${data.metaFormId || null},
        ${data.metaPageId || null},
        ${sql.json(data.metaProperties || {})},
        ${data.createdBy || null},
        ${importedCreatedAt || new Date().toISOString()},
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        email = EXCLUDED.email,
        country_code = EXCLUDED.country_code,
        phone = EXCLUDED.phone,
        status = EXCLUDED.status,
        temperature = EXCLUDED.temperature,
        source = EXCLUDED.source,
        development_id = EXCLUDED.development_id,
        development_name_text = COALESCE(NULLIF(EXCLUDED.development_name_text, ''), crm_leads.development_name_text),
        assigned_agent_id = EXCLUDED.assigned_agent_id,
        notes = EXCLUDED.notes,
        hubspot_object_id = COALESCE(EXCLUDED.hubspot_object_id, crm_leads.hubspot_object_id),
        hubspot_properties = CASE
          WHEN EXCLUDED.hubspot_properties = '{}'::jsonb THEN crm_leads.hubspot_properties
          ELSE EXCLUDED.hubspot_properties
        END,
        meta_lead_id = COALESCE(EXCLUDED.meta_lead_id, crm_leads.meta_lead_id),
        meta_form_id = COALESCE(EXCLUDED.meta_form_id, crm_leads.meta_form_id),
        meta_page_id = COALESCE(EXCLUDED.meta_page_id, crm_leads.meta_page_id),
        meta_properties = CASE
          WHEN EXCLUDED.meta_properties = '{}'::jsonb THEN crm_leads.meta_properties
          ELSE EXCLUDED.meta_properties
        END,
        created_at = CASE
          WHEN ${Boolean(importedCreatedAt)} THEN EXCLUDED.created_at
          ELSE crm_leads.created_at
        END,
        updated_at = NOW()
      RETURNING
        crm_leads.*,
        NULL::text AS development_name,
        NULL::text AS assigned_agent_name
    `;

    return {
      lead: rows[0] ? mapCrmLead(rows[0] as unknown as CrmLeadRow) : null,
      error: null,
    };
  } catch (error) {
    console.error("Error saving CRM lead:", error);
    const message = error instanceof Error ? error.message : "Error al guardar lead";
    const duplicated = message.toLowerCase().includes("duplicate");
    return {
      lead: null,
      error: duplicated ? "Ya existe un lead con ese mail" : message,
    };
  } finally {
    try {
      await sql?.end();
    } catch {}
  }
}

export async function upsertCrmLeadByEmail(
  data: CrmLeadInput,
  options?: { preserveExistingValues?: boolean; preservePopulatedFields?: boolean }
): Promise<{ lead: CrmLead | null; created: boolean; error: string | null }> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    sql = getPgConnection();

    const email = data.email.trim().toLowerCase();
    const existing = await sql`
      SELECT *
      FROM crm_leads
      WHERE lower(email) = ${email}
      LIMIT 1
    `;
    const existingId = (existing[0]?.id as string | undefined) || undefined;
    const existingDevelopmentId = (existing[0]?.development_id as string | undefined) || undefined;
    const existingDevelopmentNameText = (existing[0]?.development_name_text as string | undefined) || undefined;
    const existingLead = existing[0]
      ? mapCrmLead({
          ...(existing[0] as unknown as CrmLeadRow),
          development_name: null,
          assigned_agent_name: null,
        })
      : null;
    const keep = options?.preserveExistingValues && existingLead;
    const preservePopulated = options?.preservePopulatedFields && existingLead;
    const valueOrExisting = (value: string | undefined, current: string | undefined) =>
      preservePopulated && current?.trim()
        ? current
        : keep && (!value || !value.trim()) ? current || "" : value || "";
    const result = await upsertCrmLead({
      ...data,
      id: existingId,
      firstName: valueOrExisting(data.firstName, existingLead?.firstName) || email.split("@")[0],
      lastName: valueOrExisting(data.lastName, existingLead?.lastName) || "-",
      countryCode: valueOrExisting(data.countryCode, existingLead?.countryCode) || "+54",
      phone: valueOrExisting(data.phone, existingLead?.phone),
      status: (preservePopulated ? existingLead.status : keep && !data.status ? existingLead.status : data.status) || "Nuevo",
      temperature: valueOrExisting(data.temperature, existingLead?.temperature) as CrmLeadTemperature,
      source: valueOrExisting(data.source, existingLead?.source),
      assignedAgentId: preservePopulated && existingLead.assignedAgentId
        ? existingLead.assignedAgentId
        : keep && !data.assignedAgentId
        ? existingLead.assignedAgentId
        : data.assignedAgentId || (!existingId ? data.createdBy || undefined : undefined),
      notes: valueOrExisting(data.notes, existingLead?.notes),
      createdBy: keep ? existingLead.createdBy || data.createdBy : data.createdBy,
      createdAt: keep ? existingLead.createdAt : data.createdAt,
      developmentId: preservePopulated && existingDevelopmentId
        ? existingDevelopmentId
        : data.developmentId === undefined ? existingDevelopmentId : data.developmentId,
      developmentNameText:
        preservePopulated && (existingDevelopmentId || existingDevelopmentNameText?.trim())
          ? existingDevelopmentNameText
          : data.developmentNameText === undefined ? existingDevelopmentNameText : data.developmentNameText,
      metaProperties: mergeMetaProperties(existingLead?.metaProperties, data.metaProperties),
      email,
    });

    return {
      lead: result.lead,
      created: !existingId && !!result.lead,
      error: result.error,
    };
  } catch (error) {
    console.error("Error upserting CRM lead by email:", error);
    const message = error instanceof Error ? error.message : "Error al importar lead";
    return { lead: null, created: false, error: message };
  } finally {
    try {
      await sql?.end();
    } catch {}
  }
}

export async function deleteCrmLead(id: string): Promise<{ success: boolean; error: string | null }> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    sql = getPgConnection();
    await sql`DELETE FROM crm_leads WHERE id = ${id}`;
    return { success: true, error: null };
  } catch (error) {
    console.error("Error deleting CRM lead:", error);
    const message = error instanceof Error ? error.message : "Error al eliminar contacto";
    return { success: false, error: message };
  } finally {
    try {
      await sql?.end();
    } catch {}
  }
}

type CrmActivityRow = {
  id: string;
  lead_id: string;
  type: CrmActivityType;
  title: string;
  body: string | null;
  scheduled_at: string | null;
  created_by: string | null;
  created_by_name: string | null;
  external_source: string | null;
  external_id: string | null;
  created_at: string;
};

async function ensureCrmActivitiesTable(sql: ReturnType<typeof getPgConnection>) {
  await ensureCrmLeadsTable(sql);
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS crm_activities (
      id UUID PRIMARY KEY,
      lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT DEFAULT '',
      scheduled_at TIMESTAMPTZ NULL,
      created_by UUID NULL REFERENCES agents(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await sql.unsafe(`ALTER TABLE crm_activities ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ NULL;`);
  await sql.unsafe(`ALTER TABLE crm_activities ADD COLUMN IF NOT EXISTS created_by UUID NULL REFERENCES agents(id) ON DELETE SET NULL;`);
  await sql.unsafe(`ALTER TABLE crm_activities ADD COLUMN IF NOT EXISTS external_source TEXT NULL;`);
  await sql.unsafe(`ALTER TABLE crm_activities ADD COLUMN IF NOT EXISTS external_id TEXT NULL;`);
  await sql.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_activities_external_unique ON crm_activities (external_source, external_id) WHERE external_source IS NOT NULL AND external_id IS NOT NULL;`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_crm_activities_lead_id ON crm_activities(lead_id);`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_crm_activities_created_at ON crm_activities(created_at DESC);`);
}

async function ensureCrmActivitiesSchema() {
  if (crmActivitiesSchemaReady) return;
  if (!crmActivitiesSchemaPromise) {
    crmActivitiesSchemaPromise = (async () => {
      let sql: ReturnType<typeof getPgConnection> | null = null;
      try {
        sql = getPgConnection();
        await ensureCrmActivitiesTable(sql);
        crmActivitiesSchemaReady = true;
      } finally {
        try {
          await sql?.end();
        } catch {}
        if (!crmActivitiesSchemaReady) crmActivitiesSchemaPromise = null;
      }
    })();
  }
  await crmActivitiesSchemaPromise;
}

function mapCrmActivity(row: CrmActivityRow): CrmActivity {
  return {
    id: row.id,
    leadId: row.lead_id,
    type: row.type,
    title: row.title,
    body: row.body || "",
    scheduledAt: row.scheduled_at || undefined,
    createdBy: row.created_by || undefined,
    createdByName: row.created_by_name || undefined,
    externalSource: row.external_source || undefined,
    externalId: row.external_id || undefined,
    createdAt: row.created_at,
  };
}

export async function getCrmActivities(leadIds: string[]): Promise<CrmActivity[]> {
  if (leadIds.length === 0) return [];

  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    sql = getPgConnection();
    const rows = await sql`
      SELECT
        act.*,
        agents.name AS created_by_name
      FROM crm_activities act
      LEFT JOIN agents ON agents.id = act.created_by
      WHERE act.lead_id = ANY(${leadIds})
      ORDER BY act.created_at DESC
      LIMIT 600
    `;
    return (rows as unknown as CrmActivityRow[]).map(mapCrmActivity);
  } catch (error) {
    console.error("Error fetching CRM activities:", error);
    return [];
  } finally {
    try {
      await sql?.end();
    } catch {}
  }
}

export async function createCrmActivity(data: {
  leadId: string;
  type: CrmActivityType;
  title: string;
  body?: string;
  scheduledAt?: string;
  createdBy?: string | null;
  externalSource?: string | null;
  externalId?: string | null;
}): Promise<{ activity: CrmActivity | null; error: string | null }> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    sql = getPgConnection();
    const rows = await sql`
      INSERT INTO crm_activities (
        id,
        lead_id,
        type,
        title,
        body,
        scheduled_at,
        created_by,
        external_source,
        external_id
      ) VALUES (
        ${crypto.randomUUID()},
        ${data.leadId},
        ${data.type},
        ${data.title.trim()},
        ${data.body?.trim() || ""},
        ${data.scheduledAt || null},
        ${data.createdBy || null},
        ${data.externalSource || null},
        ${data.externalId || null}
      )
      ON CONFLICT (external_source, external_id) WHERE external_source IS NOT NULL AND external_id IS NOT NULL
      DO UPDATE SET
        lead_id = EXCLUDED.lead_id,
        type = EXCLUDED.type,
        title = EXCLUDED.title,
        body = EXCLUDED.body,
        scheduled_at = EXCLUDED.scheduled_at,
        created_by = COALESCE(EXCLUDED.created_by, crm_activities.created_by)
      RETURNING
        crm_activities.*,
        NULL::text AS created_by_name
    `;

    if (rows[0]) {
      await sql`
        UPDATE crm_leads
        SET updated_at = NOW()
        WHERE id = ${data.leadId}
      `;
    }

    return {
      activity: rows[0] ? mapCrmActivity(rows[0] as unknown as CrmActivityRow) : null,
      error: null,
    };
  } catch (error) {
    console.error("Error creating CRM activity:", error);
    return {
      activity: null,
      error: error instanceof Error ? error.message : "Error al guardar actividad",
    };
  } finally {
    try {
      await sql?.end();
    } catch {}
  }
}

export async function deleteCrmActivity(
  id: string,
  options: { agentId?: string; includeAll?: boolean }
): Promise<{ success: boolean; error: string | null }> {
  if (!id) {
    return { success: false, error: "No se pudo eliminar la actividad" };
  }

  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    sql = getPgConnection();
    const rows = options.includeAll
      ? await sql`DELETE FROM crm_activities WHERE id = ${id} RETURNING id`
      : await sql`
          DELETE FROM crm_activities act
          USING crm_leads lead
          WHERE act.id = ${id}
            AND lead.id = act.lead_id
            AND lead.assigned_agent_id = ${options.agentId || ""}
          RETURNING act.id
        `;

    return {
      success: rows.length > 0,
      error: rows.length > 0 ? null : "No se encontró la actividad o no tenés permiso para eliminarla",
    };
  } catch (error) {
    console.error("Error deleting CRM activity:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al eliminar actividad",
    };
  } finally {
    try {
      await sql?.end();
    } catch {}
  }
}

type CrmEmailTrackingRow = {
  id: string;
  tracking_id: string;
  lead_id: string;
  agent_id: string | null;
  recipient_email: string;
  subject: string | null;
  open_count: number;
  first_opened_at: string | null;
  last_opened_at: string | null;
  created_at: string;
  updated_at: string;
};

type CrmEmailAttachmentTrackingRow = {
  id: string;
  tracking_id: string;
  email_tracking_id: string | null;
  lead_id: string;
  agent_id: string | null;
  file_name: string;
  file_url: string;
  open_count: number;
  first_opened_at: string | null;
  last_opened_at: string | null;
  created_at: string;
  updated_at: string;
};

async function ensureCrmEmailTrackingTable(sql: ReturnType<typeof getPgConnection>) {
  await ensureCrmActivitiesTable(sql);
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS crm_email_trackings (
      id UUID PRIMARY KEY,
      tracking_id TEXT NOT NULL UNIQUE,
      lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
      agent_id UUID NULL REFERENCES agents(id) ON DELETE SET NULL,
      recipient_email TEXT NOT NULL,
      subject TEXT DEFAULT '',
      open_count INTEGER NOT NULL DEFAULT 0,
      first_opened_at TIMESTAMPTZ NULL,
      last_opened_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await sql.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_email_trackings_tracking_id ON crm_email_trackings(tracking_id);`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_crm_email_trackings_lead_id ON crm_email_trackings(lead_id);`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_crm_email_trackings_agent_id ON crm_email_trackings(agent_id);`);
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS crm_email_attachment_trackings (
      id UUID PRIMARY KEY,
      tracking_id TEXT NOT NULL UNIQUE,
      email_tracking_id UUID NULL REFERENCES crm_email_trackings(id) ON DELETE CASCADE,
      lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
      agent_id UUID NULL REFERENCES agents(id) ON DELETE SET NULL,
      file_name TEXT NOT NULL,
      file_url TEXT NOT NULL,
      open_count INTEGER NOT NULL DEFAULT 0,
      first_opened_at TIMESTAMPTZ NULL,
      last_opened_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await sql.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_email_attachment_trackings_tracking_id ON crm_email_attachment_trackings(tracking_id);`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_crm_email_attachment_trackings_lead_id ON crm_email_attachment_trackings(lead_id);`);
}

async function ensureCrmEmailTrackingSchema() {
  if (crmEmailTrackingSchemaReady) return;
  if (!crmEmailTrackingSchemaPromise) {
    crmEmailTrackingSchemaPromise = (async () => {
      let sql: ReturnType<typeof getPgConnection> | null = null;
      try {
        sql = getPgConnection();
        await ensureCrmEmailTrackingTable(sql);
        crmEmailTrackingSchemaReady = true;
      } finally {
        try {
          await sql?.end();
        } catch {}
        if (!crmEmailTrackingSchemaReady) crmEmailTrackingSchemaPromise = null;
      }
    })();
  }
  await crmEmailTrackingSchemaPromise;
}

function mapCrmEmailTracking(row: CrmEmailTrackingRow): CrmEmailTracking {
  return {
    id: row.id,
    trackingId: row.tracking_id,
    leadId: row.lead_id,
    agentId: row.agent_id || undefined,
    recipientEmail: row.recipient_email,
    subject: row.subject || "",
    openCount: Number(row.open_count || 0),
    firstOpenedAt: row.first_opened_at || undefined,
    lastOpenedAt: row.last_opened_at || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCrmEmailAttachmentTracking(row: CrmEmailAttachmentTrackingRow): CrmEmailAttachmentTracking {
  return {
    id: row.id,
    trackingId: row.tracking_id,
    emailTrackingId: row.email_tracking_id || undefined,
    leadId: row.lead_id,
    agentId: row.agent_id || undefined,
    fileName: row.file_name,
    fileUrl: row.file_url,
    openCount: Number(row.open_count || 0),
    firstOpenedAt: row.first_opened_at || undefined,
    lastOpenedAt: row.last_opened_at || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createCrmEmailTracking(data: {
  leadId: string;
  agentId?: string | null;
  recipientEmail: string;
  subject: string;
}): Promise<{ tracking: CrmEmailTracking | null; error: string | null }> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    await ensureCrmEmailTrackingSchema();
    sql = getPgConnection();
    const rows = await sql`
      INSERT INTO crm_email_trackings (
        id,
        tracking_id,
        lead_id,
        agent_id,
        recipient_email,
        subject
      ) VALUES (
        ${crypto.randomUUID()},
        ${crypto.randomUUID()},
        ${data.leadId},
        ${data.agentId || null},
        ${data.recipientEmail.trim()},
        ${data.subject.trim()}
      )
      RETURNING *
    `;

    return {
      tracking: rows[0] ? mapCrmEmailTracking(rows[0] as unknown as CrmEmailTrackingRow) : null,
      error: null,
    };
  } catch (error) {
    console.error("Error creating CRM email tracking:", error);
    return {
      tracking: null,
      error: error instanceof Error ? error.message : "Error al crear tracking de correo",
    };
  } finally {
    try {
      await sql?.end();
    } catch {}
  }
}

export async function getCrmEmailTrackingsForLead(leadId: string): Promise<CrmEmailTracking[]> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    await ensureCrmEmailTrackingSchema();
    sql = getPgConnection();
    const rows = await sql`
      SELECT *
      FROM crm_email_trackings
      WHERE lead_id = ${leadId}
      ORDER BY created_at DESC
    `;
    return rows.map((row) => mapCrmEmailTracking(row as unknown as CrmEmailTrackingRow));
  } catch (error) {
    console.error("Error loading CRM email tracking:", error);
    return [];
  } finally {
    try {
      await sql?.end();
    } catch {}
  }
}

export async function createCrmEmailAttachmentTracking(data: {
  emailTrackingId?: string | null;
  leadId: string;
  agentId?: string | null;
  fileName: string;
  fileUrl: string;
}): Promise<{ tracking: CrmEmailAttachmentTracking | null; error: string | null }> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    await ensureCrmEmailTrackingSchema();
    sql = getPgConnection();
    const rows = await sql`
      INSERT INTO crm_email_attachment_trackings (
        id,
        tracking_id,
        email_tracking_id,
        lead_id,
        agent_id,
        file_name,
        file_url
      ) VALUES (
        ${crypto.randomUUID()},
        ${crypto.randomUUID()},
        ${data.emailTrackingId || null},
        ${data.leadId},
        ${data.agentId || null},
        ${data.fileName.trim()},
        ${data.fileUrl.trim()}
      )
      RETURNING *
    `;

    return {
      tracking: rows[0] ? mapCrmEmailAttachmentTracking(rows[0] as unknown as CrmEmailAttachmentTrackingRow) : null,
      error: null,
    };
  } catch (error) {
    console.error("Error creating CRM email attachment tracking:", error);
    return {
      tracking: null,
      error: error instanceof Error ? error.message : "Error al crear tracking de adjunto",
    };
  } finally {
    try {
      await sql?.end();
    } catch {}
  }
}

export async function registerCrmEmailOpen(
  trackingId: string
): Promise<{ tracking: CrmEmailTracking | null; activity: CrmActivity | null; error: string | null }> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    await ensureCrmEmailTrackingSchema();
    sql = getPgConnection();
    const rows = await sql`
      UPDATE crm_email_trackings
      SET
        open_count = open_count + 1,
        first_opened_at = COALESCE(first_opened_at, NOW()),
        last_opened_at = NOW(),
        updated_at = NOW()
      WHERE tracking_id = ${trackingId}
        -- Evita contar la vista automática y la apertura inmediata de la copia enviada.
        AND created_at < NOW() - INTERVAL '2 minutes'
        AND (last_opened_at IS NULL OR last_opened_at < NOW() - INTERVAL '15 seconds')
      RETURNING *
    `;
    let tracking = rows[0] ? mapCrmEmailTracking(rows[0] as unknown as CrmEmailTrackingRow) : null;

    if (!tracking) {
      const currentRows = await sql`SELECT * FROM crm_email_trackings WHERE tracking_id = ${trackingId} LIMIT 1`;
      tracking = currentRows[0] ? mapCrmEmailTracking(currentRows[0] as unknown as CrmEmailTrackingRow) : null;
      return tracking
        ? { tracking, activity: null, error: null }
        : { tracking: null, activity: null, error: "Tracking no encontrado" };
    }

    const subjectText = tracking.subject ? `: ${tracking.subject}` : "";
    const countLabel = tracking.openCount === 1 ? "1 vez" : `${tracking.openCount} veces`;
    const { activity } = await createCrmActivity({
      leadId: tracking.leadId,
      type: "correo",
      title: `Correo abierto ${countLabel}`,
      body: `El cliente abrió el correo${subjectText}.\nAperturas registradas: ${tracking.openCount}.`,
      createdBy: tracking.agentId || null,
    });

    return { tracking, activity, error: null };
  } catch (error) {
    console.error("Error registering CRM email open:", error);
    return {
      tracking: null,
      activity: null,
      error: error instanceof Error ? error.message : "Error al registrar apertura de correo",
    };
  } finally {
    try {
      await sql?.end();
    } catch {}
  }
}

export async function registerCrmEmailAttachmentOpen(
  trackingId: string
): Promise<{ tracking: CrmEmailAttachmentTracking | null; activity: CrmActivity | null; error: string | null }> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    await ensureCrmEmailTrackingSchema();
    sql = getPgConnection();
    const rows = await sql`
      UPDATE crm_email_attachment_trackings
      SET
        open_count = open_count + 1,
        first_opened_at = COALESCE(first_opened_at, NOW()),
        last_opened_at = NOW(),
        updated_at = NOW()
      WHERE tracking_id = ${trackingId}
      RETURNING *
    `;
    const tracking = rows[0]
      ? mapCrmEmailAttachmentTracking(rows[0] as unknown as CrmEmailAttachmentTrackingRow)
      : null;

    if (!tracking) {
      return { tracking: null, activity: null, error: "Tracking de adjunto no encontrado" };
    }

    const countLabel = tracking.openCount === 1 ? "1 vez" : `${tracking.openCount} veces`;
    const { activity } = await createCrmActivity({
      leadId: tracking.leadId,
      type: "correo",
      title: `Adjunto abierto ${countLabel}`,
      body: `El cliente abrió el archivo "${tracking.fileName}".\nAperturas registradas: ${tracking.openCount}.`,
      createdBy: tracking.agentId || null,
    });

    return { tracking, activity, error: null };
  } catch (error) {
    console.error("Error registering CRM email attachment open:", error);
    return {
      tracking: null,
      activity: null,
      error: error instanceof Error ? error.message : "Error al registrar apertura de adjunto",
    };
  } finally {
    try {
      await sql?.end();
    } catch {}
  }
}

async function ensureCrmEmailAccountsTable(sql: ReturnType<typeof getPgConnection>) {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS crm_email_accounts (
      id UUID PRIMARY KEY,
      agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      provider TEXT NOT NULL DEFAULT 'gmail',
      email TEXT NOT NULL,
      from_name TEXT DEFAULT '',
      smtp_host TEXT NOT NULL,
      smtp_port INTEGER NOT NULL DEFAULT 587,
      smtp_secure BOOLEAN NOT NULL DEFAULT false,
      smtp_user TEXT NOT NULL,
      encrypted_password TEXT NOT NULL,
      signature TEXT DEFAULT '',
      google_scopes TEXT DEFAULT '',
      connected_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await sql.unsafe(`ALTER TABLE crm_email_accounts ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'gmail';`);
  await sql.unsafe(`ALTER TABLE crm_email_accounts ADD COLUMN IF NOT EXISTS from_name TEXT DEFAULT '';`);
  await sql.unsafe(`ALTER TABLE crm_email_accounts ADD COLUMN IF NOT EXISTS signature TEXT DEFAULT '';`);
  await sql.unsafe(`ALTER TABLE crm_email_accounts ADD COLUMN IF NOT EXISTS google_scopes TEXT DEFAULT '';`);
  await sql.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_email_accounts_agent_id ON crm_email_accounts(agent_id);`);
}

async function ensureCrmEmailAccountsSchema() {
  if (crmEmailAccountsSchemaReady) return;
  if (!crmEmailAccountsSchemaPromise) {
    crmEmailAccountsSchemaPromise = (async () => {
      let sql: ReturnType<typeof getPgConnection> | null = null;
      try {
        sql = getPgConnection();
        await ensureCrmEmailAccountsTable(sql);
        crmEmailAccountsSchemaReady = true;
      } finally {
        try {
          await sql?.end();
        } catch {}
        if (!crmEmailAccountsSchemaReady) crmEmailAccountsSchemaPromise = null;
      }
    })();
  }
  await crmEmailAccountsSchemaPromise;
}

function mapCrmEmailAccount(row: CrmEmailAccountRow): CrmEmailAccount {
  return {
    id: row.id,
    agentId: row.agent_id,
    provider: row.provider,
    email: row.email,
    fromName: row.from_name || "",
    smtpHost: row.smtp_host,
    smtpPort: Number(row.smtp_port),
    smtpSecure: Boolean(row.smtp_secure),
    smtpUser: row.smtp_user,
    signature: row.signature || "",
    googleScopes: row.google_scopes || undefined,
    connectedAt: row.connected_at,
    updatedAt: row.updated_at,
  };
}

export async function getCrmEmailAccount(agentId: string): Promise<CrmEmailAccount | null> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    await ensureCrmEmailAccountsSchema();
    sql = getPgConnection();
    const rows = await sql`
      SELECT *
      FROM crm_email_accounts
      WHERE agent_id = ${agentId}
      LIMIT 1
    `;
    return rows[0] ? mapCrmEmailAccount(rows[0] as unknown as CrmEmailAccountRow) : null;
  } catch (error) {
    console.error("Error fetching CRM email account:", error);
    return null;
  } finally {
    try {
      await sql?.end();
    } catch {}
  }
}

export async function getCrmEmailAccountWithSecret(
  agentId: string
): Promise<CrmEmailAccountWithSecret | null> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    await ensureCrmEmailAccountsSchema();
    sql = getPgConnection();
    const rows = await sql`
      SELECT *
      FROM crm_email_accounts
      WHERE agent_id = ${agentId}
      LIMIT 1
    `;
    if (!rows[0]) return null;
    const row = rows[0] as unknown as CrmEmailAccountRow;
    if (!row.encrypted_password) return null;
    return {
      ...mapCrmEmailAccount(row),
      smtpPassword: decryptCrmEmailSecret(row.encrypted_password),
    };
  } catch (error) {
    console.error("Error fetching CRM email account with secret:", error);
    return null;
  } finally {
    try {
      await sql?.end();
    } catch {}
  }
}

export async function upsertCrmEmailAccount(
  data: CrmEmailAccountInput
): Promise<{ account: CrmEmailAccount | null; error: string | null }> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    await ensureCrmEmailAccountsSchema();
    sql = getPgConnection();
    const rows = await sql`
      INSERT INTO crm_email_accounts (
        id,
        agent_id,
        provider,
        email,
        from_name,
        smtp_host,
        smtp_port,
        smtp_secure,
        smtp_user,
        encrypted_password,
        signature,
        google_scopes,
        updated_at
      ) VALUES (
        ${crypto.randomUUID()},
        ${data.agentId},
        ${data.provider || "gmail"},
        ${data.email.trim().toLowerCase()},
        ${data.fromName?.trim() || ""},
        ${data.smtpHost.trim()},
        ${data.smtpPort},
        ${data.smtpSecure},
        ${data.smtpUser.trim()},
        ${encryptCrmEmailSecret(normalizeSmtpPassword(data.provider, data.smtpPassword))},
        ${data.signature?.trim() || ""},
        ${data.googleScopes?.trim() || ""},
        NOW()
      )
      ON CONFLICT (agent_id) DO UPDATE SET
        provider = EXCLUDED.provider,
        email = EXCLUDED.email,
        from_name = EXCLUDED.from_name,
        smtp_host = EXCLUDED.smtp_host,
        smtp_port = EXCLUDED.smtp_port,
        smtp_secure = EXCLUDED.smtp_secure,
        smtp_user = EXCLUDED.smtp_user,
        encrypted_password = EXCLUDED.encrypted_password,
        signature = EXCLUDED.signature,
        google_scopes = EXCLUDED.google_scopes,
        updated_at = NOW()
      RETURNING *
    `;

    return {
      account: rows[0] ? mapCrmEmailAccount(rows[0] as unknown as CrmEmailAccountRow) : null,
      error: null,
    };
  } catch (error) {
    console.error("Error saving CRM email account:", error);
    return {
      account: null,
      error: error instanceof Error ? error.message : "No se pudo conectar el correo",
    };
  } finally {
    try {
      await sql?.end();
    } catch {}
  }
}

async function ensureCrmEmailTemplatesTable(sql: ReturnType<typeof getPgConnection>) {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS crm_email_templates (
      id UUID PRIMARY KEY,
      channel TEXT NOT NULL DEFAULT 'email',
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'General',
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      image_urls TEXT[] NOT NULL DEFAULT '{}',
      content_blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_by UUID NULL REFERENCES agents(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await sql.unsafe(`ALTER TABLE crm_email_templates ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'email';`);
  await sql.unsafe(`ALTER TABLE crm_email_templates ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'General';`);
  await sql.unsafe(`ALTER TABLE crm_email_templates ADD COLUMN IF NOT EXISTS image_urls TEXT[] NOT NULL DEFAULT '{}';`);
  await sql.unsafe(`ALTER TABLE crm_email_templates ADD COLUMN IF NOT EXISTS content_blocks JSONB NOT NULL DEFAULT '[]'::jsonb;`);
  await sql.unsafe(`ALTER TABLE crm_email_templates ADD COLUMN IF NOT EXISTS created_by UUID NULL REFERENCES agents(id) ON DELETE SET NULL;`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_crm_email_templates_updated_at ON crm_email_templates(updated_at DESC);`);
}

async function ensureCrmEmailTemplatesSchema() {
  if (crmEmailTemplatesSchemaReady) return;
  if (!crmEmailTemplatesSchemaPromise) {
    crmEmailTemplatesSchemaPromise = (async () => {
      let sql: ReturnType<typeof getPgConnection> | null = null;
      try {
        sql = getPgConnection();
        await ensureCrmEmailTemplatesTable(sql);
        crmEmailTemplatesSchemaReady = true;
      } finally {
        try {
          await sql?.end();
        } catch {}
        if (!crmEmailTemplatesSchemaReady) crmEmailTemplatesSchemaPromise = null;
      }
    })();
  }
  await crmEmailTemplatesSchemaPromise;
}

function mapCrmEmailTemplate(row: CrmEmailTemplateRow): CrmEmailTemplate {
  return {
    id: row.id,
    channel: row.channel === "whatsapp" ? "whatsapp" : "email",
    name: row.name,
    category: row.category || "General",
    subject: row.subject,
    body: row.body,
    imageUrls: row.image_urls || [],
    contentBlocks: Array.isArray(row.content_blocks) ? row.content_blocks : [],
    createdBy: row.created_by || undefined,
    createdByName: row.created_by_name || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getCrmEmailTemplates(): Promise<CrmEmailTemplate[]> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    await ensureCrmEmailTemplatesSchema();
    sql = getPgConnection();
    const rows = await sql`
      SELECT
        t.*,
        a.name AS created_by_name
      FROM crm_email_templates t
      LEFT JOIN agents a ON a.id = t.created_by
      ORDER BY t.updated_at DESC
      LIMIT 200
    `;
    return (rows as unknown as CrmEmailTemplateRow[]).map(mapCrmEmailTemplate);
  } catch (error) {
    console.error("Error fetching CRM email templates:", error);
    return [];
  } finally {
    try {
      await sql?.end();
    } catch {}
  }
}

export async function getCrmEmailTemplateById(id: string): Promise<CrmEmailTemplate | null> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    await ensureCrmEmailTemplatesSchema();
    sql = getPgConnection();
    const rows = await sql`
      SELECT
        t.*,
        a.name AS created_by_name
      FROM crm_email_templates t
      LEFT JOIN agents a ON a.id = t.created_by
      WHERE t.id = ${id}
      LIMIT 1
    `;
    return rows[0] ? mapCrmEmailTemplate(rows[0] as unknown as CrmEmailTemplateRow) : null;
  } catch (error) {
    console.error("Error fetching CRM email template:", error);
    return null;
  } finally {
    try {
      await sql?.end();
    } catch {}
  }
}

export async function upsertCrmEmailTemplate(
  data: CrmEmailTemplateInput
): Promise<{ template: CrmEmailTemplate | null; error: string | null }> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    await ensureCrmEmailTemplatesSchema();
    sql = getPgConnection();
    const id = data.id || crypto.randomUUID();
    const rows = await sql`
      INSERT INTO crm_email_templates (
        id,
        channel,
        name,
        category,
        subject,
        body,
        image_urls,
        content_blocks,
        created_by,
        updated_at
      ) VALUES (
        ${id},
        ${data.channel === "whatsapp" ? "whatsapp" : "email"},
        ${data.name.trim()},
        ${data.category?.trim() || "General"},
        ${data.subject.trim()},
        ${data.body.trim()},
        ${data.imageUrls || []},
        ${sql.json(data.contentBlocks || [])},
        ${data.createdBy || null},
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        channel = EXCLUDED.channel,
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        subject = EXCLUDED.subject,
        body = EXCLUDED.body,
        image_urls = EXCLUDED.image_urls,
        content_blocks = EXCLUDED.content_blocks,
        updated_at = NOW()
      RETURNING
        crm_email_templates.*,
        NULL::text AS created_by_name
    `;
    return {
      template: rows[0] ? mapCrmEmailTemplate(rows[0] as unknown as CrmEmailTemplateRow) : null,
      error: null,
    };
  } catch (error) {
    console.error("Error saving CRM email template:", error);
    return {
      template: null,
      error: error instanceof Error ? error.message : "Error al guardar plantilla",
    };
  } finally {
    try {
      await sql?.end();
    } catch {}
  }
}

export async function deleteCrmEmailTemplate(id: string): Promise<{ success: boolean; error: string | null }> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    await ensureCrmEmailTemplatesSchema();
    sql = getPgConnection();
    await sql`DELETE FROM crm_email_templates WHERE id = ${id}`;
    return { success: true, error: null };
  } catch (error) {
    console.error("Error deleting CRM email template:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al eliminar plantilla",
    };
  } finally {
    try {
      await sql?.end();
    } catch {}
  }
}

// ============================================================
// CRM WORKFLOWS
// ============================================================

async function ensureCrmWorkflowsTable(sql: ReturnType<typeof getPgConnection>) {
  await ensureCrmLeadsTable(sql);
  await ensureCrmEmailTemplatesTable(sql);
  await ensureCrmActivitiesTable(sql);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS crm_workflows (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      trigger_type TEXT NOT NULL DEFAULT 'lead_status_changed',
      trigger_status TEXT NOT NULL,
      action_type TEXT NOT NULL DEFAULT 'send_email_template',
      template_id UUID NOT NULL REFERENCES crm_email_templates(id) ON DELETE RESTRICT,
      run_once_per_lead BOOLEAN NOT NULL DEFAULT TRUE,
      delivery_delay_hours INTEGER NOT NULL DEFAULT 0,
      repeat_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      created_by UUID NULL REFERENCES agents(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await sql.unsafe(`ALTER TABLE crm_workflows ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;`);
  await sql.unsafe(`ALTER TABLE crm_workflows ADD COLUMN IF NOT EXISTS trigger_type TEXT NOT NULL DEFAULT 'lead_status_changed';`);
  await sql.unsafe(`ALTER TABLE crm_workflows ADD COLUMN IF NOT EXISTS action_type TEXT NOT NULL DEFAULT 'send_email_template';`);
  await sql.unsafe(`ALTER TABLE crm_workflows ADD COLUMN IF NOT EXISTS run_once_per_lead BOOLEAN NOT NULL DEFAULT TRUE;`);
  await sql.unsafe(`ALTER TABLE crm_workflows ADD COLUMN IF NOT EXISTS delivery_delay_hours INTEGER NOT NULL DEFAULT 0;`);
  await sql.unsafe(`ALTER TABLE crm_workflows ADD COLUMN IF NOT EXISTS repeat_enabled BOOLEAN NOT NULL DEFAULT FALSE;`);
  await sql.unsafe(`ALTER TABLE crm_workflows ADD COLUMN IF NOT EXISTS created_by UUID NULL REFERENCES agents(id) ON DELETE SET NULL;`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_crm_workflows_trigger ON crm_workflows(active, trigger_type, trigger_status);`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_crm_workflows_updated_at ON crm_workflows(updated_at DESC);`);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS crm_workflow_executions (
      id UUID PRIMARY KEY,
      workflow_id UUID NOT NULL REFERENCES crm_workflows(id) ON DELETE CASCADE,
      lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
      previous_status TEXT NULL,
      next_status TEXT NOT NULL,
      action_type TEXT NOT NULL,
      template_id UUID NULL REFERENCES crm_email_templates(id) ON DELETE SET NULL,
      activity_id UUID NULL REFERENCES crm_activities(id) ON DELETE SET NULL,
      success BOOLEAN NOT NULL DEFAULT FALSE,
      error TEXT DEFAULT '',
      executed_by UUID NULL REFERENCES agents(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await sql.unsafe(`ALTER TABLE crm_workflow_executions ADD COLUMN IF NOT EXISTS previous_status TEXT NULL;`);
  await sql.unsafe(`ALTER TABLE crm_workflow_executions ADD COLUMN IF NOT EXISTS next_status TEXT NOT NULL DEFAULT '';`);
  await sql.unsafe(`ALTER TABLE crm_workflow_executions ADD COLUMN IF NOT EXISTS action_type TEXT NOT NULL DEFAULT 'send_email_template';`);
  await sql.unsafe(`ALTER TABLE crm_workflow_executions ADD COLUMN IF NOT EXISTS template_id UUID NULL REFERENCES crm_email_templates(id) ON DELETE SET NULL;`);
  await sql.unsafe(`ALTER TABLE crm_workflow_executions ADD COLUMN IF NOT EXISTS activity_id UUID NULL REFERENCES crm_activities(id) ON DELETE SET NULL;`);
  await sql.unsafe(`ALTER TABLE crm_workflow_executions ADD COLUMN IF NOT EXISTS success BOOLEAN NOT NULL DEFAULT FALSE;`);
  await sql.unsafe(`ALTER TABLE crm_workflow_executions ADD COLUMN IF NOT EXISTS error TEXT DEFAULT '';`);
  await sql.unsafe(`ALTER TABLE crm_workflow_executions ADD COLUMN IF NOT EXISTS executed_by UUID NULL REFERENCES agents(id) ON DELETE SET NULL;`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_crm_workflow_executions_lead ON crm_workflow_executions(lead_id, created_at DESC);`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_crm_workflow_executions_workflow ON crm_workflow_executions(workflow_id, lead_id);`);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS crm_workflow_jobs (
      id UUID PRIMARY KEY,
      workflow_id UUID NOT NULL REFERENCES crm_workflows(id) ON DELETE CASCADE,
      lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
      previous_status TEXT NULL,
      next_status TEXT NOT NULL,
      executed_by UUID NULL REFERENCES agents(id) ON DELETE SET NULL,
      scheduled_for TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      error TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_crm_workflow_jobs_due ON crm_workflow_jobs(status, scheduled_for);`);
  await sql.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_workflow_jobs_pending_unique ON crm_workflow_jobs(workflow_id, lead_id) WHERE status IN ('pending', 'processing');`);
}

async function ensureCrmWorkflowsSchema() {
  if (crmWorkflowsSchemaReady) return;
  if (!crmWorkflowsSchemaPromise) {
    crmWorkflowsSchemaPromise = (async () => {
      let sql: ReturnType<typeof getPgConnection> | null = null;
      try {
        sql = getPgConnection();
        await ensureCrmWorkflowsTable(sql);
        crmWorkflowsSchemaReady = true;
      } finally {
        try {
          await sql?.end();
        } catch {}
        if (!crmWorkflowsSchemaReady) crmWorkflowsSchemaPromise = null;
      }
    })();
  }
  await crmWorkflowsSchemaPromise;
}

function mapCrmWorkflow(row: CrmWorkflowRow): CrmWorkflow {
  return {
    id: row.id,
    name: row.name,
    active: row.active,
    triggerType: row.trigger_type,
    triggerStatus: row.trigger_status,
    actionType: row.action_type,
    templateId: row.template_id,
    templateName: row.template_name || undefined,
    templateSubject: row.template_subject || undefined,
    runOncePerLead: row.run_once_per_lead,
    deliveryDelayHours: row.delivery_delay_hours || 0,
    repeatEnabled: row.repeat_enabled || false,
    createdBy: row.created_by || undefined,
    createdByName: row.created_by_name || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCrmWorkflowExecution(row: CrmWorkflowExecutionRow): CrmWorkflowExecution {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    leadId: row.lead_id,
    previousStatus: row.previous_status || undefined,
    nextStatus: row.next_status,
    actionType: row.action_type,
    templateId: row.template_id || undefined,
    activityId: row.activity_id || undefined,
    success: row.success,
    error: row.error || undefined,
    executedBy: row.executed_by || undefined,
    createdAt: row.created_at,
  };
}

export async function getCrmWorkflows(): Promise<CrmWorkflow[]> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    await ensureCrmWorkflowsSchema();
    sql = getPgConnection();
    const rows = await sql`
      SELECT
        w.*,
        t.name AS template_name,
        t.subject AS template_subject,
        a.name AS created_by_name
      FROM crm_workflows w
      LEFT JOIN crm_email_templates t ON t.id = w.template_id
      LEFT JOIN agents a ON a.id = w.created_by
      ORDER BY w.updated_at DESC
      LIMIT 200
    `;
    return (rows as unknown as CrmWorkflowRow[]).map(mapCrmWorkflow);
  } catch (error) {
    console.error("Error fetching CRM workflows:", error);
    return [];
  } finally {
    try {
      await sql?.end();
    } catch {}
  }
}

export async function getActiveCrmWorkflowsForLeadStatus(
  status: CrmLeadStatus
): Promise<CrmWorkflow[]> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    await ensureCrmWorkflowsSchema();
    sql = getPgConnection();
    const rows = await sql`
      SELECT
        w.*,
        t.name AS template_name,
        t.subject AS template_subject,
        a.name AS created_by_name
      FROM crm_workflows w
      LEFT JOIN crm_email_templates t ON t.id = w.template_id
      LEFT JOIN agents a ON a.id = w.created_by
      WHERE w.active = TRUE
        AND w.trigger_type = 'lead_status_changed'
        AND w.trigger_status = ${status}
      ORDER BY w.updated_at DESC
      LIMIT 20
    `;
    return (rows as unknown as CrmWorkflowRow[]).map(mapCrmWorkflow);
  } catch (error) {
    console.error("Error fetching active CRM workflows:", error);
    return [];
  } finally {
    try {
      await sql?.end();
    } catch {}
  }
}

export async function upsertCrmWorkflow(
  data: CrmWorkflowInput
): Promise<{ workflow: CrmWorkflow | null; error: string | null }> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    await ensureCrmWorkflowsSchema();
    sql = getPgConnection();
    const id = data.id || crypto.randomUUID();
    const rows = await sql`
      INSERT INTO crm_workflows (
        id,
        name,
        active,
        trigger_type,
        trigger_status,
        action_type,
        template_id,
        run_once_per_lead,
        delivery_delay_hours,
        repeat_enabled,
        created_by,
        updated_at
      ) VALUES (
        ${id},
        ${data.name.trim()},
        ${data.active ?? true},
        ${data.triggerType || "lead_status_changed"},
        ${data.triggerStatus},
        ${data.actionType || "send_email_template"},
        ${data.templateId},
        ${data.runOncePerLead ?? true},
        ${data.deliveryDelayHours ?? 0},
        ${data.repeatEnabled ?? false},
        ${data.createdBy || null},
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        active = EXCLUDED.active,
        trigger_type = EXCLUDED.trigger_type,
        trigger_status = EXCLUDED.trigger_status,
        action_type = EXCLUDED.action_type,
        template_id = EXCLUDED.template_id,
        run_once_per_lead = EXCLUDED.run_once_per_lead,
        delivery_delay_hours = EXCLUDED.delivery_delay_hours,
        repeat_enabled = EXCLUDED.repeat_enabled,
        updated_at = NOW()
      RETURNING
        crm_workflows.*,
        NULL::text AS template_name,
        NULL::text AS template_subject,
        NULL::text AS created_by_name
    `;
    return {
      workflow: rows[0] ? mapCrmWorkflow(rows[0] as unknown as CrmWorkflowRow) : null,
      error: null,
    };
  } catch (error) {
    console.error("Error saving CRM workflow:", error);
    return {
      workflow: null,
      error: error instanceof Error ? error.message : "No se pudo guardar el workflow",
    };
  } finally {
    try {
      await sql?.end();
    } catch {}
  }
}

export async function deleteCrmWorkflow(id: string): Promise<{ success: boolean; error: string | null }> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    await ensureCrmWorkflowsSchema();
    sql = getPgConnection();
    await sql`DELETE FROM crm_workflows WHERE id = ${id}`;
    return { success: true, error: null };
  } catch (error) {
    console.error("Error deleting CRM workflow:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "No se pudo eliminar el workflow",
    };
  } finally {
    try {
      await sql?.end();
    } catch {}
  }
}

export async function scheduleCrmWorkflowJob(data: {
  workflowId: string;
  leadId: string;
  previousStatus?: CrmLeadStatus;
  nextStatus: CrmLeadStatus;
  executedBy?: string | null;
  scheduledFor: string;
}): Promise<{ scheduled: boolean; error: string | null }> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    await ensureCrmWorkflowsSchema();
    sql = getPgConnection();
    const rows = await sql`
      INSERT INTO crm_workflow_jobs (
        id, workflow_id, lead_id, previous_status, next_status, executed_by, scheduled_for
      ) VALUES (
        ${crypto.randomUUID()}, ${data.workflowId}, ${data.leadId},
        ${data.previousStatus || null}, ${data.nextStatus}, ${data.executedBy || null}, ${data.scheduledFor}
      )
      ON CONFLICT DO NOTHING
      RETURNING id
    `;
    return { scheduled: rows.length > 0, error: null };
  } catch (error) {
    return { scheduled: false, error: error instanceof Error ? error.message : "No se pudo programar el workflow" };
  } finally {
    try { await sql?.end(); } catch {}
  }
}

export async function hasPendingCrmWorkflowJob(workflowId: string, leadId: string): Promise<boolean> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    await ensureCrmWorkflowsSchema();
    sql = getPgConnection();
    const rows = await sql`
      SELECT id FROM crm_workflow_jobs
      WHERE workflow_id = ${workflowId} AND lead_id = ${leadId}
        AND status IN ('pending', 'processing')
      LIMIT 1
    `;
    return rows.length > 0;
  } finally {
    try { await sql?.end(); } catch {}
  }
}

export async function claimDueCrmWorkflowJobs(limit = 25): Promise<CrmWorkflowJob[]> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    await ensureCrmWorkflowsSchema();
    sql = getPgConnection();
    await sql`UPDATE crm_workflow_jobs SET status='pending', updated_at=NOW() WHERE status='processing' AND updated_at < NOW() - INTERVAL '15 minutes'`;
    const rows = await sql`
      UPDATE crm_workflow_jobs SET status='processing', attempts=attempts+1, updated_at=NOW()
      WHERE id IN (
        SELECT id FROM crm_workflow_jobs
        WHERE status='pending' AND scheduled_for <= NOW()
        ORDER BY scheduled_for ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `;
    return rows.map((row: any) => ({
      id: row.id,
      workflowId: row.workflow_id,
      leadId: row.lead_id,
      previousStatus: row.previous_status || undefined,
      nextStatus: row.next_status,
      executedBy: row.executed_by || undefined,
      scheduledFor: row.scheduled_for,
      attempts: row.attempts,
    }));
  } finally {
    try { await sql?.end(); } catch {}
  }
}

export async function completeCrmWorkflowJob(id: string, success: boolean, error = "") {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    await ensureCrmWorkflowsSchema();
    sql = getPgConnection();
    await sql`
      UPDATE crm_workflow_jobs
      SET status=${success ? "sent" : "failed"}, error=${error}, updated_at=NOW()
      WHERE id=${id}
    `;
  } finally {
    try { await sql?.end(); } catch {}
  }
}

export async function cancelCrmWorkflowJob(id: string, reason = "") {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    await ensureCrmWorkflowsSchema();
    sql = getPgConnection();
    await sql`
      UPDATE crm_workflow_jobs
      SET status='cancelled', error=${reason}, updated_at=NOW()
      WHERE id=${id}
    `;
  } finally {
    try { await sql?.end(); } catch {}
  }
}

export async function hasSuccessfulCrmWorkflowExecution(
  workflowId: string,
  leadId: string
): Promise<boolean> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    await ensureCrmWorkflowsSchema();
    sql = getPgConnection();
    const rows = await sql`
      SELECT id
      FROM crm_workflow_executions
      WHERE workflow_id = ${workflowId}
        AND lead_id = ${leadId}
        AND success = TRUE
      LIMIT 1
    `;
    return rows.length > 0;
  } catch (error) {
    console.error("Error checking CRM workflow execution:", error);
    return false;
  } finally {
    try {
      await sql?.end();
    } catch {}
  }
}

export async function createCrmWorkflowExecution(data: {
  workflowId: string;
  leadId: string;
  previousStatus?: CrmLeadStatus;
  nextStatus: CrmLeadStatus;
  actionType?: CrmWorkflowActionType;
  templateId?: string;
  activityId?: string;
  success: boolean;
  error?: string;
  executedBy?: string | null;
}): Promise<{ execution: CrmWorkflowExecution | null; error: string | null }> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    await ensureCrmWorkflowsSchema();
    sql = getPgConnection();
    const rows = await sql`
      INSERT INTO crm_workflow_executions (
        id,
        workflow_id,
        lead_id,
        previous_status,
        next_status,
        action_type,
        template_id,
        activity_id,
        success,
        error,
        executed_by
      ) VALUES (
        ${crypto.randomUUID()},
        ${data.workflowId},
        ${data.leadId},
        ${data.previousStatus || null},
        ${data.nextStatus},
        ${data.actionType || "send_email_template"},
        ${data.templateId || null},
        ${data.activityId || null},
        ${data.success},
        ${data.error?.trim() || ""},
        ${data.executedBy || null}
      )
      RETURNING *
    `;
    return {
      execution: rows[0] ? mapCrmWorkflowExecution(rows[0] as unknown as CrmWorkflowExecutionRow) : null,
      error: null,
    };
  } catch (error) {
    console.error("Error saving CRM workflow execution:", error);
    return {
      execution: null,
      error: error instanceof Error ? error.message : "No se pudo registrar la ejecución",
    };
  } finally {
    try {
      await sql?.end();
    } catch {}
  }
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

// ============================================================
// QUOTES
// ============================================================

export type QuoteRecordPayload = {
  developmentId: string;
  developmentName?: string;
  developmentSlug?: string;
  address?: string;
  location?: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  unitNumber: string;
  floor?: string;
  bedrooms: number;
  bathrooms: number;
  area: number;
  balconyArea?: number;
  totalArea?: number;
  downPayment?: number;
  installmentCount?: number;
  installmentValue?: number;
  price: number;
  expenses?: number;
  currency: string;
  orientation?: string;
  status: "disponible" | "reservada" | "vendida" | "consultar";
  description?: string;
  features: string[];
  comments?: string;
  imageUrls: string[];
  pdfUrl?: string;
};

export type QuoteRecord = {
  id: string;
  developmentId: string;
  developmentName: string;
  developmentSlug: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  unitNumber: string;
  payload: QuoteRecordPayload;
  createdBy?: string;
  canViewClient: boolean;
  canManage: boolean;
  createdAt: string;
  updatedAt: string;
};

export type QuoteRecordInput = {
  id?: string;
  developmentId: string;
  developmentName: string;
  developmentSlug: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  unitNumber: string;
  payload: QuoteRecordPayload;
  createdBy?: string | null;
  viewerRole?: string | null;
};

type QuoteRecordRow = {
  id: string;
  development_id: string;
  development_name: string;
  development_slug: string | null;
  client_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  unit_number: string;
  payload: QuoteRecordPayload;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

let quotesSchemaReady = false;
let quotesSchemaPromise: Promise<void> | null = null;
const QUOTE_IMAGE_LIMIT = 2;

function normalizeQuotePayload(
  payload: Partial<QuoteRecordPayload> | null | undefined,
  fallback: { developmentId: string; unitNumber: string }
): QuoteRecordPayload {
  return {
    developmentId: payload?.developmentId || fallback.developmentId,
    developmentName: payload?.developmentName || undefined,
    developmentSlug: payload?.developmentSlug || undefined,
    address: payload?.address || undefined,
    location: payload?.location || undefined,
    clientName: payload?.clientName || undefined,
    clientPhone: payload?.clientPhone || undefined,
    clientEmail: payload?.clientEmail || undefined,
    unitNumber: payload?.unitNumber || fallback.unitNumber,
    floor: payload?.floor || undefined,
    bedrooms: Number.isFinite(payload?.bedrooms) ? Number(payload?.bedrooms) : 0,
    bathrooms: Number.isFinite(payload?.bathrooms) ? Number(payload?.bathrooms) : 0,
    area: Number.isFinite(payload?.area) ? Number(payload?.area) : 0,
    balconyArea: Number.isFinite(payload?.balconyArea) ? Number(payload?.balconyArea) : undefined,
    totalArea: Number.isFinite(payload?.totalArea) ? Number(payload?.totalArea) : undefined,
    downPayment: Number.isFinite(payload?.downPayment) ? Number(payload?.downPayment) : undefined,
    installmentCount: Number.isFinite(payload?.installmentCount)
      ? Number(payload?.installmentCount)
      : undefined,
    installmentValue: Number.isFinite(payload?.installmentValue)
      ? Number(payload?.installmentValue)
      : undefined,
    price: Number.isFinite(payload?.price) ? Number(payload?.price) : 0,
    expenses: Number.isFinite(payload?.expenses) ? Number(payload?.expenses) : undefined,
    currency: payload?.currency || "USD",
    orientation: payload?.orientation || undefined,
    status: payload?.status || "disponible",
    description: payload?.description || undefined,
    features: Array.isArray(payload?.features) ? payload.features : [],
    comments: payload?.comments || undefined,
    imageUrls: Array.isArray(payload?.imageUrls)
      ? payload.imageUrls.filter(Boolean).slice(0, QUOTE_IMAGE_LIMIT)
      : [],
    pdfUrl: payload?.pdfUrl || undefined,
  };
}

async function ensureQuotesTable(sql: ReturnType<typeof getPgConnection>) {
  try {
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS quotes (
        id UUID PRIMARY KEY,
        development_id UUID,
        development_name TEXT NOT NULL,
        development_slug TEXT,
        client_name TEXT DEFAULT '',
        client_phone TEXT DEFAULT '',
        client_email TEXT DEFAULT '',
        unit_number TEXT NOT NULL,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : undefined;
    if (code !== "23505") throw error;
  }
  await sql.unsafe(`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS client_phone TEXT DEFAULT '';`);
  await sql.unsafe(`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS client_email TEXT DEFAULT '';`);
  await sql.unsafe(`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::jsonb;`);
  await sql.unsafe(`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS created_by UUID;`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_quotes_updated_at ON quotes(updated_at DESC);`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_quotes_development_id ON quotes(development_id);`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_quotes_created_by ON quotes(created_by);`);
}

async function ensureQuotesSchema() {
  if (quotesSchemaReady) return;
  if (!quotesSchemaPromise) {
    quotesSchemaPromise = (async () => {
      let sql: ReturnType<typeof getPgConnection> | null = null;
      try {
        sql = getPgConnection();
        await ensureQuotesTable(sql);
        quotesSchemaReady = true;
      } finally {
        try {
          await sql?.end();
        } catch {}
        if (!quotesSchemaReady) quotesSchemaPromise = null;
      }
    })();
  }
  await quotesSchemaPromise;
}

function mapQuoteRecord(
  row: QuoteRecordRow,
  permissions: { canViewClient?: boolean; canManage?: boolean } = {}
): QuoteRecord {
  const payload = normalizeQuotePayload(row.payload, {
    developmentId: row.development_id,
    unitNumber: row.unit_number,
  });
  const clientName = row.client_name || payload.clientName || "";
  const clientPhone = row.client_phone || payload.clientPhone || "";
  const clientEmail = row.client_email || payload.clientEmail || "";
  const canViewClient = permissions.canViewClient ?? true;
  const canManage = permissions.canManage ?? true;

  return {
    id: row.id,
    developmentId: row.development_id,
    developmentName: row.development_name,
    developmentSlug: row.development_slug || "",
    clientName: canViewClient ? clientName : "",
    clientPhone: canViewClient ? clientPhone : "",
    clientEmail: canViewClient ? clientEmail : "",
    unitNumber: row.unit_number,
    payload: canViewClient
      ? payload
      : {
          developmentId: payload.developmentId,
          unitNumber: payload.unitNumber,
          bedrooms: 0,
          bathrooms: 0,
          area: 0,
          price: 0,
          currency: payload.currency,
          status: payload.status,
          features: [],
          imageUrls: [],
        },
    createdBy: row.created_by || undefined,
    canViewClient,
    canManage,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getQuotes(options?: {
  viewerId?: string;
  viewerRole?: string | null;
}): Promise<QuoteRecord[]> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    await ensureQuotesSchema();
    sql = getPgConnection();
    const rows = await sql`
      SELECT *
      FROM quotes
      ORDER BY updated_at DESC
      LIMIT 80
    `;
    const isAdmin = options?.viewerRole === "admin";
    return (rows as unknown as QuoteRecordRow[]).map((row) => {
      const ownsQuote = !!options?.viewerId && row.created_by === options.viewerId;
      const canViewClient = isAdmin || ownsQuote;
      return mapQuoteRecord(row, {
        canViewClient,
        canManage: canViewClient,
      });
    });
  } catch (error) {
    console.error("Error fetching quotes:", error);
    return [];
  } finally {
    try {
      await sql?.end();
    } catch {}
  }
}

export async function getQuoteForPublicShare(id: string): Promise<QuoteRecord | null> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    await ensureQuotesSchema();
    sql = getPgConnection();
    const rows = await sql`
      SELECT *
      FROM quotes
      WHERE id = ${id}
      LIMIT 1
    `;
    const row = rows[0] as unknown as QuoteRecordRow | undefined;
    if (!row) return null;

    const quote = mapQuoteRecord(row, {
      canViewClient: true,
      canManage: false,
    });

    return {
      ...quote,
      clientName: "",
      clientPhone: "",
      clientEmail: "",
      canViewClient: false,
      canManage: false,
    };
  } catch (error) {
    console.error("Error fetching public quote:", error);
    return null;
  } finally {
    try {
      await sql?.end();
    } catch {}
  }
}

export async function upsertQuote(
  data: QuoteRecordInput
): Promise<{ quote: QuoteRecord | null; error: string | null }> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    await ensureQuotesSchema();
    sql = getPgConnection();

    const id = data.id || crypto.randomUUID();
    const payload = normalizeQuotePayload(
      {
        ...data.payload,
        developmentId: data.payload.developmentId || data.developmentId,
        developmentName: data.payload.developmentName || data.developmentName,
        developmentSlug: data.payload.developmentSlug || data.developmentSlug,
        clientName: data.payload.clientName || data.clientName || "",
        clientPhone: data.payload.clientPhone || data.clientPhone || "",
        clientEmail: data.payload.clientEmail || data.clientEmail || "",
        unitNumber: data.payload.unitNumber || data.unitNumber,
      },
      {
        developmentId: data.developmentId,
        unitNumber: data.unitNumber,
      }
    );
    const clientName = data.clientName || payload.clientName || "";
    const clientPhone = data.clientPhone || payload.clientPhone || "";
    const clientEmail = data.clientEmail || payload.clientEmail || "";

    if (data.id && data.createdBy && data.viewerRole !== "admin") {
      const existingRows = await sql`
        SELECT created_by
        FROM quotes
        WHERE id = ${data.id}
        LIMIT 1
      `;
      const existingQuote = existingRows[0];
      if (existingQuote?.created_by && existingQuote.created_by !== data.createdBy) {
        return { quote: null, error: "No tenes permiso para modificar esta cotizacion" };
      }
    }

    const rows = await sql`
      INSERT INTO quotes (
        id,
        development_id,
        development_name,
        development_slug,
        client_name,
        client_phone,
        client_email,
        unit_number,
        payload,
        created_by,
        updated_at
      ) VALUES (
        ${id},
        ${data.developmentId},
        ${data.developmentName},
        ${data.developmentSlug},
        ${clientName},
        ${clientPhone},
        ${clientEmail},
        ${payload.unitNumber},
        ${JSON.stringify(payload)}::jsonb,
        ${data.createdBy || null},
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        development_id = EXCLUDED.development_id,
        development_name = EXCLUDED.development_name,
        development_slug = EXCLUDED.development_slug,
        client_name = EXCLUDED.client_name,
        client_phone = EXCLUDED.client_phone,
        client_email = EXCLUDED.client_email,
        unit_number = EXCLUDED.unit_number,
        payload = EXCLUDED.payload,
        created_by = COALESCE(quotes.created_by, EXCLUDED.created_by),
        updated_at = NOW()
      RETURNING *
    `;

    return {
      quote: rows[0] ? mapQuoteRecord(rows[0] as unknown as QuoteRecordRow) : null,
      error: null,
    };
  } catch (error) {
    console.error("Error saving quote:", error);
    return {
      quote: null,
      error: error instanceof Error ? error.message : "Error al guardar cotizacion",
    };
  } finally {
    try {
      await sql?.end();
    } catch {}
  }
}

export async function deleteQuote(
  id: string,
  options?: { viewerId?: string; viewerRole?: string | null }
): Promise<{ success: boolean; error: string | null }> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    await ensureQuotesSchema();
    sql = getPgConnection();
    if (options?.viewerRole !== "admin" && options?.viewerId) {
      const existingRows = await sql`
        SELECT created_by
        FROM quotes
        WHERE id = ${id}
        LIMIT 1
      `;
      const existingQuote = existingRows[0];
      if (existingQuote?.created_by && existingQuote.created_by !== options.viewerId) {
        return { success: false, error: "No tenes permiso para eliminar esta cotizacion" };
      }
    }
    await sql`DELETE FROM quotes WHERE id = ${id}`;
    return { success: true, error: null };
  } catch (error) {
    console.error("Error deleting quote:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al eliminar cotizacion",
    };
  } finally {
    try {
      await sql?.end();
    } catch {}
  }
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
    videoUrls: data.video_urls || [],
    videoIsPrimary: Boolean(data.video_is_primary),
    features: data.features || [],
    agentId: data.agent_id,
    status: data.status,
    visibility: data.visibility || "public",
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
    sortOrder: data.sort_order,
    createdAt: data.created_at,
  };
}



// ============================================================
// SITE SETTINGS — singleton (id=1)
// ============================================================

export type SiteSettings = {
  companyName:     string;
  logoUrl:         string;
  faviconUrl:      string;
  heroVideos:      string[];
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
  logoUrl:         "/logo.png",
  faviconUrl:      "/icon.svg",
  heroVideos:      ["/Buenos-Aires1.mp4", "/Buenos-Aires2.mp4", "/Buenos-Aires3.mp4"],
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
      logoUrl:         r.logo_url         ?? DEFAULT_SITE_SETTINGS.logoUrl,
      faviconUrl:      r.favicon_url      ?? DEFAULT_SITE_SETTINGS.faviconUrl,
      heroVideos:      r.hero_videos?.length ? r.hero_videos.slice(0, 3) : DEFAULT_SITE_SETTINGS.heroVideos,
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
    if (data.logoUrl         !== undefined) await sql`UPDATE site_settings SET logo_url         = ${data.logoUrl}         WHERE id = 1`;
    if (data.faviconUrl      !== undefined) await sql`UPDATE site_settings SET favicon_url      = ${data.faviconUrl}      WHERE id = 1`;
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
        logoUrl:         r.logo_url,
        faviconUrl:      r.favicon_url,
        heroVideos:      r.hero_videos?.length ? r.hero_videos.slice(0, 3) : DEFAULT_SITE_SETTINGS.heroVideos,
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
  aboutVideo:             string;
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

export type StatsSettings = {
  statsTitle: string;
  statsQuote: string;
  statsItem1Value: string;
  statsItem1Suffix: string;
  statsItem1Label: string;
  statsItem1Description: string;
  statsItem2Value: string;
  statsItem2Suffix: string;
  statsItem2Label: string;
  statsItem2Description: string;
  statsItem3Value: string;
  statsItem3Suffix: string;
  statsItem3Label: string;
  statsItem3Description: string;
  statsItem4Value: string;
  statsItem4Suffix: string;
  statsItem4Label: string;
  statsItem4Description: string;
};

export const DEFAULT_ABOUT_SETTINGS: AboutSettings = {
  aboutImage: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1200&q=90",
  aboutVideo: "",
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

export const DEFAULT_STATS_SETTINGS: StatsSettings = {
  statsTitle: "Números que respaldan nuestra trayectoria.",
  statsQuote:
    "Invertir en desarrollos es la forma más inteligente de multiplicar tu capital en el mercado inmobiliario.",
  statsItem1Value: "25",
  statsItem1Suffix: "+",
  statsItem1Label: "Años de experiencia",
  statsItem1Description:
    "Más de dos décadas operando en el mercado inmobiliario de Buenos Aires.",
  statsItem2Value: "500",
  statsItem2Suffix: "+",
  statsItem2Label: "Unidades vendidas",
  statsItem2Description:
    "Propiedades comercializadas entre desarrollos, departamentos y casas.",
  statsItem3Value: "40",
  statsItem3Suffix: "%",
  statsItem3Label: "Retorno promedio",
  statsItem3Description:
    "Ganancia típica al revender una unidad comprada en pozo.",
  statsItem4Value: "12",
  statsItem4Suffix: "",
  statsItem4Label: "Desarrollos activos",
  statsItem4Description:
    "Proyectos en construcción o pre-venta disponibles para inversores.",
};

// Forward declaration — Investment types are defined later in this file.
// Para evitar reordering, redeclaramos un type vacío aquí que se mergea más abajo.
export type FullSiteSettings = SiteSettings & AboutSettings & {
  // Campos de Investment se completan dinámicamente con DEFAULT_INVESTMENT_SETTINGS
  [k: string]: any;
};

// Singleton mutable que se completa al final del archivo (al cargarse el módulo).
// Esto evita problemas con el orden de las declaraciones.
export const DEFAULT_FULL_SETTINGS: FullSiteSettings = {
  ...DEFAULT_SITE_SETTINGS,
  ...DEFAULT_ABOUT_SETTINGS,
  ...DEFAULT_STATS_SETTINGS,
  pressLinks: "",
  // Investment defaults se asignan al final del archivo
} as FullSiteSettings;

async function ensureSiteSettingsExtraColumns(sql: ReturnType<typeof getPgConnection>) {
  await sql`
    ALTER TABLE site_settings
    ADD COLUMN IF NOT EXISTS press_links TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS logo_url TEXT DEFAULT '/logo.png',
    ADD COLUMN IF NOT EXISTS favicon_url TEXT DEFAULT '/icon.svg',
    ADD COLUMN IF NOT EXISTS hero_videos TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS about_video TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS investment_video TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS stats_title TEXT DEFAULT 'Números que respaldan nuestra trayectoria.',
    ADD COLUMN IF NOT EXISTS stats_quote TEXT DEFAULT 'Invertir en desarrollos es la forma más inteligente de multiplicar tu capital en el mercado inmobiliario.',
    ADD COLUMN IF NOT EXISTS stats_item_1_value VARCHAR(50) DEFAULT '25',
    ADD COLUMN IF NOT EXISTS stats_item_1_suffix VARCHAR(20) DEFAULT '+',
    ADD COLUMN IF NOT EXISTS stats_item_1_label VARCHAR(255) DEFAULT 'Años de experiencia',
    ADD COLUMN IF NOT EXISTS stats_item_1_description TEXT DEFAULT 'Más de dos décadas operando en el mercado inmobiliario de Buenos Aires.',
    ADD COLUMN IF NOT EXISTS stats_item_2_value VARCHAR(50) DEFAULT '500',
    ADD COLUMN IF NOT EXISTS stats_item_2_suffix VARCHAR(20) DEFAULT '+',
    ADD COLUMN IF NOT EXISTS stats_item_2_label VARCHAR(255) DEFAULT 'Unidades vendidas',
    ADD COLUMN IF NOT EXISTS stats_item_2_description TEXT DEFAULT 'Propiedades comercializadas entre desarrollos, departamentos y casas.',
    ADD COLUMN IF NOT EXISTS stats_item_3_value VARCHAR(50) DEFAULT '40',
    ADD COLUMN IF NOT EXISTS stats_item_3_suffix VARCHAR(20) DEFAULT '%',
    ADD COLUMN IF NOT EXISTS stats_item_3_label VARCHAR(255) DEFAULT 'Retorno promedio',
    ADD COLUMN IF NOT EXISTS stats_item_3_description TEXT DEFAULT 'Ganancia típica al revender una unidad comprada en pozo.',
    ADD COLUMN IF NOT EXISTS stats_item_4_value VARCHAR(50) DEFAULT '12',
    ADD COLUMN IF NOT EXISTS stats_item_4_suffix VARCHAR(20) DEFAULT '',
    ADD COLUMN IF NOT EXISTS stats_item_4_label VARCHAR(255) DEFAULT 'Desarrollos activos',
    ADD COLUMN IF NOT EXISTS stats_item_4_description TEXT DEFAULT 'Proyectos en construcción o pre-venta disponibles para inversores.'
  `;
}

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
      logoUrl:         r.logo_url         ?? DEFAULT_SITE_SETTINGS.logoUrl,
      faviconUrl:      r.favicon_url      ?? DEFAULT_SITE_SETTINGS.faviconUrl,
      heroVideos:      r.hero_videos?.length ? r.hero_videos.slice(0, 3) : DEFAULT_SITE_SETTINGS.heroVideos,
      email:           r.email            ?? DEFAULT_SITE_SETTINGS.email,
      phone:           r.phone            ?? DEFAULT_SITE_SETTINGS.phone,
      whatsapp:        r.whatsapp         ?? DEFAULT_SITE_SETTINGS.whatsapp,
      addressStreet:   r.address_street   ?? DEFAULT_SITE_SETTINGS.addressStreet,
      addressCity:     r.address_city     ?? DEFAULT_SITE_SETTINGS.addressCity,
      whatsappMessage: r.whatsapp_message ?? DEFAULT_SITE_SETTINGS.whatsappMessage,
      aboutImage:             r.about_image               ?? DEFAULT_ABOUT_SETTINGS.aboutImage,
      aboutVideo:             r.about_video               ?? DEFAULT_ABOUT_SETTINGS.aboutVideo,
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

      statsTitle: r.stats_title ?? DEFAULT_STATS_SETTINGS.statsTitle,
      statsQuote: r.stats_quote ?? DEFAULT_STATS_SETTINGS.statsQuote,
      statsItem1Value: r.stats_item_1_value ?? DEFAULT_STATS_SETTINGS.statsItem1Value,
      statsItem1Suffix: r.stats_item_1_suffix ?? DEFAULT_STATS_SETTINGS.statsItem1Suffix,
      statsItem1Label: r.stats_item_1_label ?? DEFAULT_STATS_SETTINGS.statsItem1Label,
      statsItem1Description: r.stats_item_1_description ?? DEFAULT_STATS_SETTINGS.statsItem1Description,
      statsItem2Value: r.stats_item_2_value ?? DEFAULT_STATS_SETTINGS.statsItem2Value,
      statsItem2Suffix: r.stats_item_2_suffix ?? DEFAULT_STATS_SETTINGS.statsItem2Suffix,
      statsItem2Label: r.stats_item_2_label ?? DEFAULT_STATS_SETTINGS.statsItem2Label,
      statsItem2Description: r.stats_item_2_description ?? DEFAULT_STATS_SETTINGS.statsItem2Description,
      statsItem3Value: r.stats_item_3_value ?? DEFAULT_STATS_SETTINGS.statsItem3Value,
      statsItem3Suffix: r.stats_item_3_suffix ?? DEFAULT_STATS_SETTINGS.statsItem3Suffix,
      statsItem3Label: r.stats_item_3_label ?? DEFAULT_STATS_SETTINGS.statsItem3Label,
      statsItem3Description: r.stats_item_3_description ?? DEFAULT_STATS_SETTINGS.statsItem3Description,
      statsItem4Value: r.stats_item_4_value ?? DEFAULT_STATS_SETTINGS.statsItem4Value,
      statsItem4Suffix: r.stats_item_4_suffix ?? DEFAULT_STATS_SETTINGS.statsItem4Suffix,
      statsItem4Label: r.stats_item_4_label ?? DEFAULT_STATS_SETTINGS.statsItem4Label,
      statsItem4Description: r.stats_item_4_description ?? DEFAULT_STATS_SETTINGS.statsItem4Description,

      // Investment
      investmentImage:           r.investment_image           ?? DEFAULT_INVESTMENT_SETTINGS.investmentImage,
      investmentVideo:           r.investment_video           ?? DEFAULT_INVESTMENT_SETTINGS.investmentVideo,
      investmentEyebrow:         r.investment_eyebrow         ?? DEFAULT_INVESTMENT_SETTINGS.investmentEyebrow,
      investmentTitle:           r.investment_title           ?? DEFAULT_INVESTMENT_SETTINGS.investmentTitle,
      investmentDescription:     r.investment_description     ?? DEFAULT_INVESTMENT_SETTINGS.investmentDescription,

      investmentStep1Title:       r.investment_step_1_title       ?? DEFAULT_INVESTMENT_SETTINGS.investmentStep1Title,
      investmentStep1Highlight:   r.investment_step_1_highlight   ?? DEFAULT_INVESTMENT_SETTINGS.investmentStep1Highlight,
      investmentStep1Value:       r.investment_step_1_value       ?? DEFAULT_INVESTMENT_SETTINGS.investmentStep1Value,
      investmentStep1Description: r.investment_step_1_description ?? DEFAULT_INVESTMENT_SETTINGS.investmentStep1Description,

      investmentStep2Title:       r.investment_step_2_title       ?? DEFAULT_INVESTMENT_SETTINGS.investmentStep2Title,
      investmentStep2Highlight:   r.investment_step_2_highlight   ?? DEFAULT_INVESTMENT_SETTINGS.investmentStep2Highlight,
      investmentStep2Value:       r.investment_step_2_value       ?? DEFAULT_INVESTMENT_SETTINGS.investmentStep2Value,
      investmentStep2Description: r.investment_step_2_description ?? DEFAULT_INVESTMENT_SETTINGS.investmentStep2Description,

      investmentStep3Title:       r.investment_step_3_title       ?? DEFAULT_INVESTMENT_SETTINGS.investmentStep3Title,
      investmentStep3Highlight:   r.investment_step_3_highlight   ?? DEFAULT_INVESTMENT_SETTINGS.investmentStep3Highlight,
      investmentStep3Value:       r.investment_step_3_value       ?? DEFAULT_INVESTMENT_SETTINGS.investmentStep3Value,
      investmentStep3Description: r.investment_step_3_description ?? DEFAULT_INVESTMENT_SETTINGS.investmentStep3Description,

      investmentStep4Title:       r.investment_step_4_title       ?? DEFAULT_INVESTMENT_SETTINGS.investmentStep4Title,
      investmentStep4Highlight:   r.investment_step_4_highlight   ?? DEFAULT_INVESTMENT_SETTINGS.investmentStep4Highlight,
      investmentStep4Value:       r.investment_step_4_value       ?? DEFAULT_INVESTMENT_SETTINGS.investmentStep4Value,
      investmentStep4Description: r.investment_step_4_description ?? DEFAULT_INVESTMENT_SETTINGS.investmentStep4Description,

      investmentBenefit1: r.investment_benefit_1 ?? DEFAULT_INVESTMENT_SETTINGS.investmentBenefit1,
      investmentBenefit2: r.investment_benefit_2 ?? DEFAULT_INVESTMENT_SETTINGS.investmentBenefit2,
      investmentBenefit3: r.investment_benefit_3 ?? DEFAULT_INVESTMENT_SETTINGS.investmentBenefit3,
      investmentBenefit4: r.investment_benefit_4 ?? DEFAULT_INVESTMENT_SETTINGS.investmentBenefit4,
      investmentBenefit5: r.investment_benefit_5 ?? DEFAULT_INVESTMENT_SETTINGS.investmentBenefit5,
      investmentBenefit6: r.investment_benefit_6 ?? DEFAULT_INVESTMENT_SETTINGS.investmentBenefit6,
      investmentBenefitsTitle: r.investment_benefits_title ?? DEFAULT_INVESTMENT_SETTINGS.investmentBenefitsTitle,

      investmentCtaEyebrow:     r.investment_cta_eyebrow     ?? DEFAULT_INVESTMENT_SETTINGS.investmentCtaEyebrow,
      investmentCtaTitle:       r.investment_cta_title       ?? DEFAULT_INVESTMENT_SETTINGS.investmentCtaTitle,
      investmentCtaDescription: r.investment_cta_description ?? DEFAULT_INVESTMENT_SETTINGS.investmentCtaDescription,

      pressLinks: r.press_links ?? "",
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
    await ensureSiteSettingsExtraColumns(sql);
    await sql`INSERT INTO site_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`;

    if (data.companyName     !== undefined) await sql`UPDATE site_settings SET company_name     = ${data.companyName}     WHERE id = 1`;
    if (data.logoUrl         !== undefined) await sql`UPDATE site_settings SET logo_url         = ${data.logoUrl}         WHERE id = 1`;
    if (data.faviconUrl      !== undefined) await sql`UPDATE site_settings SET favicon_url      = ${data.faviconUrl}      WHERE id = 1`;
    if (data.heroVideos      !== undefined) await sql`UPDATE site_settings SET hero_videos      = ${data.heroVideos.slice(0, 3)} WHERE id = 1`;
    if (data.email           !== undefined) await sql`UPDATE site_settings SET email            = ${data.email}           WHERE id = 1`;
    if (data.phone           !== undefined) await sql`UPDATE site_settings SET phone            = ${data.phone}           WHERE id = 1`;
    if (data.whatsapp        !== undefined) await sql`UPDATE site_settings SET whatsapp         = ${data.whatsapp}        WHERE id = 1`;
    if (data.addressStreet   !== undefined) await sql`UPDATE site_settings SET address_street   = ${data.addressStreet}   WHERE id = 1`;
    if (data.addressCity     !== undefined) await sql`UPDATE site_settings SET address_city     = ${data.addressCity}     WHERE id = 1`;
    if (data.whatsappMessage !== undefined) await sql`UPDATE site_settings SET whatsapp_message = ${data.whatsappMessage} WHERE id = 1`;

    if (data.aboutImage             !== undefined) await sql`UPDATE site_settings SET about_image               = ${data.aboutImage}             WHERE id = 1`;
    if (data.aboutVideo             !== undefined) await sql`UPDATE site_settings SET about_video               = ${data.aboutVideo}             WHERE id = 1`;
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

    if (data.statsTitle            !== undefined) await sql`UPDATE site_settings SET stats_title              = ${data.statsTitle}            WHERE id = 1`;
    if (data.statsQuote            !== undefined) await sql`UPDATE site_settings SET stats_quote              = ${data.statsQuote}            WHERE id = 1`;
    if (data.statsItem1Value       !== undefined) await sql`UPDATE site_settings SET stats_item_1_value       = ${data.statsItem1Value}       WHERE id = 1`;
    if (data.statsItem1Suffix      !== undefined) await sql`UPDATE site_settings SET stats_item_1_suffix      = ${data.statsItem1Suffix}      WHERE id = 1`;
    if (data.statsItem1Label       !== undefined) await sql`UPDATE site_settings SET stats_item_1_label       = ${data.statsItem1Label}       WHERE id = 1`;
    if (data.statsItem1Description !== undefined) await sql`UPDATE site_settings SET stats_item_1_description = ${data.statsItem1Description} WHERE id = 1`;
    if (data.statsItem2Value       !== undefined) await sql`UPDATE site_settings SET stats_item_2_value       = ${data.statsItem2Value}       WHERE id = 1`;
    if (data.statsItem2Suffix      !== undefined) await sql`UPDATE site_settings SET stats_item_2_suffix      = ${data.statsItem2Suffix}      WHERE id = 1`;
    if (data.statsItem2Label       !== undefined) await sql`UPDATE site_settings SET stats_item_2_label       = ${data.statsItem2Label}       WHERE id = 1`;
    if (data.statsItem2Description !== undefined) await sql`UPDATE site_settings SET stats_item_2_description = ${data.statsItem2Description} WHERE id = 1`;
    if (data.statsItem3Value       !== undefined) await sql`UPDATE site_settings SET stats_item_3_value       = ${data.statsItem3Value}       WHERE id = 1`;
    if (data.statsItem3Suffix      !== undefined) await sql`UPDATE site_settings SET stats_item_3_suffix      = ${data.statsItem3Suffix}      WHERE id = 1`;
    if (data.statsItem3Label       !== undefined) await sql`UPDATE site_settings SET stats_item_3_label       = ${data.statsItem3Label}       WHERE id = 1`;
    if (data.statsItem3Description !== undefined) await sql`UPDATE site_settings SET stats_item_3_description = ${data.statsItem3Description} WHERE id = 1`;
    if (data.statsItem4Value       !== undefined) await sql`UPDATE site_settings SET stats_item_4_value       = ${data.statsItem4Value}       WHERE id = 1`;
    if (data.statsItem4Suffix      !== undefined) await sql`UPDATE site_settings SET stats_item_4_suffix      = ${data.statsItem4Suffix}      WHERE id = 1`;
    if (data.statsItem4Label       !== undefined) await sql`UPDATE site_settings SET stats_item_4_label       = ${data.statsItem4Label}       WHERE id = 1`;
    if (data.statsItem4Description !== undefined) await sql`UPDATE site_settings SET stats_item_4_description = ${data.statsItem4Description} WHERE id = 1`;

    // Investment
    if (data.investmentImage           !== undefined) await sql`UPDATE site_settings SET investment_image           = ${data.investmentImage}           WHERE id = 1`;
    if (data.investmentVideo           !== undefined) await sql`UPDATE site_settings SET investment_video           = ${data.investmentVideo}           WHERE id = 1`;
    if (data.investmentEyebrow         !== undefined) await sql`UPDATE site_settings SET investment_eyebrow         = ${data.investmentEyebrow}         WHERE id = 1`;
    if (data.investmentTitle           !== undefined) await sql`UPDATE site_settings SET investment_title           = ${data.investmentTitle}           WHERE id = 1`;
    if (data.investmentDescription     !== undefined) await sql`UPDATE site_settings SET investment_description     = ${data.investmentDescription}     WHERE id = 1`;

    if (data.investmentStep1Title       !== undefined) await sql`UPDATE site_settings SET investment_step_1_title       = ${data.investmentStep1Title}       WHERE id = 1`;
    if (data.investmentStep1Highlight   !== undefined) await sql`UPDATE site_settings SET investment_step_1_highlight   = ${data.investmentStep1Highlight}   WHERE id = 1`;
    if (data.investmentStep1Value       !== undefined) await sql`UPDATE site_settings SET investment_step_1_value       = ${data.investmentStep1Value}       WHERE id = 1`;
    if (data.investmentStep1Description !== undefined) await sql`UPDATE site_settings SET investment_step_1_description = ${data.investmentStep1Description} WHERE id = 1`;

    if (data.investmentStep2Title       !== undefined) await sql`UPDATE site_settings SET investment_step_2_title       = ${data.investmentStep2Title}       WHERE id = 1`;
    if (data.investmentStep2Highlight   !== undefined) await sql`UPDATE site_settings SET investment_step_2_highlight   = ${data.investmentStep2Highlight}   WHERE id = 1`;
    if (data.investmentStep2Value       !== undefined) await sql`UPDATE site_settings SET investment_step_2_value       = ${data.investmentStep2Value}       WHERE id = 1`;
    if (data.investmentStep2Description !== undefined) await sql`UPDATE site_settings SET investment_step_2_description = ${data.investmentStep2Description} WHERE id = 1`;

    if (data.investmentStep3Title       !== undefined) await sql`UPDATE site_settings SET investment_step_3_title       = ${data.investmentStep3Title}       WHERE id = 1`;
    if (data.investmentStep3Highlight   !== undefined) await sql`UPDATE site_settings SET investment_step_3_highlight   = ${data.investmentStep3Highlight}   WHERE id = 1`;
    if (data.investmentStep3Value       !== undefined) await sql`UPDATE site_settings SET investment_step_3_value       = ${data.investmentStep3Value}       WHERE id = 1`;
    if (data.investmentStep3Description !== undefined) await sql`UPDATE site_settings SET investment_step_3_description = ${data.investmentStep3Description} WHERE id = 1`;

    if (data.investmentStep4Title       !== undefined) await sql`UPDATE site_settings SET investment_step_4_title       = ${data.investmentStep4Title}       WHERE id = 1`;
    if (data.investmentStep4Highlight   !== undefined) await sql`UPDATE site_settings SET investment_step_4_highlight   = ${data.investmentStep4Highlight}   WHERE id = 1`;
    if (data.investmentStep4Value       !== undefined) await sql`UPDATE site_settings SET investment_step_4_value       = ${data.investmentStep4Value}       WHERE id = 1`;
    if (data.investmentStep4Description !== undefined) await sql`UPDATE site_settings SET investment_step_4_description = ${data.investmentStep4Description} WHERE id = 1`;

    if (data.investmentBenefit1      !== undefined) await sql`UPDATE site_settings SET investment_benefit_1      = ${data.investmentBenefit1}      WHERE id = 1`;
    if (data.investmentBenefit2      !== undefined) await sql`UPDATE site_settings SET investment_benefit_2      = ${data.investmentBenefit2}      WHERE id = 1`;
    if (data.investmentBenefit3      !== undefined) await sql`UPDATE site_settings SET investment_benefit_3      = ${data.investmentBenefit3}      WHERE id = 1`;
    if (data.investmentBenefit4      !== undefined) await sql`UPDATE site_settings SET investment_benefit_4      = ${data.investmentBenefit4}      WHERE id = 1`;
    if (data.investmentBenefit5      !== undefined) await sql`UPDATE site_settings SET investment_benefit_5      = ${data.investmentBenefit5}      WHERE id = 1`;
    if (data.investmentBenefit6      !== undefined) await sql`UPDATE site_settings SET investment_benefit_6      = ${data.investmentBenefit6}      WHERE id = 1`;
    if (data.investmentBenefitsTitle !== undefined) await sql`UPDATE site_settings SET investment_benefits_title = ${data.investmentBenefitsTitle} WHERE id = 1`;

    if (data.investmentCtaEyebrow     !== undefined) await sql`UPDATE site_settings SET investment_cta_eyebrow     = ${data.investmentCtaEyebrow}     WHERE id = 1`;
    if (data.investmentCtaTitle       !== undefined) await sql`UPDATE site_settings SET investment_cta_title       = ${data.investmentCtaTitle}       WHERE id = 1`;
    if (data.investmentCtaDescription !== undefined) await sql`UPDATE site_settings SET investment_cta_description = ${data.investmentCtaDescription} WHERE id = 1`;
    if (data.pressLinks               !== undefined) await sql`UPDATE site_settings SET press_links                = ${data.pressLinks}               WHERE id = 1`;

    await sql.end();

    const settings = await getFullSiteSettings();
    return { settings, error: null };
  } catch (err: any) {
    try { await sql?.end(); } catch {}
    return { settings: null, error: err?.message || "Error al guardar settings" };
  }
}



// ============================================================
// SITE SETTINGS — Extensión "Inversión" (investment-model-section)
// ============================================================

export type InvestmentSettings = {
  investmentImage:           string;
  investmentVideo:           string;
  investmentEyebrow:         string;
  investmentTitle:           string;
  investmentDescription:     string;

  investmentStep1Title:       string;
  investmentStep1Highlight:   string;
  investmentStep1Value:       string;
  investmentStep1Description: string;

  investmentStep2Title:       string;
  investmentStep2Highlight:   string;
  investmentStep2Value:       string;
  investmentStep2Description: string;

  investmentStep3Title:       string;
  investmentStep3Highlight:   string;
  investmentStep3Value:       string;
  investmentStep3Description: string;

  investmentStep4Title:       string;
  investmentStep4Highlight:   string;
  investmentStep4Value:       string;
  investmentStep4Description: string;

  investmentBenefit1: string;
  investmentBenefit2: string;
  investmentBenefit3: string;
  investmentBenefit4: string;
  investmentBenefit5: string;
  investmentBenefit6: string;
  investmentBenefitsTitle: string;

  investmentCtaEyebrow:     string;
  investmentCtaTitle:       string;
  investmentCtaDescription: string;
};

export const DEFAULT_INVESTMENT_SETTINGS: InvestmentSettings = {
  investmentImage: "",
  investmentVideo: "",
  investmentEyebrow: "Modelo de inversión",
  investmentTitle: "Cómo funciona la inversión en desarrollos.",
  investmentDescription:
    "Un proceso simple y transparente. Desde el anticipo hasta la renta o reventa, te acompañamos en cada paso.",

  investmentStep1Title: "Ingresá con el 35%",
  investmentStep1Highlight: "Anticipo inicial",
  investmentStep1Value: "35%",
  investmentStep1Description:
    "Reservá tu unidad con un anticipo inicial del 35% del valor. Asegurás precio de pozo y comenzás a capitalizar desde el día uno.",

  investmentStep2Title: "Financiá el saldo",
  investmentStep2Highlight: "Saldo en cuotas",
  investmentStep2Value: "65%",
  investmentStep2Description:
    "El 65% restante lo pagás en cuotas durante la construcción. Planes flexibles adaptados a tu capacidad de ahorro.",

  investmentStep3Title: "Revendé con ganancia",
  investmentStep3Highlight: "Retorno estimado",
  investmentStep3Value: "30-40%",
  investmentStep3Description:
    "Una vez finalizado el proyecto, vendé tu unidad en el mercado. La diferencia entre precio de pozo y valor terminado genera retornos del 30-40%.",

  investmentStep4Title: "O generá renta pasiva",
  investmentStep4Highlight: "Renta mensual",
  investmentStep4Value: "24/7",
  investmentStep4Description:
    "Si preferís mantener la propiedad, nosotros la administramos como alquiler temporario tipo Airbnb. Vos cobrás, nosotros nos encargamos de todo.",

  investmentBenefit1: "Precio de pozo garantizado",
  investmentBenefit2: "Asesoramiento legal incluido",
  investmentBenefit3: "Seguimiento de obra en tiempo real",
  investmentBenefit4: "Sin comisiones ocultas",
  investmentBenefit5: "Gestión de reventa o alquiler",
  investmentBenefit6: "Soporte post-entrega",
  investmentBenefitsTitle: "Todo lo que incluye invertir con nosotros.",

  investmentCtaEyebrow: "Comenzá ahora",
  investmentCtaTitle: "¿Querés saber más sobre oportunidades de inversión?",
  investmentCtaDescription:
    "Agendá una llamada con nuestro equipo. Te explicamos las opciones disponibles, los planes de financiación y respondemos todas tus consultas.",
};



// Mergear los defaults de investment al singleton DEFAULT_FULL_SETTINGS
// (forward declaration arriba; se completa acá ahora que ya cargó todo).
Object.assign(DEFAULT_FULL_SETTINGS, DEFAULT_INVESTMENT_SETTINGS);
