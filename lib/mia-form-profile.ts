import { extractConversationForms, extractWhatsAppForm, type FormContext } from '@/lib/whatsapp-form-context';
import { getSharedDatabase, releaseSharedDatabase } from '@/lib/database-pool';
import { normalizeMiaSearch, type AgentMemory } from '@/lib/mia-agent-search';
import type { MiaOpportunity } from '@/lib/mia-opportunities';

export async function loadMiaLeadForm(conversationId:string):Promise<FormContext>{
 const sql=getSharedDatabase();
 try{
  const [lead]=await sql`SELECT l.first_name,l.last_name,l.email,l.phone,l.meta_properties FROM crm_whatsapp_conversations c JOIN crm_leads l ON l.id=c.lead_id WHERE c.id=${conversationId}`;
  if(!lead)return {};
  const props=lead.meta_properties||{},text=Object.entries(props).filter(([key,value])=>key.startsWith('meta_field_')&&typeof value==='string').map(([key,value])=>key.replace(/^meta_field_/,'').replace(/_/g,' ')+': '+value).join('\n');
  return {...extractWhatsAppForm(text),name:[lead.first_name,lead.last_name].filter(Boolean).join(' ')||undefined,email:lead.email||undefined,phone:lead.phone||undefined};
 }finally{await releaseSharedDatabase(sql);}
}
export function recoverMiaForm(memory:AgentMemory,messages:{direction:string;content:string}[],crm:FormContext,catalog:MiaOpportunity[]):AgentMemory{
 const knownCrm=Object.fromEntries(Object.entries(crm).filter(([,v])=>typeof v==='string'&&v.trim()));
 const form={...memory.form,...knownCrm,...extractConversationForms(messages)};
 // Ad text supplies only the advertised location/project, never the customer's budget or objective.
 let ad='';for(const m of messages.filter(m=>m.direction==='inbound')){try{const r=JSON.parse(m.content.split('[Origen del anuncio]')[1]||'{}');ad=[r.headline,r.body].filter(v=>typeof v==='string').join(' ');}catch{}}
 const scope=normalizeMiaSearch([form.project,form.neighborhood,ad].filter(Boolean).join(' '));
 const explicit=catalog.filter(p=>(' '+scope+' ').includes(' '+normalizeMiaSearch(p.name)+' '));
 const neighborhoods=Array.from(new Set(catalog.map(p=>p.neighborhood))).filter(n=>(' '+scope+' ').includes(' '+normalizeMiaSearch(n)+' '));
 if(!form.neighborhood&&neighborhoods.length===1)form.neighborhood=neighborhoods[0];
 if(!form.project&&explicit.length===1)form.project=explicit[0].name;
 const preferences={...memory.preferences};
 if(!preferences.projects.length&&explicit.length===1)preferences.projects=[explicit[0].name];
 if(!preferences.neighborhoods.length&&neighborhoods.length===1)preferences.neighborhoods=neighborhoods;
 const goal=normalizeMiaSearch(form.objective||'');
 if(!preferences.purpose&&goal)preferences.purpose=/vivir|vivienda|uso personal/.test(goal)?'living':/temporari|airbnb/.test(goal)?'temporary_rental':/renta|alquiler|ingresos|inver|valoriza/.test(goal)?'investment':null;
 if(!preferences.total&&form.budget&&!/anticipo|cuota|mensual/i.test(form.budget)&&/USD|d[oó]lares/i.test(form.budget)){
  const nums=form.budget.match(/\d[\d.,]*/g)?.map(v=>Number(v.replace(/\.(?=\d{3}(?:\D|$))/g,'').replace(',','.')))||[];
  if(nums.length&&nums.length<=2&&nums.every(v=>v>0&&v<1e12))preferences.total={amount:Math.max(...nums),currency:'USD'};
 }
 const financing=[form.budget,form.purchase].filter(Boolean).join(' ');
 const amount=(kind:string)=>{const match=financing.match(new RegExp(kind+'\\s*(?:de|hasta)?\\s*(USD|U\\$S|ARS|d[oó]lares|pesos)\\s*([\\d.,]+)','i'));if(!match)return null;const value=Number(match[2].replace(/\.(?=\d{3}(?:\D|$))/g,'').replace(',','.'));return value>0?{amount:value,currency:/ARS|pesos/i.test(match[1])?'ARS' as const:'USD' as const}:null;};
 if(!preferences.down)preferences.down=amount('anticipo');
 if(!preferences.monthly)preferences.monthly=amount('cuotas?');
 if(preferences.down||preferences.monthly)preferences.financing=true;
 const rooms=form.apartment?.match(/\b([123])\s*amb/i)?.[1];if(rooms&&!preferences.rooms.length)preferences.rooms=[Number(rooms)];
 return {...memory,form,preferences};
}
export function miaPersonalizedOpening(form:FormContext){
 const safe=(s?:string)=>s?.replace(/[\n\r¿?]/g,' ').trim().slice(0,140);
 const name=safe(form.name)?.split(' ')[0];
 const parts=[form.apartment?'un departamento de '+safe(form.apartment):'',form.project||form.neighborhood?'en '+safe(form.project||form.neighborhood):'',form.objective?'para '+safe(form.objective)?.toLowerCase():'',form.budget?'con '+safe(form.budget):'',form.purchase?'con esta forma de pago: '+safe(form.purchase):'',form.timeline?'y te gustaría avanzar '+safe(form.timeline):''].filter(Boolean);
 return [`Hola${name?' '+name:''}, soy MIA de Barrera Brokers. Gracias por contarme lo que necesitás.`,parts.length?'Por lo que entiendo, buscás '+parts.join(', ')+'.':'Puedo ayudarte a encontrar opciones que se ajusten a lo que necesitás.',parts.length?'¿Es correcto?':'¿Buscás para vivir o para invertir?'].join('\n');
}
