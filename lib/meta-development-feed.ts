/** Meta home listings feed. IDs must remain identical to ViewContent.content_ids. */
export type FeedLocation = {
  address: string; city: string; region: string; country: string;
  postalCode: string; latitude: number; longitude: number; neighborhood: string;
  source: string;
};
export type FeedDevelopment = {
  id: string; slug: string; name: string; description?: string; address: string;
  visibility: string; status: string; price_from?: string | number; currency?: string;
  images: { url: string }[];
  units: { status: string; price: string | number; currency?: string }[];
};
const origin = 'https://barrerabrokers.com';
const xml = (v: unknown) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
const element = (name: string, value: unknown) => `<${name}>${xml(value)}</${name}>`;
function imageUrl(value: string) {
  try {
    const url = new URL(value, origin);
    if (url.protocol !== 'https:' || url.username || url.password || url.searchParams.has('share') || /\/admin(?:\/|$)/.test(url.pathname)) return null;
    return url.href;
  } catch { return null; }
}
export function buildMetaDevelopmentFeed(developments: FeedDevelopment[], locations: Record<string, FeedLocation>) {
  const listings: string[] = [];
  const issues: {id: string; name: string; missing: string[]}[] = [];
  const seen = new Set<string>();
  for (const d of developments) {
    if (d.visibility !== 'public') continue;
    const missing: string[] = [];
    if (!d.id || seen.has(d.id)) missing.push('unique_id');
    seen.add(d.id);
    if (!d.name?.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(d.slug)) missing.push('name_or_slug');
    const geo = locations[d.id];
    if (!geo || geo.address !== d.address) missing.push('verified_location_for_current_address');
    if (geo && (!geo.city || !geo.region || !geo.country || !geo.postalCode || !geo.neighborhood || !geo.source || !Number.isFinite(geo.latitude) || !Number.isFinite(geo.longitude) || Math.abs(geo.latitude)>90 || Math.abs(geo.longitude)>180)) missing.push('complete_location');
    // Only available inventory defines price when units exist. Never advertise a sold unit.
    const available = (d.units || []).filter(u => u.status === 'disponible');
    const candidates = d.units?.length ? available : [{price:d.price_from ?? 0,currency:d.currency}];
    const priced = candidates.map(u => ({price:Number(u.price),currency:u.currency || d.currency}));
    const currencies = new Set(priced.map(u => u.currency));
    if (!priced.length || priced.some(u => !Number.isFinite(u.price) || u.price <= 0 || !['USD','ARS'].includes(u.currency || '')) || currencies.size !== 1) missing.push('available_price_and_currency');
    const images = (d.images || []).map(i => imageUrl(i.url)).filter((u): u is string => !!u).slice(0,20);
    if (!images.length) missing.push('public_image');
    if (missing.length) { issues.push({id:d.id,name:d.name,missing}); continue; }
    const price = Math.min(...priced.map(u => u.price));
    const description = (d.description || d.name).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,5000);
    const components = {addr1:geo.address,city:geo.city,region:geo.region,country:geo.country,postal_code:geo.postalCode};
    listings.push('<listing>' + element('home_listing_id',d.id) + element('name',`${d.name.trim()} - ${geo.neighborhood}`) + element('availability','for_sale') + element('description',description) + '<address format="simple">' + Object.entries(components).map(([k,v])=>`<component name="${k}">${xml(v)}</component>`).join('') + '</address>' + element('latitude',geo.latitude) + element('longitude',geo.longitude) + element('neighborhood',geo.neighborhood) + images.map(u=>'<image>'+element('url',u)+'</image>').join('') + element('price',`${price.toFixed(2)} ${priced[0].currency}`) + element('url',`${origin}/desarrollos/${d.slug}`) + element('listing_type',['pre_venta','en_construccion'].includes(d.status)?'new_construction':'for_sale_by_agent') + '</listing>');
  }
  return {count:listings.length,issues,xml:'<?xml version="1.0" encoding="UTF-8"?>\n<listings><title>Barrera Brokers - Desarrollos</title><link rel="self" href="https://barrerabrokers.com/api/feed/facebook"/>'+listings.join('\n')+'</listings>'};
}
