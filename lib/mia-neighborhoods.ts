import type { MiaSequence,MiaDecision } from '@/lib/mia-sequence';
const norm=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
/** Stable local facts checked against primary sources on 18/10/2026. No price or yield forecasts. */
export const MIA_NEIGHBORHOODS_KNOWLEDGE=[
 {name:'Núñez',fact:'Núñez cuenta con el Parque de Innovación, un espacio que combina verde, arte y un entorno vinculado a la ciencia y la tecnología.',anchors:['parque de innovacion'],url:'https://turismo.buenosaires.gob.ar/es/otros-establecimientos/parque-de-innovacion'},
 {name:'Palermo',fact:'Palermo combina espacios verdes y paseos como los Bosques, el Rosedal y el Jardín Botánico: un atractivo para disfrutar la vida al aire libre.',anchors:['bosques','rosedal','jardin botanico'],url:'https://turismo.buenosaires.gob.ar/es/recorrido/palermo'},
 {name:'Recoleta',fact:'Recoleta ofrece una gran propuesta cultural, con el Museo Nacional de Bellas Artes, el Centro Cultural Recoleta y Plaza Francia.',anchors:['bellas artes','centro cultural recoleta','plaza francia'],url:'https://turismo.buenosaires.gob.ar/es/recorrido/recoleta'},
 {name:'Belgrano',fact:'Belgrano combina las Barrancas con el circuito comercial y gastronómico del Barrio Chino, un atractivo para la vida cotidiana y los paseos.',anchors:['barrancas','barrio chino'],url:'https://tumarcaenba.buenosaires.gob.ar/oportunidad/parque-barrancas-de-belgrano/'},
 {name:'Colegiales',fact:'Colegiales tiene un atractivo ligado al diseño y las antigüedades, con el Mercado de Pulgas como uno de sus puntos de referencia.',anchors:['mercado de pulgas'],url:'https://turismo.buenosaires.gob.ar/en/atractivo/mercado-de-pulgas-colegiales-flea-market'},
 {name:'San Telmo',fact:'San Telmo se destaca por su identidad histórica, el Mercado y la Plaza Dorrego, con su tradicional feria de antigüedades.',anchors:['plaza dorrego','mercado','feria de antiguedades'],url:'https://buenosaires.gob.ar/gcaba_historico/cultura/casco-historico/plaza-dorrego'},
 {name:'Barracas',fact:'Barracas tiene una identidad artística y de diseño muy particular, con el Pasaje Lanín y el Centro Metropolitano de Diseño.',anchors:['pasaje lanin','metropolitano de diseno'],url:'https://turismo.buenosaires.gob.ar/es/recorrido/barracas'},
 {name:'Centro',fact:'En el Centro, el entorno de Corrientes y el Obelisco ofrece una marcada vida cultural, con teatros, librerías y gastronomía.',anchors:['corrientes','obelisco','teatros'],url:'https://linda.buenosaires.gob.ar/lo-que-esta-pasando/de-calle-olvidada-epicentro-del-entretenimiento-y-la-noche-portena'}
] as const;
export function miaNeighborhoodContext(query:string,now=Date.now()) {
  const text=norm(query);
  const references:{title:string;url:string;text:string;verifiedAt:string}[]=MIA_NEIGHBORHOODS_KNOWLEDGE.filter(p=>text.includes(norm(p.name))).sort((a,b)=>text.indexOf(norm(a.name))-text.indexOf(norm(b.name))).slice(0,3).map(p=>({title:`Barrio · ${p.name}`,url:p.url,text:p.fact,verifiedAt:'2026-10-18'}));
  if(text.includes('nunez')&&now<=Date.parse('2026-11-18T23:59:59Z'))references.push({title:'Núñez · Campus ITBA',url:'https://www.itba.edu.ar/campusitba/avances-de-obra/',text:'La página de avances del ITBA consultada el 18/10/2026 informa construcción de cimientos del nuevo campus en el Parque de Innovación. No confirma apertura ni personas por día.',verifiedAt:'2026-10-18'});
  return references;
}
/** A short first introduction also accompanies direct inventory answers; never restart the chat or repeat it. */
export function introduceMiaNeighborhood(decision:MiaDecision,text:string,history:{direction:string;content:string}[]=[]) {
  if(!decision.reply||decision.next.selected||['recopilacion_reserva','seleccion_moneda','seguimiento_asesor'].includes(decision.next.stage)||decision.handoff||decision.notifyAdvisor&&decision.next.reason!=='busqueda_sin_resultados'||/[?¿]/.test(text)||/\b(?:no quiero|no busco|no me interesa|me preocupa|me da miedo|explicame|contame)\b/.test(norm(text)))return decision;
  const introduced=decision.next.neighborhoodIntroductions||[];
  const candidates=MIA_NEIGHBORHOODS_KNOWLEDGE.filter(p=>norm(text).includes(norm(p.name))&&decision.next.facts.neighborhoods.some(n=>norm(n)===norm(p.name))&&!introduced.includes(p.name)).sort((a,b)=>norm(text).indexOf(norm(a.name))-norm(text).indexOf(norm(b.name)));
  if(!candidates.length)return decision;
  const p=candidates[0],alreadyExplained=p.anchors.some(a=>norm(decision.reply).includes(a))||history.some(m=>m.direction==='outbound'&&norm(m.content).includes(norm(p.name))&&p.anchors.some(a=>norm(m.content).includes(a)));
  if(!alreadyExplained&&p.fact.length+decision.reply.length+2>4096)return decision;
  return {...decision,next:{...decision.next,neighborhoodIntroductions:[...introduced,p.name]},reply:alreadyExplained?decision.reply:p.fact+'\n\n'+decision.reply};
}
