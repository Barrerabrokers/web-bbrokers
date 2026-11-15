import postgres from "postgres";

// Serverless invocations must not reuse sockets left behind by a suspended VM.
const isolatedPools = new WeakSet<ReturnType<typeof postgres>>();
let pool: ReturnType<typeof postgres> | undefined;

export function getSharedDatabase() {
  const building = process.env.NEXT_PHASE === "phase-production-build";
  const isolated = building || process.env.VERCEL === "1";
  if (!isolated && pool) return pool;
  const url = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!url) throw new Error("No database connection URL found");
  const connection = postgres(url, {
    ssl: "require", prepare: false, max: 3,
    connect_timeout: 8, idle_timeout: 5, max_lifetime: 60,
    onnotice: () => {},
  });
  if (isolated) isolatedPools.add(connection);
  else pool = connection;
  return connection;
}

// End only the pool owned by this operation. Local server requests can keep
// sharing their pool; concurrent Vercel operations each own an isolated pool.
export async function releaseSharedDatabase(sql?: ReturnType<typeof postgres> | null) {
  if (sql && isolatedPools.has(sql)) await sql.end({ timeout: 5 });
}
