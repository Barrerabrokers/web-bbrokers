import { visibleMiaOffers } from '@/lib/mia-offer-conversation';
import type { MiaSequence, MiaUnit } from '@/lib/mia-sequence';
import type { MiaVerifiedQuote } from '@/lib/whatsapp-mia-sources';
import { canonicalMiaUnit } from '@/lib/mia-unit-identity';
const norm=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const money=(n:number,currency:string)=>`${currency} ${new Intl.NumberFormat('es-AR',{minimumFractionDigits:Number.isInteger(n)?0:2,maximumFractionDigits:2}).format(n)}`;
const fields=['anticipo','cuota','pagos','precio','entrega','superficie','ajuste','desarrollo','plano'] as const;
/** Only verbatim customer needs are remembered; documents and other leads never become personal memory. */
export function rememberMiaNotes(state:MiaSequence,items:unknown,text:string) {
  const notes=[...(state.memory?.notes||[])];
  for(const item of Array.isArray(items)?items.slice(0,4):[]) {
    if(!item||!['need','concern','preference'].includes(item.kind)||typeof item.evidence!=='string')continue;
    const evidence=item.evidence.trim();
    if(!evidence||evidence.length>220||!text.includes(evidence)||/@|\d{7,}|\b(?:dni|cuit|cbu|cvu|contrase[nñ]a|instrucciones|ignora|system)\b/i.test(evidence))continue;
    if(!notes.some(n=>norm(n.text)===norm(evidence)))notes.push({kind:item.kind,text:evidence});
  }
  return notes.length?{notes:notes.slice(-12)}:state.memory;
}
function slots(state:MiaSequence):Record<string,MiaUnit|undefined>{const offers=visibleMiaOffers(state);return {oferta1:offers[0],oferta2:offers[1],elegida:state.selected};}
function verifiedQuote(unit:MiaUnit,fresh:MiaVerifiedQuote[]) {
  return fresh.find(q=>norm(q.project)===norm(unit.project)&&canonicalMiaUnit(q.unit)===canonicalMiaUnit(unit.unit)&&q.currency===unit.currency)||(unit.source&&unit.readAt&&Date.now()-Date.parse(unit.readAt)>=0&&Date.now()-Date.parse(unit.readAt)<24*60*60*1000?unit:undefined);
}
export function miaAnswerContext(state:MiaSequence,fresh:MiaVerifiedQuote[]=[]) {
  return {memory:state.memory?.notes||[],units:Object.entries(slots(state)).filter(([,u])=>u).map(([slot,value])=>{
    const unit=value!,q=verifiedQuote(unit,fresh);
    const available={anticipo:!!q?.down,cuota:!!q?.installment,pagos:!!q?.months&&!!q?.installment,precio:!!q?.price,entrega:unit.deliveryMonths!==undefined,superficie:!!unit.area||!!unit.presentation?.totalArea,ajuste:!!(q?.adjustment||unit.adjustment),desarrollo:!!unit.website,plano:!!unit.planUrls?.length};
    return {project:unit.project,unit:unit.unit,rooms:unit.rooms,floor:unit.floor,area:unit.presentation?.totalArea||unit.area,deliveryMonths:unit.deliveryMonths,financial:q?{currency:q.currency,price:q.price,down:q.down,payments:q.months,installment:q.installment,adjustment:q.adjustment}:undefined,tokens:fields.filter(field=>available[field]).map(field=>`{{${slot}.${field}}}`)};
  })};
}
/** The model chooses wording; the server alone inserts retrieved amounts, links and payment adjustments. */
export function renderMiaAnswerTokens(template:string,state:MiaSequence,fresh:MiaVerifiedQuote[]=[],approvedProjectTokens:Record<string,string>={}) {
  let valid=true;const adjustments=new Set<string>();const units=slots(state);
  const checkText=template.replace(/\{\{[^{}]*\}\}/g,'');
  const text=template.replace(/\{\{([^{}]*)\}\}/g,(_token,key:string)=>{
    if(Object.prototype.hasOwnProperty.call(approvedProjectTokens,key))return approvedProjectTokens[key];
    const match=/^(oferta1|oferta2|elegida)\.(anticipo|cuota|pagos|precio|entrega|superficie|ajuste|desarrollo|plano)$/.exec(key);
    const unit=match?units[match[1]]:undefined;if(!match||!unit){valid=false;return '';}
    const q=verifiedQuote(unit,fresh);
    const financial=['anticipo','cuota','pagos','precio'].includes(match[2]);
    if(financial&&!q){valid=false;return '';}
    if(financial&&q?.adjustment)adjustments.add(q.adjustment);
    let value:string|undefined;
    switch(match[2]) {
      case 'anticipo':value=q?.down?money(q.down,q.currency):undefined;break;
      case 'cuota':value=q?.installment?money(q.installment,q.currency):undefined;break;
      case 'pagos':value=q?.months&&q.installment?`${q.months} pagos de ${money(q.installment,q.currency)}`:undefined;break;
      case 'precio':value=q?.price?money(q.price,q.currency):undefined;break;
      case 'ajuste':value=q?.adjustment||unit.adjustment||'';break;
      case 'entrega':value=unit.deliveryMonths===undefined?undefined:unit.deliveryMonths===0?'inmediata':unit.presentation?.deliveryMinMonths!==undefined?`entre ${unit.presentation.deliveryMinMonths} y ${unit.deliveryMonths} meses`:`${unit.deliveryMonths} meses`;break;
      case 'superficie':value=unit.presentation?.totalArea?`${unit.presentation.totalArea} m² totales`:unit.area?.replace(/\s*\([^)]*\)/g,'').trim();break;
      case 'desarrollo':value=unit.website;break;
      case 'plano':value=unit.planUrls?.[0];break;
    }
    if(value===undefined)valid=false;return value||'';
  });
  if(!valid||/[{}]/.test(text))return undefined;
  const conditions=[...adjustments].filter(a=>!text.includes(a));
  return {checkText,text:text+(conditions.length?'\n'+conditions.join('\n'):'')};
}
