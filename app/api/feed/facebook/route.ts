import { buildMetaDevelopmentFeed, type FeedLocation } from '@/lib/meta-development-feed';
import { readMetaFeedDevelopments } from '@/lib/meta-development-feed-db';
import locations from '@/data/meta-development-locations.json';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET() {
  try {
    const feed = buildMetaDevelopmentFeed(await readMetaFeedDevelopments(), locations as Record<string, FeedLocation>);
    // A failed or incomplete source must not tell Meta to remove an existing catalog.
    if (feed.issues.length) console.warn('Meta development feed excluded incomplete listings', {issues:feed.issues});
    if (!feed.count) {
      console.warn('Meta development feed incomplete', {count:feed.count, issues:feed.issues});
      return new Response('Catalog data is awaiting validation.', {status:503,headers:{'Cache-Control':'no-store','Retry-After':'3600'}});
    }
    return new Response(feed.xml, {headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, s-maxage=3600','X-Content-Type-Options':'nosniff'}});
  } catch {
    console.error('Meta development feed source unavailable');
    return new Response('Catalog source temporarily unavailable.', {status:503,headers:{'Cache-Control':'no-store','Retry-After':'300'}});
  }
}
