import { extractWhatsAppForm } from '@/lib/whatsapp-form-context';
import { normalizeMiaSearch, type AgentMemory, type AgentProject } from '@/lib/mia-agent-search';
export const miaCustomerText=(content:string)=>content.split(/\n\s*\[Origen del anuncio\]\s*\n/)[0].trim();
/** Ad copy can identify its subject, but never supplies customer preferences or current prices. */
export function miaCampaignIntake(content:string,catalog:AgentProject[],memory:AgentMemory){
 const body=miaCustomerText(content),form=extractWhatsAppForm(body),clean=normalizeMiaSearch(body);
 let ad:Record<string,unknown>={};
 try{const raw=content.split(/\n\s*\[Origen del anuncio\]\s*\n/)[1];if(raw)ad=JSON.parse(raw);}catch{}
 const copy=[ad.headline,ad.body].filter(v=>typeof v==='string').join(' ').slice(0,3000);
 const hasAd=!!(ad.source_id||copy),hasForm=Object.keys(form).length>=2;
 if(!hasAd&&!hasForm)return null;
 const preferences={...memory.preferences};
 const objective=normalizeMiaSearch(form.objective||'');
 if(/uso personal|para vivir|vivienda propia/.test(objective))preferences.purpose='living';
 else if(/temporario|airbnb/.test(objective))preferences.purpose='temporary_rental';
 else if(/inver|renta|alquil/.test(objective))preferences.purpose='investment';
 // Only the explicit budget answer, never amounts in ad copy. Keep currencies separate.
 const budget=form.budget||'';
 if(/\bUSD\b|d[oó]lares/i.test(budget)&&!/anticipo|cuota|ARS|pesos/i.test(budget)){
  const amounts=Array.from(budget.matchAll(/\d[\d.]*(?:,\d{1,2})?/g),m=>Number(m[0].replace(/[.,](?=\d{3}(?:[.,]|$))/g,'').replace(',','.')));
  if(amounts.length>0&&amounts.length<=2&&amounts.every(n=>n>0&&n<=1e12))preferences.total={amount:Math.max(...amounts),currency:'USD'};
 }
 const mentions=(text:string)=>catalog.filter(p=>[p.name,p.websiteName,p.slug].filter(Boolean).some(n=>(' '+normalizeMiaSearch(text)+' ').includes(' '+normalizeMiaSearch(n!)+' ')));
 const customerProjects=mentions(body),adProjects=mentions(copy);
 const project=customerProjects.length===1?customerProjects[0]:!customerProjects.length&&adProjects.length===1?adProjects[0]:undefined;
 const introductory=hasForm||/^(?:hola|buenas|buen dia|buenas tardes|buenas noches)?\s*(?:quiero|quisiera|me gustaria|me interesa|necesito|deseo)?\s*(?:mas )?(?:info|informacion|saber mas|conocer mas)(?: sobre (?:el anuncio|el proyecto|el negocio|esto))?$/.test(clean)||/^(?:hola|buenas|buen dia|buenas tardes|buenas noches)$/.test(clean);
 const next={...memory,preferences};
 if(!introductory)return {memory:next,project:undefined,reply:undefined};
 if(project)return {memory:{...next,preferences:{...preferences,projects:[project.name]}},project,reply:undefined};
 const zones=Array.from(new Set(catalog.map(p=>p.neighborhood).filter((n):n is string=>!!n))).filter(n=>(' '+normalizeMiaSearch(copy)+' ').includes(' '+normalizeMiaSearch(n)+' '));
 const known=[preferences.rooms.length?'la tipología':null,form.budget?'el presupuesto':null,preferences.purpose==='living'?'el objetivo de uso personal':preferences.purpose?'el objetivo de inversión':null].filter(Boolean);
 const intro=hasForm?'Gracias por completar el formulario.' : 'Hola, soy MIA, asistente de Barrera Brokers.';
 const ack=known.length?' Tengo presente '+known.join(' y ')+' que indicaste.':'';
 const question=preferences.projects.length?'¿Qué te gustaría conocer de '+preferences.projects.join(' o ')+'?':preferences.neighborhoods.length?'¿Buscás una propiedad terminada o también considerarías una en construcción?':zones.length===1?'El anuncio menciona '+zones[0]+'. ¿Querés que revisemos opciones allí o preferís otro barrio?':'¿En qué barrio te gustaría buscar?';
 return {memory:next,project:undefined,reply:intro+ack+' '+question};
}
