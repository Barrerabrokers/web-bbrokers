import { getSharedDatabase, releaseSharedDatabase } from "@/lib/database-pool";
import { catalogOrderMatches, type CatalogOrderInput } from "@/lib/catalog-order";

export async function saveCatalogOrder(input: CatalogOrderInput) {
  const sql = getSharedDatabase();
  try {
    return await sql.begin(async tx => {
      await tx`SET LOCAL lock_timeout='5s'`;
      // Table names are fixed branches; request values never become SQL identifiers.
      // Lock inserts/deletes as well as other reorder requests for the brief transaction.
      if (input.kind === "properties") await tx`LOCK TABLE properties IN SHARE ROW EXCLUSIVE MODE`;
      else await tx`LOCK TABLE developments IN SHARE ROW EXCLUSIVE MODE`;
      const rows = input.kind === "properties"
        ? await tx`SELECT id FROM properties ORDER BY sort_order ASC NULLS LAST, created_at DESC, id ASC`
        : await tx`SELECT id FROM developments ORDER BY sort_order ASC NULLS LAST, created_at DESC, id ASC`;
      if (!catalogOrderMatches(rows.map(row => String(row.id)), input.version)) {
        return { status: 409, error: "El catálogo cambió. Actualizá la página antes de volver a ordenar." };
      }
      // One statement updates the entire order atomically, including hidden entries.
      if (input.kind === "properties") await tx`UPDATE properties p SET sort_order=o.position-1
        FROM unnest(${input.ids}::uuid[]) WITH ORDINALITY AS o(id,position) WHERE p.id=o.id`;
      else await tx`UPDATE developments d SET sort_order=o.position-1
        FROM unnest(${input.ids}::uuid[]) WITH ORDINALITY AS o(id,position) WHERE d.id=o.id`;
      return { status: 200, ids: input.ids };
    });
  } finally { await releaseSharedDatabase(sql); }
}
