import { getMiaGuidance } from '@/lib/mia-guidance';
import { canonicalMiaUnit } from '@/lib/mia-unit-identity';
import { getMiaUnitPresentations,applyMiaUnitPresentation } from '@/lib/mia-unit-presentation';
import { getMiaSourceValidityConfirmations, confirmedMiaLegacyExpiry } from '@/lib/mia-source-confirmations';
import { getMiaUnitPlanReference, parseMiaUnitPlanUrl, readMiaUnitPlan } from '@/lib/mia-unit-plans';
import { getSharedDatabase, releaseSharedDatabase } from '@/lib/database-pool';
import { readSource, verifiedSheetQuotes } from '@/lib/whatsapp-mia-sources';
import { readSalesResource } from '@/lib/whatsapp-sales-catalog';
import { isMiaSourceUrl, type MiaSources } from '@/lib/whatsapp-mia-sources-config';
import { normalizeMia, type MiaFacts, type MiaUnit } from '@/lib/mia-sequence';

const norm = (value: unknown) => normalizeMia(String(value ?? '')).replace(/\s+/g,' ');
function months(value: unknown) {
  const text=norm(value), match=text.match(/^(\d+)\s*mes/);
  if (match) return Number(match[1]);
  if (/inmediata|listo|entrega inmediata/.test(text)) return 0;
  return undefined;
}
function sameProject(source: string, database: string) {
  const a=norm(source),b=norm(database);
  return a===b || a==='aguilar point'&&b==='aguilar point belgrano' || a==='we surf'&&b==='we surf recoleta';
}
const checkedPlans=new Map<string,number>();
async function readablePlan(url:string) {
  const extracted=parseMiaUnitPlanUrl(url);
  if(extracted){try{return (await readMiaUnitPlan(extracted.project,extracted.unit,extracted.area)).subarray(0,5).toString()==='%PDF-';}catch{return false;}}
  if (!isMiaSourceUrl(url)) return false;
  if ((checkedPlans.get(url)||0)>Date.now()) return true;
  try {
    const resource=await readSalesResource(url);
    const magic=resource.buffer.subarray(0,5).toString();
    const image=/^image\/(?:png|jpeg|webp)/.test(resource.type) && (resource.buffer[0]===0xff&&resource.buffer[1]===0xd8 || resource.buffer.subarray(1,4).toString()==='PNG' || resource.buffer.subarray(0,4).toString()==='RIFF');
    if (magic!=='%PDF-'&&!image) return false;
    if(checkedPlans.size>100)checkedPlans.clear();checkedPlans.set(url,Date.now()+300000);return true;
  } catch { return false; }
}
/** Prices come only from the configured index. CRM records supply exact unit-plan associations and reviewed typologies. */
export async function loadMiaSequenceInventory(sources:MiaSources,facts:MiaFacts,issues:string[]=[]):Promise<MiaUnit[]> {
  if (!sources.projectsUrl){issues.push('No hay enlace de proyectos configurado.');return [];}
  const [index,confirmations,presentations]=await Promise.all([readSource(sources.projectsUrl),getMiaSourceValidityConfirmations().catch(()=>[]),getMiaUnitPresentations().catch(()=>[])]);
  const head=index.rows.findIndex(row=>row.some(c=>/^(edificio|building|proyecto|desarrollo)$/.test(norm(c.value))));
  if(head<0){issues.push('El enlace de proyectos no contiene una columna de desarrollo.');return [];}
  const headers=index.rows[head].map(c=>norm(c.value));
  const name=headers.findIndex(h=>/^(edificio|building|proyecto|desarrollo)$/.test(h)),zone=headers.findIndex(h=>/barrio|neighborhood/.test(h)),list=headers.findIndex(h=>/lista de precios|list price|price list/.test(h)),delivery=headers.findIndex(h=>/tiempo de entrega|deliver time|plazo de entrega/.test(h)),payment=headers.findIndex(h=>/forma de pago|^payment$/.test(h)),brochure=headers.findIndex(h=>/brochure|folleto/.test(h));
  if([name,zone,list,delivery].some(i=>i<0)){issues.push('Faltan columnas de zona, precios o entrega en el índice.');return [];}
  const approved=(await getMiaGuidance().catch(()=>({approvedProjects:[]}))).approvedProjects||[];
  const rows=index.rows.slice(head+1).map(row=>row.map(c=>({...c})));
  for(const p of approved){let row=rows.find(r=>sameProject(String(r[name]?.value||''),p.name));if(!row){row=headers.map(()=>({value:''}));rows.push(row);}
    row[name]={value:p.name};row[zone]={value:p.neighborhood};row[delivery]={value:p.deliveryMaxMonths+' meses'};
    const priceSource=p.sources.find(u=>u.includes('docs.google.com/spreadsheets/'));if(priceSource)row[list]={value:priceSource,link:priceSource};
    const document=p.sources.find(u=>u.includes('drive.google.com/file/'));if(document&&brochure>=0)row[brochure]={value:document,link:document};
    if(p.financing&&payment>=0)row[payment]={value:p.financing.downPercent+'% anticipo + '+p.financing.payments+' cuotas'};
  }
  const projects=rows.filter(row=>(facts.projectName?sameProject(String(row[name]?.value||''),facts.projectName):facts.neighborhoods.some(n=>norm(row[zone]?.value).includes(norm(n)))) && !/office|oficina/.test(norm(row[name]?.value)));
  if(!projects.length)issues.push('No hay desarrollos para las zonas seleccionadas en el índice.');
  const sql=getSharedDatabase();let plans:any[]=[],reviewed:any[]=[],websites:any[]=[];
  try {
    websites=await sql`SELECT name,slug,brochure_url FROM developments WHERE COALESCE(visibility,'public')='public'`;
    plans=await sql`SELECT d.name,u.unit_number,array_agg(ui.url ORDER BY ui.is_primary DESC,ui.display_order,ui.id) AS plans FROM units u JOIN developments d ON d.id=u.development_id JOIN unit_images ui ON ui.unit_id=u.id AND ui.type='plano' WHERE COALESCE(d.visibility,'public')='public' GROUP BY d.name,u.unit_number`;
    reviewed=await sql`SELECT d.name,k.facts->'referenceUnits' AS units FROM crm_ai_project_knowledge k JOIN developments d ON d.id=k.development_id WHERE COALESCE(d.visibility,'public')='public'`;
  } finally {await releaseSharedDatabase(sql);}
  const inventory:MiaUnit[]=[];
  for(let start=0;start<projects.length;start+=4) {
    await Promise.all(projects.slice(start,start+4).map(async row=>{
      const url=row[list]?.link||String(row[list]?.value||''),project=String(row[name]?.value||'').trim(),wait=months(row[delivery]?.value);
      if(!isMiaSourceUrl(url)||wait===undefined)return;
      try {
        const table=await readSource(url);
        const header=table.rows.findIndex(r=>r.some(c=>/^(unidad|unit)(?:\s|\/|$)/.test(norm(c.value))));
        const planCol=header<0?-1:table.rows[header].findIndex(c=>/plano|floor.plan/.test(norm(c.value)));
        const knowledge=reviewed.filter(r=>sameProject(project,r.name));
        const quotes=verifiedSheetQuotes(table,project,'USD',confirmedMiaLegacyExpiry(table.url,confirmations));
        if(!quotes.length)issues.push(`${project}: no hay filas de unidades disponibles con precios verificables; revisar vigencia y columnas.`);
        let withPlans=0;
        for(const q of quotes) {
          const sourceRow=table.rows[q.row-1],planCell=sourceRow?.[planCol];
          const direct=planCell?.link||String(planCell?.value||'');
          const matchingPlans=plans.filter(p=>sameProject(project,p.name)&&canonicalMiaUnit(p.unit_number)===canonicalMiaUnit(q.unit));
          let planUrls=isMiaSourceUrl(direct)?[direct]:matchingPlans.length===1?matchingPlans[0].plans:[];
          const website=websites.find(d=>sameProject(project,d.name));
          const brochureUrl=row[brochure]?.link||String(row[brochure]?.value||'')||website?.brochure_url;
          if(!planUrls.length&&website&&isMiaSourceUrl(brochureUrl)&&q.area&&q.rooms){
            const extracted=await getMiaUnitPlanReference(website.slug,brochureUrl,q.unit,q.area).catch(()=>undefined);if(extracted)planUrls=[extracted];
          }
          const unitFacts=knowledge.length===1&&Array.isArray(knowledge[0].units)?knowledge[0].units.find((u:any)=>canonicalMiaUnit(u.unit)===canonicalMiaUnit(q.unit)):undefined;
          const candidate:MiaUnit={...q,rooms:q.rooms||unitFacts?.rooms,floor:q.floor|| (unitFacts?.floor!==undefined?String(unitFacts.floor):undefined),neighborhood:String(row[zone]?.value||''),deliveryMonths:wait,planUrls,website: websites.filter(d=>sameProject(project,d.name)).length===1?'https://barrerabrokers.com/desarrollos/'+encodeURIComponent(websites.find(d=>sameProject(project,d.name)).slug):undefined,cash:/^1\s*pago|^1\s*payment|^contado/.test(norm(row[payment]?.value))};
          // Do not use cached/reference prices from the CRM knowledge objects.
          if(candidate.planUrls?.length){withPlans++;const presented=applyMiaUnitPresentation(candidate,presentations),fact=approved.find(p=>sameProject(project,p.name));inventory.push(fact?{...presented,deliveryMonths:fact.deliveryMaxMonths,presentation:{...presented.presentation,deliveryMinMonths:fact.deliveryMinMonths}}:presented);}
        }
        if(quotes.length&&!withPlans)issues.push(`${project}: no se pudo asociar un plano exacto a las unidades de la lista.`);
      } catch(error) {issues.push(`${project}: ${error instanceof Error?error.message.slice(0,150):'fuente inaccesible'}`);}
    }));
  }
  return inventory;
}
export async function verifyMiaOfferPlans(units:MiaUnit[]) {
  const verified:MiaUnit[]=[];
  for(const unit of units) {
    const results=await Promise.all((unit.planUrls||[]).slice(0,3).map(async url=>({url,valid:await readablePlan(url)})));
    const planUrls=results.filter(r=>r.valid).map(r=>r.url);
    if(planUrls.length)verified.push({...unit,planUrls});
  }
  return verified;
}
