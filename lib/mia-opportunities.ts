import { readSource, sourceValidity, type MiaSourceTable } from '@/lib/whatsapp-mia-sources';
import { normalizeMiaSearch } from '@/lib/mia-agent-search';

export const MIA_OPPORTUNITIES_URL='https://docs.google.com/spreadsheets/d/1ETOspJQfcnAVvjGp7mJ2Qx5TNXDQsYG88A9GRSPClMA/edit?gid=2095154362#gid=2095154362';
export type MiaOpportunity={name:string;slug:string;websiteName?:string;neighborhood:string;address:string;crossStreet:string;delivery:string;months:number|null;stage:string;payment:string;priceM2:string|null;garage:boolean|null;brochure?:string;priceList?:string;status:string};
const clean=(v:unknown)=>String(v??'').trim().replace(/\s+/g,' ');
const field=(v:unknown)=>{const s=clean(v);return /^[-—\s]*$/.test(s)||s.length>200||/https?:|[<>\n]/.test(s)?'':s;};
/** Read the named columns themselves, never derive per-m² prices from unit totals. */
export function parseMiaOpportunities(table:MiaSourceTable):MiaOpportunity[]{
 if(!sourceValidity(table.text))throw Error('Expired opportunities source');
 const hi=table.rows.findIndex(r=>r.some(c=>normalizeMiaSearch(String(c.value))==='edificio'));
 if(hi<0)throw Error('Missing opportunities header');
 const headers=table.rows[hi].map(c=>normalizeMiaSearch(String(c.value)));
 const col=(pattern:RegExp)=>headers.findIndex(h=>pattern.test(h));
 const columns={name:col(/^edificio$/),address:col(/^direccion$/),neighborhood:col(/^barrio$/),cross:col(/calle que cruza|^cruce$/),delivery:col(/tiempo de entrega/),stage:col(/etapa/),payment:col(/forma de pago/),price:col(/precio por m2|precio.*m²/),garage:col(/garage|cochera/),brochure:col(/^brochure$/)};
 if(Object.values(columns).some(c=>c<0))throw Error('Missing opportunities columns');
 const listCol=col(/lista de precios/);
 const seen=new Set<string>();
 return table.rows.slice(hi+1).flatMap(row=>{
  const get=(key:keyof typeof columns)=>field(row[columns[key]]?.value);
  const name=get('name'),slug=normalizeMiaSearch(name).replace(/ /g,'-');
  if(!name||slug==='reventas'||['alto-grande-palermo','alto-grande-cabrera'].includes(slug))return [];
  if(seen.has(slug))throw Error('Duplicate opportunity');seen.add(slug);
  const price=get('price'),priceM2=/^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?\s*USD$/i.test(price)?price.replace(/\s*USD$/i,' USD'):null;
  const delivery=get('delivery'),match=delivery.match(/^(\d{1,2})\s*mes(?:es)?$/i),months=match?Number(match[1]):null;
  const garage=normalizeMiaSearch(get('garage')),brochure=row[columns.brochure]?.link;
  return [{name,slug,websiteName:slug==='we-surf'?'We Surf Recoleta':undefined,neighborhood:get('neighborhood'),address:get('address'),crossStreet:get('cross'),delivery,months,stage:get('stage'),payment:get('payment'),priceM2,garage:garage==='si'?true:garage==='no'?false:null,brochure,priceList:row[listCol]?.link||String(row[listCol]?.value||''),status:months===0?'finalizado':'en_construccion'}];
 });
}
export async function loadMiaOpportunities(){const rows=parseMiaOpportunities(await readSource(MIA_OPPORTUNITIES_URL));if(!rows.length)throw Error('Empty opportunities source');return rows;}
