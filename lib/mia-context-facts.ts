import {parseMiaBudget,parseMiaPreferences,type MiaFacts} from '@/lib/mia-sequence';
type Message={direction:string;senderType?:string;status:string;content:string};
/** Only explicit customer updates supersede form values, one allowance at a time. */
export function recoverMiaConversationFacts(base:MiaFacts,messages:Message[]):MiaFacts {
  let facts:MiaFacts={...base,neighborhoods:[...base.neighborhoods],budget:base.budget?{...base.budget}:undefined};
  let previous='';
  const start=messages.map(m=>m.status).lastIndexOf('cleared');
  for(const m of messages.slice(start+1)){
    if(['historical','cleared'].includes(m.status))continue;
    if(m.direction!=='inbound'){previous=m.content;continue;}
    const text=m.content.split('\n[Origen del anuncio]')[0];
    let parsed=parseMiaPreferences(text,'conversacion_comercial');
    if(/^(?:\d[️⃣]*|un[oa]?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve)[.!]?$/i.test(text.trim())&&(/[1-9]️⃣/.test(previous)||/(?:cu[aá]ntos|cantidad de|tipo de).{0,35}ambientes|qué tipo de departamento/i.test(previous))){
      const stage=/Seleccioná los barrios/.test(previous)?'seleccion_barrios':/cuánto tiempo|plazo de entrega/i.test(previous)?'seleccion_entrega':/(?:qué tipo de departamento|qué cantidad de ambientes|cuántos ambientes|cantidad de ambientes|departamento estás buscando)/i.test(previous)?'seleccion_ambientes':undefined;
      if(stage)parsed={...parsed,...parseMiaPreferences(text,stage)};
    }
    // A short affirmative only has meaning against the immediately preceding question.
    if(/^(?:s[ií]|dale|claro|por supuesto)[.!\s]*$/i.test(text.trim())&&/\bpod[eé]s esperar\b/i.test(previous)&&!/\bo\b/i.test(previous))parsed.deliveryPreference='can_wait';
    if(['flexible','soon'].includes(parsed.deliveryPreference||'')||parsed.deliveryPreference==='can_wait'&&facts.deliveryMonths===0)parsed.deliveryMonths=undefined;
    facts={...facts,...parsed};
    if(!/[?¿]/.test(text)&&!/(?:no tengo|no puedo|no dispongo)/i.test(text)&&/\d/.test(text)&&/(?:presupuesto|anticipo|adelanto|cuotas?|mensual|por mes|al mes|(?:tengo|dispongo|puedo invertir|puedo destinar).{0,25}(?:usd|u\$s|d[oó]lares))/i.test(text)){
      const budget=parseMiaBudget(text);
      if(budget)facts.budget={...facts.budget,original:budget.original,...(budget.total?{total:budget.total}:{}),...(budget.down?{down:budget.down}:{}),...(budget.monthly?{monthly:budget.monthly}:{})};
    }
    previous='';
  }
  return facts;
}

/** Confirmed state wins over old preference answers; history fills gaps and recovers explicit budget updates. */
export function restoreMiaMissingFacts(current:MiaFacts,messages:Message[]):MiaFacts {
  const recovered=recoverMiaConversationFacts(current,messages);
  return {...recovered,...current,neighborhoods:current.neighborhoods.length?current.neighborhoods:recovered.neighborhoods,rooms:current.rooms??recovered.rooms,deliveryMonths:['flexible','soon'].includes(current.deliveryPreference||'')||current.deliveryPreference==='can_wait'&&current.deliveryMonths===0?undefined:current.deliveryMonths??recovered.deliveryMonths,deliveryPreference:current.deliveryPreference??recovered.deliveryPreference,budget:recovered.budget};
}
