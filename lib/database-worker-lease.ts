import { randomUUID } from "crypto";
import type postgres from "postgres";
type Sql = ReturnType<typeof postgres>;

// Session advisory locks cannot span queries through transaction pooling.
// A durable lease prevents overlapping workers without reserving a connection.
export async function acquireWorkerLease(sql: Sql, key: string): Promise<string | null> {
  const owner = randomUUID();
  const rows = await sql`INSERT INTO database_worker_leases(worker_key,owner,lease_until)
    VALUES(${key},${owner},NOW()+INTERVAL '10 minutes')
    ON CONFLICT(worker_key) DO UPDATE SET owner=EXCLUDED.owner,lease_until=EXCLUDED.lease_until
      WHERE database_worker_leases.lease_until<=NOW()
    RETURNING owner`;
  return rows.length ? owner : null;
}

export async function releaseWorkerLease(sql: Sql, key: string, owner: string) {
  await sql`DELETE FROM database_worker_leases WHERE worker_key=${key} AND owner=${owner}`;
}
