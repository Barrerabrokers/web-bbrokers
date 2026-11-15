import { getSharedDatabase, releaseSharedDatabase } from '@/lib/database-pool';
import { selectSalesProjects } from '@/lib/whatsapp-sales-catalog';
import { hasMiaValues } from '@/lib/whatsapp-mia-safety';
type WebsiteDevelopment={name:string;slug:string;neighborhood?:string;address?:unknown;description?:unknown;amenities?:unknown;features?:unknown};
/** These are the same public records rendered by /desarrollos/[slug], not private CRM notes. */
export function miaWebsiteText(value:unknown) {
  return String(value||'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<[^>]+>/g,'\n').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').split(/\n|(?<=[.!?])\s+/).map(s=>s.trim()).filter(s=>s&&!hasMiaValues(s)&&!/entrega|posesi[oó]n|financiaci[oó]n|anticipo|cuotas?|disponib|reservad|vendid|rendim|rentabilidad|garantiz/i.test(s)).join(' ').slice(0,1000);
}
export async function loadMiaWebsiteContext(query:string) {
  const sql=getSharedDatabase();
  try {
    const rows=await sql<WebsiteDevelopment[]>`SELECT name,slug,location AS neighborhood,address,description,amenities,features FROM developments WHERE COALESCE(visibility,'public')='public' ORDER BY name`;
    const references=selectSalesProjects(rows,query).map(({project})=>({title:`Web Barrera Brokers · ${project.name}`,url:`https://barrerabrokers.com/desarrollos/${encodeURIComponent(project.slug)}`,text:[`Desarrollo: ${project.name}. Barrio: ${project.neighborhood||'sin especificar'}.`,project.address?`Dirección publicada: ${project.address}.`:'',Array.isArray(project.amenities)?`Amenities publicados: ${project.amenities.map(miaWebsiteText).filter(Boolean).join(', ')}.`:'',Array.isArray(project.features)?`Características publicadas: ${project.features.map(miaWebsiteText).filter(Boolean).join(', ')}.`:'',miaWebsiteText(project.description)].filter(Boolean).join(' ').slice(0,1500)}));
    return {references,issues:[] as string[]};
  } finally {await releaseSharedDatabase(sql);}
}
