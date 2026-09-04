import postgres from "postgres";

export const META_LEADS_SYNC_KEY = "meta_leads";

function databaseUrl() {
  return process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL;
}

export async function getMetaLeadsLastSyncAt(): Promise<string | null> {
  const url = databaseUrl();
  if (!url) return null;

  const sql = postgres(url, { ssl: "require", max: 1, prepare: false });
  try {
    const rows = await sql`
      SELECT last_success_at
      FROM crm_integration_sync_state
      WHERE integration = ${META_LEADS_SYNC_KEY}
      LIMIT 1
    `;
    return rows[0]?.last_success_at
      ? new Date(rows[0].last_success_at as string).toISOString()
      : null;
  } finally {
    await sql.end();
  }
}

export async function recordMetaLeadsSync(details: Record<string, unknown>) {
  const url = databaseUrl();
  if (!url) throw new Error("No database connection URL found");

  const sql = postgres(url, { ssl: "require", max: 1, prepare: false });
  try {
    const rows = await sql`
      INSERT INTO crm_integration_sync_state (
        integration,
        last_success_at,
        details,
        updated_at
      ) VALUES (
        ${META_LEADS_SYNC_KEY},
        NOW(),
        ${JSON.stringify(details)}::jsonb,
        NOW()
      )
      ON CONFLICT (integration)
      DO UPDATE SET
        last_success_at = EXCLUDED.last_success_at,
        details = EXCLUDED.details,
        updated_at = NOW()
      RETURNING last_success_at
    `;
    return new Date(rows[0].last_success_at as string).toISOString();
  } finally {
    await sql.end();
  }
}
