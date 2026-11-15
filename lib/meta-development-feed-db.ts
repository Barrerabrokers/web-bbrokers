import { getSharedDatabase, releaseSharedDatabase } from '@/lib/database-pool';
import type { FeedDevelopment } from '@/lib/meta-development-feed';

/** Read only public catalog columns. Errors propagate: never turn a DB outage into an empty feed. */
export async function readMetaFeedDevelopments(): Promise<FeedDevelopment[]> {
  const sql = getSharedDatabase();
  try {
    const rows = await sql`
      SELECT d.id, d.slug, d.name, d.description, d.address, d.visibility, d.status, d.price_from, d.currency,
        COALESCE((SELECT json_agg(json_build_object('url', i.url) ORDER BY i.is_primary DESC NULLS LAST, i.display_order, i.id)
          FROM development_images i WHERE i.development_id=d.id), '[]'::json) AS images,
        COALESCE((SELECT json_agg(json_build_object('status', u.status, 'price', u.price, 'currency', u.currency))
          FROM units u WHERE u.development_id=d.id), '[]'::json) AS units
      FROM developments d WHERE d.visibility='public' ORDER BY d.id
    `;
    return rows as unknown as FeedDevelopment[];
  } finally { await releaseSharedDatabase(sql); }
}
