import type postgres from "postgres";
import { getSharedDatabase, releaseSharedDatabase } from "@/lib/database-pool";

// A deliberately conservative application budget, independent of provider billing.
export function storageBudgetBytes() {
  const value = Number(process.env.STORAGE_BUDGET_BYTES);
  return Number.isSafeInteger(value) && value > 0 ? value : 5 * 1024 ** 3;
}

export async function reserveStorageUpload(path: string, bytes: number, existingSql?: ReturnType<typeof postgres>) {
  const sql = existingSql || getSharedDatabase();
  try {
  const budget = storageBudgetBytes();
  await sql.begin(async tx => {
    // Transaction-scoped locks work correctly with the Supabase transaction pooler.
    await tx`SELECT pg_advisory_xact_lock(735208450)`;
    await tx`DELETE FROM storage_upload_reservations WHERE expires_at <= NOW()`;
    const [usage] = await tx`SELECT
      COALESCE((SELECT SUM((metadata->>'size')::bigint) FROM storage.objects WHERE bucket_id='properties'),0)
      + COALESCE((SELECT SUM(r.bytes) FROM storage_upload_reservations r WHERE NOT EXISTS(
          SELECT 1 FROM storage.objects o WHERE o.bucket_id='properties' AND o.name=r.path)),0) AS bytes`;
    if (Number(usage.bytes) + bytes > budget) throw new Error("Se alcanzó el límite preventivo de almacenamiento. Revisá el consumo antes de subir más archivos.");
    await tx`INSERT INTO storage_upload_reservations(path,bytes,expires_at) VALUES(${path},${bytes},NOW()+INTERVAL '2 hours')`;
  });
  } finally { if (!existingSql) await releaseSharedDatabase(sql); }
}

export async function releaseStorageReservation(path: string) {
  const sql = getSharedDatabase();
  try { await sql`DELETE FROM storage_upload_reservations WHERE path=${path}`; }
  finally { await releaseSharedDatabase(sql); }
}
