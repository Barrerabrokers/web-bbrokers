import { agentQuoteKey, normalizeMiaSearch, emptyAgentMemory, reconcileAgentRoomCount, type AgentMemory, type AgentProject, type AgentPlan } from '@/lib/mia-agent-search';
const unitKey=(text:string)=>normalizeMiaSearch(text).replace(/ /g,'');
type Message={direction:string;content:string};
/** Recover identifiers from delivered headings, never prices or assistant-invented preferences. */
export function restoreMiaReferences(memory:AgentMemory,messages:Message[],catalog:AgentProject[]):AgentMemory {
 const delivered=messages.filter(m=>m.direction==='outbound').flatMap(m=>m.content.split('\n')).flatMap(line=>{
  const match=line.trim().match(/^(.+?) · Unidad ([a-z0-9 -]+)$/i);
  if(!match||!catalog.some(p=>[p.name,p.websiteName].includes(match[1])))return [];
  return [{project:match[1],unit:match[2],key:agentQuoteKey({project:match[1],unit:match[2]})}];
 });
 const available=new Set(delivered.map(q=>q.key));
 const lastOffered=memory.lastOffered.filter(q=>available.has(q.key));
 return {...memory,lastOffered:lastOffered.length?lastOffered:delivered.slice(-2),selectedUnit:memory.selectedUnit&&available.has(memory.selectedUnit.key)?memory.selectedUnit:null};
}
export function miaFollowup(text:string,memory:AgentMemory,catalog:AgentProject[]=[]) {
 const clean=normalizeMiaSearch(text.split('\n[Origen del anuncio]')[0]);
 const mentioned=catalog.find(p=>[p.name,p.websiteName||''].some(name=>name&&clean.includes(normalizeMiaSearch(name))));
 if(/\b(?:busco|buscando|nueva busqueda|cambiemos|cambiar|prefiero otro|ahora quiero|quiero ver|quiero comprar|mostrame otra|otra opcion|en realidad|tengo|puedo pagar|puedo dar|dispongo|presupuesto)\b/.test(clean)||(mentioned&&(memory.selectedUnit||memory.lastOffered[0])&&mentioned.name!==(memory.selectedUnit||memory.lastOffered[0]).project))return {intent:null,selected:null,selectionOnly:false};
 const explicit=clean.match(/^(?:(?:la )?unidad |la )?(\d{1,5}\s*[a-z]|\d{3,5})$/i)?.[1]||clean.match(/\b(?:unidad|reservar(?: la)?|plano(?: de la)?) (\d{1,5}\s*[a-z]|\d{3,5})\b/i)?.[1];
 const match=explicit?memory.lastOffered.find(q=>unitKey(q.unit)===unitKey(explicit)):undefined;
 if(explicit&&!match)return {intent:null,selected:null,selectionOnly:false};
 const selected=match||memory.selectedUnit||(memory.lastOffered.length===1?memory.lastOffered[0]:null);
 const refused=/\bno (?:quiero|necesito|me interesa)\b|cancel/.test(clean);
 const intent=!refused&&/\b(?:plano|planos)\b/.test(clean)?'documents':
  /\b(?:cuotas?|anticipo|financia\w*)\b/.test(clean)?'financing':
  !refused&&/\b(?:quiero|quisiera|me gustaria|podemos)\s+(?:\w+\s+){0,2}reservar\b/.test(clean)?'reservation':
  match||selected&&/\b(?:precio|amenities|cochera|balcon|orientacion|expensas|entrega|ubicacion|direccion|superficie|metros|piso|escritura)\b/.test(clean)?'details':null;
 return {intent,selected: selected|| (memory.lastOffered.length===1?memory.lastOffered[0]:null),selectionOnly:!!match&&!!clean.match(/^(?:(?:la )?unidad |la )?(\d{1,5}\s*[a-z]|\d{3,5})$/i)};
}
export function learnMiaQuestion(memory:AgentMemory,question:string,reason:string) {
 const item={question:question.split('\n[Origen del anuncio]')[0].slice(0,400),reason:reason.slice(0,200)};
 return [...memory.pendingQuestions.filter(q=>normalizeMiaSearch(q.question)!==normalizeMiaSearch(item.question)),item].slice(-20);
}

/** A model omission is not a customer correction. Keep confirmed scalar preferences. */
export function preserveMiaPreferences(plan:AgentPlan,memory:AgentMemory,text:string):AgentPlan {
 if(plan.reset)return {...preserveMiaPreferences({...plan,reset:false},emptyAgentMemory(),text),reset:true};
 const clean=normalizeMiaSearch(text),p={...plan.preferences};
 if(!p.purpose)p.purpose=memory.preferences.purpose;
 const changedZone=p.neighborhoods.length>0&&p.neighborhoods.join('|')!==memory.preferences.neighborhoods.join('|');
 const changedProject=p.projects.length>0&&p.projects.join('|')!==memory.preferences.projects.join('|');
 if(!p.rooms.length&&!/cualquier (?:tipologia|cantidad de ambientes)|sin preferencia de ambientes|ambientes? (?:me da|da) igual/.test(clean))p.rooms=memory.preferences.rooms;
 if(!p.neighborhoods.length&&!changedProject&&!/cualquier (?:barrio|zona)|sin preferencia de (?:barrio|zona)|(?:barrio|zona) (?:me da|da) igual|ampliemos (?:la zona|los barrios)/.test(clean))p.neighborhoods=memory.preferences.neighborhoods;
 if(!p.projects.length&&!changedZone&&!/cualquier proyecto|otros proyectos|otra alternativa|nueva busqueda/.test(clean))p.projects=memory.preferences.projects;
 if(p.delivery==='any'&&memory.preferences.delivery!=='any'&&!/sin preferencia de entrega|cualquier (?:plazo|entrega)|(?:no importa|me da igual) (?:la )?entrega/.test(clean))p.delivery=memory.preferences.delivery;
 if(p.financing===null&&!/no necesito financiacion|sin financiacion|pago (?:al )?contado/.test(clean))p.financing=memory.preferences.financing;

 const purposes=[...clean.matchAll(/\bpara (vivir|invertir|inversion|rentar|obtener renta|airbnb|alquiler temporario)\b/g)].filter(m=>!/(?:no|no es|no lo quiero)\s*$/.test(clean.slice(Math.max(0,m.index!-25),m.index)));
 const explicitPurpose=purposes.at(-1)?.[1];
 if(explicitPurpose)p.purpose=explicitPurpose==='vivir'?'living':['airbnb','alquiler temporario'].includes(explicitPurpose)?'temporary_rental':'investment';
 for(const key of ['total','down','monthly'] as const){
  const field=key==='total'?'presupuesto|precio total':key==='down'?'anticipo':'cuota';
  const clearing=new RegExp('(?:sin limite|sin tope|no tengo limite).*(?:'+field+')|(?:'+field+').*(?:sin limite|sin tope|no tengo limite)');
  if(!p[key]&&!clearing.test(clean))p[key]=memory.preferences[key];
 }
 return {...plan,preferences:p,priority:plan.priority||memory.priority};
}


/** Restore missing customer preferences from their own turns, never MIA's offers. */
export function recoverMiaStatedPreferences(memory:AgentMemory,messages:Message[],catalog:AgentProject[]):AgentMemory {
 const input=messages.filter(m=>m.direction==='inbound').map(m=>({...m,content:m.content.split('\n[Origen del anuncio]')[0]}));
 const reset=input.map(m=>/nueva busqueda|empecemos de cero|olvida (?:la |lo )?anterior/.test(normalizeMiaSearch(m.content))).lastIndexOf(true);
 const turns=input.slice(reset<0?0:reset);
 let p=emptyAgentMemory().preferences;
 const neighborhoods=Array.from(new Set(catalog.flatMap(c=>(c.neighborhood||'').split(/\s*,\s*/)).filter(Boolean)));
 for(const m of turns){
  const text=normalizeMiaSearch(m.content);
  const plan:AgentPlan={intent:'search',preferences:p,reset:false,more:false,selected:null,unit:null,unavailableProject:null,unclearBudget:false,priority:null};
  p=reconcileAgentRoomCount(plan,m.content).preferences;
  if(/cualquier (?:tipologia|cantidad de ambientes)|sin preferencia de ambientes/.test(text))p={...p,rooms:[]};
  p=preserveMiaPreferences({...plan,preferences:p},{...emptyAgentMemory(),preferences:p},m.content).preferences;
  const named=neighborhoods.filter(n=>{const value=normalizeMiaSearch(n);return (text===value||text.startsWith(value+' ')||text.includes('en '+value)||text.includes('zona '+value)||text.includes('prefiero '+value))&&!text.includes('no en '+value);});
  if(named.length)p={...p,neighborhoods:named};
  if(/cualquier (?:barrio|zona)|sin preferencia de (?:barrio|zona)/.test(text))p={...p,neighborhoods:[]};
 }
 return {...memory,preferences:{...memory.preferences,rooms:memory.preferences.rooms.length?memory.preferences.rooms:p.rooms,neighborhoods:memory.preferences.neighborhoods.length?memory.preferences.neighborhoods:p.neighborhoods,purpose:memory.preferences.purpose||p.purpose}};
}
