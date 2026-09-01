import { Development, Unit, DevelopmentImage, UnitImage } from "@/types";
import { getServerSupabase } from "@/lib/supabase";
import postgres from "postgres";

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
  visibility?: string;
}): Promise<Development[]> {
  return getDevelopmentsViaPostgres(filter);
}

/** Lightweight list for selectors and CRM filters. Avoids loading galleries and units. */
export async function getDevelopmentOptions(): Promise<Array<{ id: string; name: string }>> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    sql = getPgConnection();
    const rows = await sql`
      SELECT id, name
      FROM developments
      ORDER BY name ASC
    `;
    return rows.map((row) => ({ id: String(row.id), name: String(row.name) }));
  } catch (error) {
    console.error("Error fetching development options:", error);
    return [];
  } finally {
    try { await sql?.end(); } catch {}
  }
}

async function getDevelopmentsViaPostgres(filter?: {
  status?: string;
  highlight?: boolean;
  visibility?: string;
}): Promise<Development[]> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    sql = getPgConnection();
    const conditions: string[] = [];
    const values: any[] = [];

    if (filter?.status) {
      values.push(filter.status);
      conditions.push(`d.status = $${values.length}`);
    }
    if (filter?.highlight !== undefined) {
      values.push(filter.highlight);
      conditions.push(`d.highlight = $${values.length}`);
    }
    if (filter?.visibility) {
      values.push(filter.visibility);
      conditions.push(`d.visibility = $${values.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = await sql.unsafe(
      `
        SELECT
          d.*,
          COALESCE(
            json_agg(
              DISTINCT jsonb_build_object(
                'id', di.id,
                'url', di.url,
                'type', di.type,
                'caption', di.caption,
                'display_order', di.display_order,
                'is_primary', di.is_primary
              )
            ) FILTER (WHERE di.id IS NOT NULL),
            '[]'::json
          ) AS development_images,
          COALESCE(
            json_agg(
              DISTINCT jsonb_build_object(
                'id', u.id,
                'status', u.status,
                'price', u.price
              )
            ) FILTER (WHERE u.id IS NOT NULL),
            '[]'::json
          ) AS units
        FROM developments d
        LEFT JOIN development_images di ON di.development_id = d.id
        LEFT JOIN units u ON u.development_id = d.id
        ${where}
        GROUP BY d.id
        ORDER BY d.created_at DESC
      `,
      values
    );

    return rows.map((d: any) => {
      d.development_images = (d.development_images || []).sort(
        (a: any, b: any) => (a.display_order || 0) - (b.display_order || 0)
      );
      return mapDevelopmentFromDb(d);
    });
  } catch (error) {
    console.error("Error fetching developments via Postgres:", error);
    return [];
  } finally {
    try {
      await sql?.end();
    } catch {}
  }
}

export async function getDevelopmentById(
  id: string
): Promise<Development | null> {
  return getDevelopmentViaPostgres("id", id);
}


export async function getDevelopmentBySlug(
  slug: string
): Promise<Development | null> {
  return getDevelopmentViaPostgres("slug", slug);
}

async function getDevelopmentViaPostgres(
  field: "id" | "slug",
  value: string
): Promise<Development | null> {
  let sql: ReturnType<typeof getPgConnection> | null = null;
  try {
    sql = getPgConnection();
    const rows = await sql.unsafe(
      `
        SELECT
          d.*,
          COALESCE(
            json_agg(
              json_build_object(
                'id', di.id,
                'url', di.url,
                'type', di.type,
                'caption', di.caption,
                'display_order', di.display_order,
                'is_primary', di.is_primary
              )
              ORDER BY di.display_order
            ) FILTER (WHERE di.id IS NOT NULL),
            '[]'::json
          ) AS development_images
        FROM developments d
        LEFT JOIN development_images di ON di.development_id = d.id
        WHERE d.${field} = $1
        GROUP BY d.id
        LIMIT 1
      `,
      [value]
    );

    const development = rows[0];
    if (!development) return null;

    const units = await sql`
      SELECT
        u.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', ui.id,
              'url', ui.url,
              'type', ui.type,
              'display_order', ui.display_order,
              'is_primary', ui.is_primary
            )
            ORDER BY ui.display_order
          ) FILTER (WHERE ui.id IS NOT NULL),
          '[]'::json
        ) AS unit_images
      FROM units u
      LEFT JOIN unit_images ui ON ui.unit_id = u.id
      WHERE u.development_id = ${development.id}
      GROUP BY u.id
      ORDER BY u.floor, u.unit_number
    `;

    development.units = units;
    return mapDevelopmentFromDb(development, true);
  } catch (error) {
    console.error("Error fetching development via Postgres:", error);
    return null;
  } finally {
    try {
      await sql?.end();
    } catch {}
  }
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
  brochureUrl?: string;
  priceListUrl?: string;
  videoUrl?: string;
  videoUrls?: string[];
  videoIsPrimary?: boolean;
  visibility?: string;
  images?: { url: string; type?: string; caption?: string; isPrimary?: boolean }[];
}): Promise<{ development: Development | null; error: string | null }> {
  let sql;
  try {
    sql = getPgConnection();

    const slug = slugify(data.name);

    const result = await sql`
      INSERT INTO developments (
        name, slug, short_description, description, location, address,
        status, total_units, completion_date, progress, price_from,
        amenities, features, highlight, agent_id, brochure_url, price_list_url,
        video_url, video_urls, video_is_primary,
        visibility
      ) VALUES (
        ${data.name}, ${slug}, ${data.shortDescription || null},
        ${data.description}, ${data.location}, ${data.address},
        ${data.status || "pre_venta"}, ${data.totalUnits || 0},
        ${data.completionDate || null}, ${data.progress || 0},
        ${data.priceFrom || null}, ${data.amenities || []},
        ${data.features || []}, ${data.highlight || false},
        ${data.agentId || null}, ${data.brochureUrl || null},
        ${data.priceListUrl || null}, ${data.videoUrl || null}, ${data.videoUrls || []},
        ${data.videoIsPrimary || false},
        ${data.visibility || "public"}
      )
      RETURNING id
    `;

    const developmentId = result[0].id;


    if (data.images && data.images.length > 0) {
      for (let i = 0; i < data.images.length; i++) {
        const img = data.images[i];
        // Si vino isPrimary explícito lo usamos, sino el primero es portada
        const anyHasPrimary = data.images.some((x: any) => x.isPrimary === true);
        const isPrimary = anyHasPrimary ? !!img.isPrimary : i === 0;
        await sql`
          INSERT INTO development_images (
            development_id, url, type, caption, display_order, is_primary
          ) VALUES (
            ${developmentId}, ${img.url}, ${img.type || "otro"},
            ${img.caption || null}, ${i}, ${isPrimary}
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
      visibility: "visibility",
      brochureUrl: "brochure_url",
      priceListUrl: "price_list_url",
      videoUrl: "video_url",
      videoUrls: "video_urls",
      videoIsPrimary: "video_is_primary",
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
      const anyHasPrimary = images.some((x: any) => x.isPrimary === true);
      for (let idx = 0; idx < images.length; idx++) {
        const img = images[idx];
        const isPrimary = anyHasPrimary ? !!img.isPrimary : idx === 0;
        await sql`
          INSERT INTO development_images (
            development_id, url, type, caption, display_order, is_primary
          ) VALUES (
            ${id}, ${img.url}, ${img.type || "otro"},
            ${img.caption || null}, ${idx}, ${isPrimary}
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
  downPayment?: number;
  installmentCount?: number;
  installmentValue?: number;
  price: number;
  expenses?: number;
  orientation?: string;
  status?: string;
  description?: string;
  features?: string[];
  videoUrl?: string;
  images?: { url: string; type?: string; isPrimary?: boolean }[];
}): Promise<{ unit: Unit | null; error: string | null }> {
  let sql;
  try {
    sql = getPgConnection();

    await sql.unsafe(`ALTER TABLE units ADD COLUMN IF NOT EXISTS video_url TEXT;`);

    const result = await sql`
      INSERT INTO units (
        development_id, unit_number, floor, bedrooms, bathrooms, area,
        balcony_area, total_area, down_payment, installment_count,
        installment_value, price, expenses, orientation, status,
        description, features, video_url
      ) VALUES (
        ${data.developmentId}, ${data.unitNumber}, ${data.floor || null},
        ${data.bedrooms}, ${data.bathrooms}, ${data.area},
        ${data.balconyArea || null}, ${data.totalArea || null},
        ${data.downPayment || null}, ${data.installmentCount || null},
        ${data.installmentValue || null},
        ${data.price}, ${data.expenses || null}, ${data.orientation || null},
        ${data.status || "disponible"}, ${data.description || null},
        ${data.features || []}, ${data.videoUrl || null}
      )
      RETURNING id
    `;

    const unitId = result[0].id;

    if (data.images && data.images.length > 0) {
      const anyHasPrimary = data.images.some((x: any) => x.isPrimary === true);
      for (let i = 0; i < data.images.length; i++) {
        const img = data.images[i];
        const isPrimary = anyHasPrimary ? !!img.isPrimary : i === 0;
        await sql`
          INSERT INTO unit_images (
            unit_id, url, type, display_order, is_primary
          ) VALUES (
            ${unitId}, ${img.url}, ${img.type || "foto"},
            ${i}, ${isPrimary}
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

    await sql.unsafe(`ALTER TABLE units ADD COLUMN IF NOT EXISTS video_url TEXT;`);

    const fieldMap: Record<string, string> = {
      unitNumber: "unit_number",
      floor: "floor",
      bedrooms: "bedrooms",
      bathrooms: "bathrooms",
      area: "area",
      balconyArea: "balcony_area",
      totalArea: "total_area",
      downPayment: "down_payment",
      installmentCount: "installment_count",
      installmentValue: "installment_value",
      price: "price",
      expenses: "expenses",
      orientation: "orientation",
      status: "status",
      description: "description",
      features: "features",
      videoUrl: "video_url",
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
      const anyHasPrimary = images.some((x: any) => x.isPrimary === true);
      for (let idx = 0; idx < images.length; idx++) {
        const img = images[idx];
        const isPrimary = anyHasPrimary ? !!img.isPrimary : idx === 0;
        await sql`
          INSERT INTO unit_images (unit_id, url, type, display_order, is_primary)
          VALUES (${id}, ${img.url}, ${img.type || "foto"}, ${idx}, ${isPrimary})
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

function normalizeUnitStatus(status: unknown): Unit["status"] {
  if (typeof status !== "string" || !status.trim()) return "disponible";

  const normalized = status.trim().toLowerCase();
  if (normalized === "reservada" || normalized === "vendida") {
    return normalized;
  }

  return "disponible";
}

function safeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function safeRows(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function mapDevelopmentFromDb(data: any, includeUnits = false): Development {
  const images: DevelopmentImage[] = safeRows(data.development_images)
    .filter((img: any) => typeof img?.url === "string" && img.url.trim().length > 0)
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

  const allUnits = safeRows(data.units);
  const availableUnits = allUnits.filter(
    (u: any) => normalizeUnitStatus(u.status) === "disponible"
  ).length;
  const minPrice = allUnits
    .filter((u: any) => normalizeUnitStatus(u.status) === "disponible")
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
    amenities: safeStringArray(data.amenities),
    features: safeStringArray(data.features),
    highlight: data.highlight,
    visibility: data.visibility || "public",
    agentId: data.agent_id,
    brochureUrl: data.brochure_url || undefined,
    priceListUrl: data.price_list_url || undefined,
    videoUrl: data.video_url || undefined,
    videoUrls: safeStringArray(data.video_urls).length
      ? safeStringArray(data.video_urls)
      : data.video_url
        ? [data.video_url]
        : [],
    videoIsPrimary: data.video_is_primary || false,
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
  const images: UnitImage[] = safeRows(data.unit_images)
    .filter((img: any) => typeof img?.url === "string" && img.url.trim().length > 0)
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
    bedrooms: Number.isFinite(Number(data.bedrooms)) ? Number(data.bedrooms) : 0,
    bathrooms: Number.isFinite(Number(data.bathrooms)) ? Number(data.bathrooms) : 0,
    area: Number.isFinite(parseFloat(data.area)) ? parseFloat(data.area) : 0,
    balconyArea: data.balcony_area
      ? parseFloat(data.balcony_area)
      : undefined,
    totalArea: data.total_area ? parseFloat(data.total_area) : undefined,
    downPayment: data.down_payment ? parseFloat(data.down_payment) : undefined,
    installmentCount: data.installment_count || undefined,
    installmentValue: data.installment_value
      ? parseFloat(data.installment_value)
      : undefined,
    price: Number.isFinite(parseFloat(data.price)) ? parseFloat(data.price) : 0,
    currency: data.currency,
    expenses: data.expenses ? parseFloat(data.expenses) : undefined,
    orientation: data.orientation,
    status: normalizeUnitStatus(data.status),
    description: data.description,
    features: safeStringArray(data.features),
    videoUrl: data.video_url || undefined,
    images,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}
