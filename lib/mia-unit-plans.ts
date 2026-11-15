import { canonicalMiaUnit } from '@/lib/mia-unit-identity';
import { getSharedDatabase, releaseSharedDatabase } from '@/lib/database-pool';
import { readSalesResource } from '@/lib/whatsapp-sales-catalog';

type Page={num:number;text:string};
type PlanDocument={bytes:Buffer;pages:Page[]};
const documents=new Map<string,{until:number;promise:Promise<PlanDocument>}>();
export function findMiaUnitPlanPage(pages:Page[],unit:string,area:number) {
  unit=canonicalMiaUnit(unit);
  if(!Number.isFinite(area)||area<=0)return undefined;
  const lettered=unit.toUpperCase().match(/^(\d{1,2})([A-Z])$/);
  if(lettered) {
    for(const page of pages) {
      const text=page.text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
      const heading=text.slice(0,150).replace(/\s+/g,'').match(/PLANTAS(\d{1,2})°(?:AL(\d{1,2})°)?/);
      if(!heading||Number(lettered[1])<Number(heading[1])||Number(lettered[1])>Number(heading[2]||heading[1])||!text.includes('PROPIA')||!text.includes('UNID'))continue;
      const lines=text.split(/\r?\n/).map(line=>line.trim()),start=lines.findIndex(line=>line==='DESC');
      if(start<0)continue;
      let cursor=start+1;const letters:string[]=[];
      while(cursor<lines.length&&/^[A-Z]$/.test(lines[cursor]))letters.push(lines[cursor++]);
      if(letters.length<2||!letters.includes(lettered[2]))continue;
      const values:string[]=[];
      while(cursor<lines.length&&/^[\d.,\s—-]+$/.test(lines[cursor]))values.push(...lines[cursor++].split(/\s+/));
      if(values.length!==letters.length*4)continue;
      const total=values.slice(-letters.length)[letters.indexOf(lettered[2])];
      if(Math.abs(Number(total.replace(',','.'))-area)<=.021)return page.num;
    }
    return undefined;
  }
  if(!/^\d{3,5}$/.test(unit))return undefined;
  const wanted=Number(unit),matches:{page:number;exact:boolean}[]=[];
  // Floor-plan tables list unit columns and their total areas in matching order.
  // Use explicit identifiers/ranges and the corresponding total, never a nearby area.
  for(const page of pages){
    const text=page.text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
    if(!/CUBIERTO/.test(text)||!/(?:PISO|PLANTA)/.test(text))continue;
    const captions=[...text.matchAll(/\bUNIDAD\s*(\d{3,5})(?:\s*(?:A|-)\s*(\d{3,5}))?/g)];
    const ranges=captions.filter(c=>c[2]);
    const identifiers=(ranges.length?ranges:captions).filter((c,i,all)=>all.findIndex(other=>other[1]===c[1]&&other[2]===c[2])===i);
    if(identifiers.length<2||identifiers.length>12)continue;
    const totalHeader=text.indexOf('TOTAL');if(totalHeader<0)continue;
    const areas=[...text.slice(totalHeader+5).matchAll(/(\d+(?:[.,]\d+)?)\s*M[²2]/g)].map(m=>Number(m[1].replace(',','.')));
    if(areas.length<identifiers.length*2)continue;
    const totals=areas.slice(-identifiers.length);
    const slot=identifiers.findIndex(c=>wanted>=Number(c[1])&&wanted<=Number(c[2]||c[1])&&(wanted-Number(c[1]))%100===0);
    if(slot>=0&&Math.abs(totals[slot]-area)<=.021)return page.num;
  }

  for(const page of pages) {
    const text=page.text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
    const captions=[...text.matchAll(/\b(?:UNIDAD|U\.?F\.?|U)\s*(\d{3,5})(?:\s*(?:A|-)\s*(\d{3,5}))?/g)];
    for(const caption of captions) {
      const start=Number(caption[1]),end=Number(caption[2]||caption[1]);
      if(wanted<start||wanted>end||(wanted-start)%100!==0)continue;
      const block=text.slice(caption.index!+caption[0].length).split(/\b(?:UNIDAD|UF)\s*\d/)[0].slice(0,250);
      const total=block.match(/SUP\.?\s*TOTAL\s*([\d.,]+)\s*M/);
      if(!total||Math.abs(Number(total[1].replace(',','.'))-area)>.021)continue;
      matches.push({page:page.num,exact:start===end});
    }
  }
  return matches.sort((a,b)=>Number(b.exact)-Number(a.exact)||a.page-b.page)[0]?.page;
}
async function document(url:string):Promise<PlanDocument> {
  const cached=documents.get(url);if(cached&&cached.until>Date.now())return cached.promise;
  const promise=(async()=>{
    const {buffer}=await readSalesResource(url);
    if(buffer.subarray(0,5).toString()!=='%PDF-')throw Error('Brochure no legible.');
    const {PDFParse}=await import('pdf-parse');const {getData}=await import('pdf-parse/worker');PDFParse.setWorker(getData());
    const parser=new PDFParse({data:buffer});try{const result=await parser.getText();if(result.pages.length>100)throw Error('Documento demasiado extenso.');return {bytes:buffer,pages:result.pages.map(p=>({num:p.num,text:p.text}))};}finally{await parser.destroy();}
  })();
  if(documents.size>=4)documents.delete(documents.keys().next().value!);
  documents.set(url,{until:Date.now()+120000,promise});
  try{return await promise;}catch(e){const failed=documents.get(url);if(failed)failed.until=Date.now()+30000;throw e;}
}
export async function getMiaUnitPlanReference(slug:string,brochureUrl:string,unit:string,area:string) {
  const squareMeters=Number(area.match(/[\d.,]+/)?.[0].replace(',','.'));
  const doc=await document(brochureUrl),page=findMiaUnitPlanPage(doc.pages,unit,squareMeters);
  return page?`https://barrerabrokers.com/api/catalog/mia-unit-plan?project=${encodeURIComponent(slug)}&unit=${encodeURIComponent(unit)}&area=${squareMeters}`:undefined;
}
export async function readMiaUnitPlan(slug:string,unit:string,area:number) {
  unit=canonicalMiaUnit(unit);
  if(!/^[a-z0-9-]{1,100}$/.test(slug)||!/^(?:\d{3,5}|\d{1,2}[A-Z])$/i.test(unit)||!Number.isFinite(area)||area<=0||area>2000)throw Error('Plano inválido.');
  const sql=getSharedDatabase();let project;
  try{[project]=await sql`SELECT name,slug,brochure_url FROM developments WHERE slug=${slug} AND COALESCE(visibility,'public')='public' LIMIT 1`;}finally{await releaseSharedDatabase(sql);}
  if(!project)throw Error('Plano no disponible.');
  let brochureUrl=project.brochure_url;
  try{
    const {getMiaSources}=await import('@/lib/whatsapp-agent-settings');
    const {readSource}=await import('@/lib/whatsapp-mia-sources');
    const {isMiaSourceUrl}=await import('@/lib/whatsapp-mia-sources-config');
    const sources=await getMiaSources();
    if(sources.projectsUrl){
      const index=await readSource(sources.projectsUrl),normalize=(v:unknown)=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
      const head=index.rows.findIndex(row=>row.some(c=>/^(edificio|building|proyecto|desarrollo)$/.test(normalize(c.value))));
      if(head>=0){
        const columns=index.rows[head].map(c=>normalize(c.value)),name=columns.findIndex(c=>/^(edificio|building|proyecto|desarrollo)$/.test(c)),brochure=columns.findIndex(c=>/brochure|folleto/.test(c));
        const row=index.rows.slice(head+1).find(row=>normalize(row[name]?.value)===normalize(project.name)||row.some(c=>c.link===`https://barrerabrokers.com/desarrollos/${slug}`));
        const linked=row?.[brochure]?.link||String(row?.[brochure]?.value||'');if(isMiaSourceUrl(linked))brochureUrl=linked;
      }
    }
  }catch{/* The public project's saved brochure remains a verified fallback. */}
  if(!brochureUrl)throw Error('Plano no disponible.');
  const doc=await document(brochureUrl),page=findMiaUnitPlanPage(doc.pages,unit,area);
  if(!page)throw Error('No se identificó el plano exacto.');
  const {PDFDocument}=await import('pdf-lib');const original=await PDFDocument.load(doc.bytes),output=await PDFDocument.create();
  const [selected]=await output.copyPages(original,[page-1]);output.addPage(selected);
  output.setTitle(`Plano ${slug} - Unidad ${unit}`);return Buffer.from(await output.save());
}
export function parseMiaUnitPlanUrl(value:string) {
  try{const url=new URL(value);if(url.origin!=='https://barrerabrokers.com'||url.pathname!=='/api/catalog/mia-unit-plan')return undefined;return {project:url.searchParams.get('project')||'',unit:url.searchParams.get('unit')||'',area:Number(url.searchParams.get('area'))};}catch{return undefined;}
}
