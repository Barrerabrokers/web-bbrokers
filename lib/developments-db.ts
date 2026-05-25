import { Development, Unit, DevelopmentImage, UnitImage } from "@/types";
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

// Helper: convert name to slug
export function slugify(text: string): string {
  return text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 -]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}


// ============================================================
// DEVELOPMENTS - READ
// ============================================================

export async function getDevelopments(filter?: {
  status?: string;
  highlight?: boolean;
}): Promise<Development[]> {
  const supabase = getServerSupabase();

  let query = supabase
    .from("developments")
    .select(`
      *,
      development_images (
        id, url, type, caption, display_order, is_primary
      ),
      units ( id, status, price )
    `)
    .order("created_at", { ascending: false });

  if (filter?.status) query = query.eq("status", filter.status);
  if (filter?.highlight !== undefined)
    query = query.eq("highlight", filter.highlight);

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching developments:", error);
    return [];
  }

  return (data || []).map((d) => mapDevelopmentFromDb(d));
}

export async function getDevelopmentById(
  id: string
): Promise<Development | null> {
  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from("developments")
    .select(`
      *,
      development_images (
        id, url, type, caption, display_order, is_primary
      ),
      units (
        *,
        unit_images ( id, url, type, display_order, is_primary )
      )
    `)
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return mapDevelopmentFromDb(data, true);
}


export async function getDevelopmentBySlug(
  slug: string
): Promise<Development | null> {
  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from("developments")
    .select(`
      *,
      development_images (
        id, url, type, caption, display_order, is_primary
      ),
      units (
        *,
        unit_images ( id, url, type, display_order, is_primary )
      )
    `)
    .eq("slug", slug)
    .single();

  if (error || !data) return null;
  return mapDevelopmentFromDb(data, true);
}

// ============================================================
// DEVELOPMENTS - CREATE
// ============================================================

export async function createDevelopment(data: {
  name: string;
  shortDescription?: string;
  description: string;
  location: string;
  address: string;
  status?: string;
  totalUnits?: number;
  completionDate?: string;
  progress?: number;
  priceFrom?: number;
  amenities?: string[];
  features?: string[];
  highlight?: boolean;
  agentId?: string;
  images?: { url: string; type?: string; caption?: string }[];
}): Promise<{ development: Development | null; error: string | null }> {
  let sql;
  try {
    sql = getPgConnection();

    const slug = slugify(data.name);

    const result = await sql`
      INSERT INTO developments (
        name, slug, short_description, description, location, address,
        status, total_units, completion_date, progress, price_from,
        amenities, features, highlight, agent_id
      ) VALUES (
        ${data.name}, ${slug}, ${data.shortDescription || null},
        ${data.description}, ${data.location}, ${data.address},
        ${data.status || "pre_venta"}, ${data.totalUnits || 0},
        ${data.completionDate || null}, ${data.progress || 0},
        ${data.priceFrom || null}, ${data.amenities || []},
        ${data.features || []}, ${data.highlight || false},
        ${data.agentId || null}
      )
      RETURNING id
    `;

    const developmentId = result[0].id;


    if (data.images && data.images.length > 0) {
      for (let i = 0; i < data.images.length; i++) {
        const img = data.images[i];
        await sql`
          INSERT INTO development_images (
            development_id, url, type, caption, display_order, is_primary
          ) VALUES (
            ${developmentId}, ${img.url}, ${img.type || "otro"},
            ${img.caption || null}, ${i}, ${i === 0}
          )
        `;
      }
    }

    await sql.end();

    const fullDev = await getDevelopmentById(developmentId);
    return { development: fullDev, error: null };
  } catch (error: any) {
    if (sql) {
      try { await sql.end(); } catch {}
    }
    console.error("Error creating development:", error);
    return { development: null, error: error.message || "Unknown error" };
  }
}

// ============================================================
// DEVELOPMENTS - UPDATE
// ============================================================

export async function updateDevelopment(
  id: string,
  data: any
): Promise<{ development: Development | null; error: string | null }> {
  const { images, ...fields } = data;
  let sql;
  try {
    sql = getPgConnection();

    const updates: string[] = [];
    const values: any[] = [];
    let i = 1;

    const fieldMap: Record<string, string> = {
      name: "name",
      shortDescription: "short_description",
      description: "description",
      location: "location",
      address: "address",
      status: "status",
      totalUnits: "total_units",
      completionDate: "completion_date",
      progress: "progress",
      priceFrom: "price_from",
      amenities: "amenities",
      features: "features",
      highlight: "highlight",
    };

    for (const [key, col] of Object.entries(fieldMap)) {
      if (fields[key] !== undefined) {
        updates.push(`${col} = $${i++}`);
        values.push(fields[key]);
      }
    }


    if (fields.name) {
      updates.push(`slug = $${i++}`);
      values.push(slugify(fields.name));
    }

    updates.push(`updated_at = NOW()`);

    if (updates.length > 1) {
      const query = `UPDATE developments SET ${updates.join(", ")} WHERE id = $${i}`;
      values.push(id);
      await sql.unsafe(query, values);
    }

    if (images && Array.isArray(images)) {
      await sql`DELETE FROM development_images WHERE development_id = ${id}`;
      for (let idx = 0; idx < images.length; idx++) {
        const img = images[idx];
        await sql`
          INSERT INTO development_images (
            development_id, url, type, caption, display_order, is_primary
          ) VALUES (
            ${id}, ${img.url}, ${img.type || "otro"},
            ${img.caption || null}, ${idx}, ${idx === 0}
          )
        `;
      }
    }

    await sql.end();

    const updated = await getDevelopmentById(id);
    return { development: updated, error: null };
  } catch (error: any) {
    if (sql) { try { await sql.end(); } catch {} }
    console.error("Error updating development:", error);
    return { development: null, error: error.message || "Unknown error" };
  }
}

export async function deleteDevelopment(id: string): Promise<boolean> {
  let sql;
  try {
    sql = getPgConnection();
    await sql`DELETE FROM developments WHERE id = ${id}`;
    await sql.end();
    return true;
  } catch (error: any) {
    if (sql) { try { await sql.end(); } catch {} }
    console.error("Error deleting development:", error);
    return false;
  }
}


// ============================================================
// UNITS
// ============================================================

export async function getUnitsByDevelopment(
  developmentId: string
): Promise<Unit[]> {
  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from("units")
    .select(`
      *,
      unit_images ( id, url, type, display_order, is_primary )
    `)
    .eq("development_id", developmentId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data.map(mapUnitFromDb);
}

export async function getUnitById(id: string): Promise<Unit | null> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("units")
    .select(`
      *,
      unit_images ( id, url, type, display_order, is_primary )
    `)
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return mapUnitFromDb(data);
}

export async function createUnit(data: {
  developmentId: string;
  unitNumber: string;
  floor?: string;
  bedrooms: number;
  bathrooms: number;
  area: number;
  balconyArea?: number;
  totalArea?: number;
  price: number;
  expenses?: number;
  orientation?: string;
  status?: string;
  description?: string;
  features?: string[];
  images?: { url: string; type?: string }[];
}): Promise<{ unit: Unit | null; error: string | null }> {
  let sql;
  try {
    sql = getPgConnection();


    const result = await sql`
      INSERT INTO units (
        development_id, unit_number, floor, bedrooms, bathrooms, area,
        balcony_area, total_area, price, expenses, orientation, status,
        description, features
      ) VALUES (
        ${data.developmentId}, ${data.unitNumber}, ${data.floor || null},
        ${data.bedrooms}, ${data.bathrooms}, ${data.area},
        ${data.balconyArea || null}, ${data.totalArea || null},
        ${data.price}, ${data.expenses || null}, ${data.orientation || null},
        ${data.status || "disponible"}, ${data.description || null},
        ${data.features || []}
      )
      RETURNING id
    `;

    const unitId = result[0].id;

    if (data.images && data.images.length > 0) {
      for (let i = 0; i < data.images.length; i++) {
        const img = data.images[i];
        await sql`
          INSERT INTO unit_images (
            unit_id, url, type, display_order, is_primary
          ) VALUES (
            ${unitId}, ${img.url}, ${img.type || "foto"},
            ${i}, ${i === 0}
          )
        `;
      }
    }

    await sql.end();

    const unit = await getUnitById(unitId);
    return { unit, error: null };
  } catch (error: any) {
    if (sql) { try { await sql.end(); } catch {} }
    console.error("Error creating unit:", error);
    return { unit: null, error: error.message || "Unknown error" };
  }
}


export async function updateUnit(
  id: string,
  data: any
): Promise<{ unit: Unit | null; error: string | null }> {
  const { images, ...fields } = data;
  let sql;
  try {
    sql = getPgConnection();

    const fieldMap: Record<string, string> = {
      unitNumber: "unit_number",
      floor: "floor",
      bedrooms: "bedrooms",
      bathrooms: "bathrooms",
      area: "area",
      balconyArea: "balcony_area",
      totalArea: "total_area",
      price: "price",
      expenses: "expenses",
      orientation: "orientation",
      status: "status",
      description: "description",
      features: "features",
    };

    const updates: string[] = [];
    const values: any[] = [];
    let i = 1;

    for (const [key, col] of Object.entries(fieldMap)) {
      if (fields[key] !== undefined) {
        updates.push(`${col} = $${i++}`);
        values.push(fields[key]);
      }
    }
    updates.push(`updated_at = NOW()`);

    if (updates.length > 1) {
      const query = `UPDATE units SET ${updates.join(", ")} WHERE id = $${i}`;
      values.push(id);
      await sql.unsafe(query, values);
    }

    if (images && Array.isArray(images)) {
      await sql`DELETE FROM unit_images WHERE unit_id = ${id}`;
      for (let idx = 0; idx < images.length; idx++) {
        const img = images[idx];
        await sql`
          INSERT INTO unit_images (unit_id, url, type, display_order, is_primary)
          VALUES (${id}, ${img.url}, ${img.type || "foto"}, ${idx}, ${idx === 0})
        `;
      }
    }

    await sql.end();
    const unit = await getUnitById(id);
    return { unit, error: null };
  } catch (error: any) {
    if (sql) { try { await sql.end(); } catch {} }
    return { unit: null, error: error.message || "Unknown error" };
  }
}

export async function deleteUnit(id: string): Promise<boolean> {
  let sql;
  try {
    sql = getPgConnection();
    await sql`DELETE FROM units WHERE id = ${id}`;
    await sql.end();
    return true;
  } catch (error: any) {
    if (sql) { try { await sql.end(); } catch {} }
    return false;
  }
}


// ============================================================
// MAPPERS
// ============================================================

function mapDevelopmentFromDb(data: any, includeUnits = false): Development {
  const images: DevelopmentImage[] = (data.development_images || [])
    .sort(
      (a: any, b: any) => (a.display_order || 0) - (b.display_order || 0)
    )
    .map((img: any) => ({
      id: img.id,
      url: img.url,
      type: img.type,
      caption: img.caption,
      displayOrder: img.display_order,
      isPrimary: img.is_primary,
    }));

  const allUnits = data.units || [];
  const availableUnits = allUnits.filter(
    (u: any) => u.status === "disponible"
  ).length;
  const minPrice = allUnits
    .filter((u: any) => u.status === "disponible")
    .map((u: any) => parseFloat(u.price))
    .reduce(
      (min: number | null, p: number) =>
        min === null || p < min ? p : min,
      null
    );

  const dev: Development = {
    id: data.id,
    name: data.name,
    slug: data.slug,
    shortDescription: data.short_description,
    description: data.description,
    location: data.location,
    address: data.address,
    status: data.status,
    totalUnits: data.total_units,
    completionDate: data.completion_date,
    progress: data.progress || 0,
    priceFrom: data.price_from ? parseFloat(data.price_from) : undefined,
    currency: data.currency,
    amenities: data.amenities || [],
    features: data.features || [],
    highlight: data.highlight,
    agentId: data.agent_id,
    images,
    availableUnits,
    unitsCount: allUnits.length,
    minPriceAvailable: minPrice ?? undefined,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };

  if (includeUnits) {
    dev.units = allUnits.map(mapUnitFromDb);
  }

  return dev;
}


function mapUnitFromDb(data: any): Unit {
  const images: UnitImage[] = (data.unit_images || [])
    .sort(
      (a: any, b: any) => (a.display_order || 0) - (b.display_order || 0)
    )
    .map((img: any) => ({
      id: img.id,
      url: img.url,
      type: img.type,
      displayOrder: img.display_order,
      isPrimary: img.is_primary,
    }));

  return {
    id: data.id,
    developmentId: data.development_id,
    unitNumber: data.unit_number,
    floor: data.floor,
    bedrooms: data.bedrooms,
    bathrooms: data.bathrooms,
    area: parseFloat(data.area),
    balconyArea: data.balcony_area
      ? parseFloat(data.balcony_area)
      : undefined,
    totalArea: data.total_area ? parseFloat(data.total_area) : undefined,
    price: parseFloat(data.price),
    currency: data.currency,
    expenses: data.expenses ? parseFloat(data.expenses) : undefined,
    orientation: data.orientation,
    status: data.status,
    description: data.description,
    features: data.features || [],
    images,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}
