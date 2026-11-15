import { getSharedDatabase, releaseSharedDatabase } from "@/lib/database-pool";

export async function getCrmOwnerHistory(leadId: string, role?: string | null) {
  if (role !== "admin") return [];
  const sql = getSharedDatabase();
  try {
    return await sql`SELECT id,previous_owner_name,owner_name,actor_name,kind,recorded_at
      FROM crm_owner_history WHERE lead_id=${leadId} ORDER BY id DESC`;
  } finally { await releaseSharedDatabase(sql); }
}
