import { randomUUID } from "crypto";
import postgres from "postgres";

export type RecoveryStatus = "queued" | "running" | "complete" | "partial" | "failed";
export type MetaRecoveryJob = {
  id: string;
  status: RecoveryStatus;
  createdBy: string | null;
  since: string;
  until: string;
  createdAt: string;
  updatedAt: string;
  state: Record<string, unknown> | null;
};

type Database = ReturnType<typeof postgres>;
type Transaction = postgres.TransactionSql;
type JobRow = {
  id: string;
  status: RecoveryStatus;
  created_by: string | null;
  since_at: Date | string;
  until_at: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
  state: Record<string, unknown> | null;
};

// Transaction locks remain safe behind the Supabase transaction pooler.
const LOCK_NAMESPACE = 1296389185;
const SCHEMA_LOCK = 1;
const ENQUEUE_LOCK = 2;
const STATUSES: readonly RecoveryStatus[] = ["queued", "running", "complete", "partial", "failed"];
let schemaPromise: Promise<void> | undefined;

function database(): Database {
  const url = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("META_RECOVERY_DATABASE_UNAVAILABLE");
  return postgres(url, { ssl: "require", prepare: false, max: 1, connect_timeout: 8, idle_timeout: 5, onnotice() {} });
}

async function transaction<T>(run: (sql: Transaction) => Promise<T>): Promise<T> {
  const sql = database();
  try {
    return await sql.begin(async tx => {
      await tx`SET LOCAL statement_timeout = '15s'`;
      await tx`SET LOCAL lock_timeout = '3s'`;
      await tx`SET LOCAL idle_in_transaction_session_timeout = '15s'`;
      return run(tx);
    }) as T;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function ensureSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = transaction(async sql => {
      const existing = await sql`SELECT relrowsecurity,
        to_regclass('public.crm_meta_recovery_one_active') AS active_index,
        to_regclass('public.crm_meta_recovery_latest') AS latest_index
        FROM pg_class WHERE oid=to_regclass('public.crm_meta_recovery_jobs')`;
      if (existing[0]?.relrowsecurity && existing[0]?.active_index && existing[0]?.latest_index) return;
      await sql`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE}, ${SCHEMA_LOCK})`;
      await sql`
        CREATE TABLE IF NOT EXISTS public.crm_meta_recovery_jobs (
          id UUID PRIMARY KEY,
          status TEXT NOT NULL DEFAULT 'queued'
            CONSTRAINT crm_meta_recovery_status CHECK (status IN ('queued','running','complete','partial','failed')),
          created_by TEXT,
          since_at TIMESTAMPTZ NOT NULL,
          until_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
          state JSONB,
          lease_token UUID,
          lease_until TIMESTAMPTZ,
          CONSTRAINT crm_meta_recovery_window CHECK (since_at = until_at - interval '720 hours'),
          CONSTRAINT crm_meta_recovery_object CHECK (state IS NULL OR jsonb_typeof(state) = 'object'),
          CONSTRAINT crm_meta_recovery_lease_pair CHECK ((lease_token IS NULL) = (lease_until IS NULL)),
          CONSTRAINT crm_meta_recovery_terminal_lease CHECK (status IN ('queued','running') OR lease_token IS NULL)
        )`;
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS crm_meta_recovery_one_active
        ON public.crm_meta_recovery_jobs ((true)) WHERE status IN ('queued','running')`;
      await sql`CREATE INDEX IF NOT EXISTS crm_meta_recovery_latest
        ON public.crm_meta_recovery_jobs (created_at DESC, id DESC)`;
      // No client policies: access is restricted to the privileged server.
      await sql`ALTER TABLE public.crm_meta_recovery_jobs ENABLE ROW LEVEL SECURITY`;
    }).catch(error => {
      schemaPromise = undefined;
      throw error;
    });
  }
  return schemaPromise;
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function job(row: JobRow): MetaRecoveryJob {
  return {
    id: row.id, status: row.status, createdBy: row.created_by,
    since: iso(row.since_at), until: iso(row.until_at),
    createdAt: iso(row.created_at), updatedAt: iso(row.updated_at), state: row.state,
  };
}

export async function enqueueMetaRecovery(
  { createdBy = null, automatic = false }: { createdBy?: string | null; automatic?: boolean } = {},
): Promise<MetaRecoveryJob> {
  await ensureSchema();
  return transaction(async sql => {
    await sql`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE}, ${ENQUEUE_LOCK})`;
    const active = await sql<JobRow[]>`SELECT * FROM public.crm_meta_recovery_jobs
      WHERE status IN ('queued','running') ORDER BY created_at DESC, id DESC LIMIT 1`;
    if (active[0]) return job(active[0]);
    if (automatic) {
      const recent = await sql<JobRow[]>`SELECT * FROM public.crm_meta_recovery_jobs
        WHERE status IN ('complete','partial','failed')
          AND created_at > clock_timestamp() - interval '15 minutes'
        ORDER BY created_at DESC, id DESC LIMIT 1`;
      if (recent[0]) return job(recent[0]);
    }
    const rows = await sql<JobRow[]>`
      WITH boundary AS (SELECT clock_timestamp() AS until_at)
      INSERT INTO public.crm_meta_recovery_jobs (id, created_by, since_at, until_at)
      SELECT ${randomUUID()}::uuid, ${createdBy}, until_at - interval '720 hours', until_at FROM boundary
      RETURNING *`;
    return job(rows[0]);
  });
}

export async function getMetaRecovery(): Promise<MetaRecoveryJob | null> {
  await ensureSchema();
  return transaction(async sql => {
    const rows = await sql<JobRow[]>`SELECT * FROM public.crm_meta_recovery_jobs
      ORDER BY created_at DESC, id DESC LIMIT 1`;
    return rows[0] ? job(rows[0]) : null;
  });
}

export async function claimMetaRecovery(): Promise<{ job: MetaRecoveryJob; lease: string } | null> {
  await ensureSchema();
  return transaction(async sql => {
    const lease = randomUUID();
    const rows = await sql<JobRow[]>`
      WITH candidate AS (
        SELECT id FROM public.crm_meta_recovery_jobs
        WHERE status IN ('queued','running') AND (lease_until IS NULL OR lease_until <= clock_timestamp())
        ORDER BY created_at, id FOR UPDATE SKIP LOCKED LIMIT 1
      )
      UPDATE public.crm_meta_recovery_jobs AS jobs
      SET status = 'running', lease_token = ${lease}::uuid,
          lease_until = clock_timestamp() + interval '10 minutes', updated_at = clock_timestamp()
      FROM candidate WHERE jobs.id = candidate.id RETURNING jobs.*`;
    return rows[0] ? { job: job(rows[0]), lease } : null;
  });
}

export async function saveMetaRecovery(
  id: string, lease: string, state: Record<string, unknown>, status?: RecoveryStatus,
): Promise<boolean> {
  if (status !== undefined && !STATUSES.includes(status)) throw new Error("META_RECOVERY_INVALID_STATUS");
  if (state === null || typeof state !== "object" || Array.isArray(state)) throw new Error("META_RECOVERY_INVALID_STATE");
  await ensureSchema();
  return transaction(async sql => {
    // Lock first, then check expiry: a worker whose lease expires while waiting
    // for another transaction must not save its stale progress.
    const owner = await sql`SELECT id FROM public.crm_meta_recovery_jobs
      WHERE id = ${id}::uuid AND lease_token = ${lease}::uuid FOR UPDATE`;
    if (!owner[0]) return false;
    const terminal = status !== undefined && !["queued", "running"].includes(status);
    const rows = await sql`
      UPDATE public.crm_meta_recovery_jobs
      SET state = ${sql.json(state as postgres.JSONValue)}, status = COALESCE(${status ?? null}::text, status),
          updated_at = clock_timestamp(),
          lease_token = CASE WHEN ${terminal} THEN NULL ELSE lease_token END,
          lease_until = CASE WHEN ${terminal} THEN NULL ELSE clock_timestamp() + interval '10 minutes' END
      WHERE id = ${id}::uuid AND lease_token = ${lease}::uuid AND lease_until > clock_timestamp()
        AND status IN ('queued','running')
      RETURNING id`;
    return rows.length === 1;
  });
}

export async function releaseMetaRecovery(id: string, lease: string): Promise<void> {
  await ensureSchema();
  await transaction(async sql => {
    // Stale workers cannot release a successor's claim. Preserve progress/status.
    await sql`UPDATE public.crm_meta_recovery_jobs SET lease_token = NULL, lease_until = NULL
      WHERE id = ${id}::uuid AND lease_token = ${lease}::uuid`;
  });
}
