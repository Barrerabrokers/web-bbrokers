import { cache } from "react";
import { getSharedDatabase, releaseSharedDatabase } from "@/lib/database-pool";

// Only public developments belong in the visitor navigation, regardless of the viewer's role.
export const getPublicDevelopmentLinks = cache(async () => {
  const sql = getSharedDatabase();
  try {
    const rows = await sql`SELECT name,slug FROM developments WHERE visibility='public' ORDER BY sort_order ASC NULLS LAST,created_at DESC,id ASC`;
    return rows.map(row => ({ name: String(row.name).trim(), href: `/desarrollos/${row.slug}` }));
  } finally { await releaseSharedDatabase(sql); }
});
