// Keep the request bounded before calling the provider. Truncation is explicit:
// missing data in this excerpt must never become a request to repeat known details.
export function compactSalesContext(context:unknown) {
 const source=(context&&typeof context==='object'?context:{}) as Record<string,any>;
 const short=Boolean(source.compactRetry);
 const clip=(value:unknown,limit:number)=>JSON.stringify(value??null).slice(0,limit);
 const lead=source.lead||{};
 const result={
  now:source.now,contextTruncated:true,
  instruction:'Extractos acotados. Si un dato no aparece, no afirmes que falta en el CRM ni lo pidas de nuevo. Priorizá la última interacción.',
  lead:{id:'lead',name:clip(lead.name,100),status:clip(lead.status,100),source:clip(lead.source,100),hasEmail:Boolean(lead.hasEmail),hasPhone:Boolean(lead.hasPhone),development:clip(lead.development,200),notes:clip(lead.notes,short?400:900),forms:clip(lead.forms,short?500:1200),imported:clip(lead.imported,short?500:1200)},
  signals:source.signals,callHistory:{count:source.callHistory?.count,lastCalls:(source.callHistory?.lastCalls||[]).slice(0,1).map((c:any)=>({...c,body:clip(c.body,400)}))},
  events:(source.events||[]).slice(0,short?2:4).map((e:any)=>({id:e.id,type:e.type,data:{...e.data,body:clip(e.data?.body,short?300:650)}})),
  history:(source.history||[]).slice(0,short?2:4).map((e:any)=>({...e,detalle:clip(e.detalle,short?200:400)})),
  previous:source.previous?{summary:clip(source.previous.summary,400),preferences:clip(source.previous.preferences,600)}:null,
  upcoming:(source.upcoming||[]).slice(0,2),inventory:(source.inventory||[]).slice(0,2).map((p:any)=>({id:p.id,name:p.name,price_from:p.price_from,currency:p.currency})),
  feedback:(source.feedback||[]).slice(0,2),
 };
 // Unbounded source fields are never included. Reduce optional history first if needed.
 // Bound all remaining external strings/collections, including titles and optional fields.
 function bound(value:any,depth=0):any {
  if(typeof value==='string')return value.slice(0,1200);
  if(depth>7)return null;
  if(Array.isArray(value))return value.slice(0,6).map(v=>bound(v,depth+1));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).slice(0,20).map(([k,v])=>[k.slice(0,100),bound(v,depth+1)]));
  return value;
 }
 const bounded=bound(result);
 let json=JSON.stringify(bounded);
 while(Buffer.byteLength(json,'utf8')>(short?7000:11000)){
  if(bounded.history.length)bounded.history.pop();else if(bounded.inventory.length)bounded.inventory.pop();else if(bounded.upcoming.length)bounded.upcoming.pop();
  else if(bounded.events.length>1)bounded.events.pop();
  else {
   const shrink=(v:any,key=''):any=>typeof v==='string'?(key==='instruction'?v:['id','type'].includes(key)?v.slice(0,100):v.slice(0,Math.floor(v.length/2))):Array.isArray(v)?v.map(value=>shrink(value)):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,value])=>[k,shrink(value,k)])):v;
   Object.assign(bounded,shrink(bounded));
  }
  json=JSON.stringify(bounded);
 }
 return json;
}

const text={type:'string',maxLength:1800};
const score={type:'integer',minimum:0,maximum:100};
const object=(properties:Record<string,unknown>)=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const array=(items:unknown,maxItems:number,minItems=0)=>({type:'array',items,maxItems,minItems});
export const salesJsonSchema=object({
 summary:text,intent:score,urgency:score,fit:{anyOf:[score,{type:'null'}]},confidence:{type:'number',minimum:0,maximum:1},
 status:{type:'string',enum:['NEW','QUALIFYING','ACTIVE','HIGH_INTENT','VISIT_READY','NEGOTIATING','WAITING_CLIENT','WAITING_AGENT','FOLLOW_UP_REQUIRED','COLD','REACTIVATION','LOST','CLOSED_WON']},
 reasoning:array(text,8,1),missingInformation:array(text,12),confirmed:array(object({fact:text,evidenceId:{type:'string',maxLength:100}}),16),
 inferences:array(text,10),questions:array(text,8),nextAction:text,suggestedMessage:{type:'string',maxLength:3000},
 preferences:object(Object.fromEntries(['zone','budget','country','language','purpose','bedrooms','purchaseTiming','financing'].map(key=>[key,{anyOf:[text,{type:'null'}]}]))),
 propertyMatches:array(object({id:{type:'string',maxLength:100},reason:text}),5),followupHours:{type:'number',minimum:1,maximum:720},
});
