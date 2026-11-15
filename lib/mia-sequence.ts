import { renderMiaProposal } from '@/lib/mia-proposal';
import { extractMiaReservation, MIA_RESERVATION_FIELDS, miaReservationMissing, miaReservationPrompt, type MiaReservation } from '@/lib/mia-reservation';
import { requestsHuman } from '@/lib/whatsapp-sales-policy';
import { type MiaVerifiedQuote } from '@/lib/whatsapp-mia-sources';

export type MiaStage = 'bienvenida' | 'conversacion_comercial' | 'seguimiento_asesor' | 'seleccion_barrios' | 'seleccion_entrega' | 'seleccion_ambientes' | 'busqueda_unidades' | 'unidades_presentadas' | 'unidad_seleccionada' | 'explicacion_compra' | 'recopilacion_reserva' | 'seleccion_moneda' | 'pendiente_asesor' | 'conversacion_humana';
export type MiaBudget = { original: string; total?: number; down?: number; monthly?: number };
export type MiaFacts = { neighborhoods: string[]; projectName?:string; paymentPreference?:'installments'|'cash'; deliveryMonths?: number; deliveryPreference?: 'can_wait' | 'flexible' | 'soon'; rooms?: number; budget?: MiaBudget };
export type MiaUnit = MiaVerifiedQuote & { neighborhood?: string; deliveryMonths?: number; planUrls?: string[]; cash?: boolean; website?: string; presentation?:{totalArea?:number;balconyArea?:number;deliveryMinMonths?:number} };
export type MiaSequence = { catalogPresentation?:{projectNames:string[];shown:number}; searchPending?:boolean; offerPresentation?:{shown:number}; neighborhoodIntroductions?:string[]; memory?:{notes:{kind:'need'|'concern'|'preference';text:string}[]}; stage: MiaStage; facts: MiaFacts; offers: MiaUnit[]; selected?: MiaUnit; reason?: string; resumeStage?: MiaStage; reservation?: MiaReservation; interest?:{purpose?:string;needs?:string;paymentPreference?:string}; meeting?:{kind:'reunión'|'videollamada'|'llamada';requestedAt:string;preference?:string;preferenceAt?:string}; advisorRequest?:{reason:string;requestedAt:string} };
export type MiaDecision = { next: MiaSequence; reply: string; handoff?: boolean; notifyAdvisor?:boolean };
export const normalizeMia = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[\uFE0F\u20E3]/g, '').trim();
const MIA_CURRENCY_MESSAGE='¡Perfecto! 😊 Ya tengo los datos para preparar tu solicitud de reserva. ¿En qué moneda preferís realizarla?\n\n1️⃣ Pesos argentinos\n2️⃣ Dólares estadounidenses\n3️⃣ Hablar con un asesor\n\nUn administrador te va a confirmar el importe y los datos de la cuenta antes de que transfieras.';
export const MIA_NEIGHBORHOODS = ['Palermo', 'Recoleta', 'Belgrano', 'Núñez', 'Colegiales', 'San Telmo', 'Barracas', 'Centro'];
export const MIA_STAGE_MESSAGES: Partial<Record<MiaStage, string>> = {
  seleccion_barrios: '¡Perfecto! 😊\nSeleccioná los barrios en los que estés interesado/a. Podés elegir más de uno.\n\n1️⃣ Palermo\n2️⃣ Recoleta\n3️⃣ Belgrano\n4️⃣ Núñez\n5️⃣ Colegiales\n6️⃣ San Telmo\n7️⃣ Barracas\n8️⃣ Centro\n9️⃣ Hablar con un asesor',
  seleccion_entrega: '¡Buenísimo! 😊 Para buscar opciones que se adapten a vos, ¿cuánto tiempo podés esperar para recibir tu departamento?\n\n1️⃣ Listo para habitar o rentar\n2️⃣ Máximo 6 meses\n3️⃣ De 12 a 24 meses\n4️⃣ De 24 a 36 meses\n5️⃣ Hablar con un asesor',
  seleccion_ambientes: '¡Excelente! 😊 Ya estamos más cerca de encontrar opciones para vos. ¿Qué tipo de departamento estás buscando?\n\n1️⃣ Monoambiente\n2️⃣ 2 ambientes\n3️⃣ 3 ambientes\n4️⃣ Hablar con un asesor',
};

export function miaFactsKey(facts:MiaFacts){return JSON.stringify([facts.neighborhoods.map(normalizeMia).sort(),facts.deliveryMonths??facts.deliveryPreference??null,facts.rooms??null,facts.budget?.total??null,facts.budget?.down??null,facts.budget?.monthly??null]);}

function amount(value: string) { return Number(value.replace(/[.,](?=\d{3}(?:[.,]|$))/g, '').replace(',', '.')); }
export function parseMiaBudget(original: string): MiaBudget | undefined {
  const normalizedOriginal=original.replaceAll('_',' ');
  if (!normalizedOriginal.trim() || /-\s*\d/.test(normalizedOriginal.replace(/\d[\d.,]*(?:\s*(?:mil|k))?\s*-\s*(?=\d)/gi,'')) || /\b(?:ars|pesos|eur|euros)\b/i.test(normalizedOriginal)) return undefined;
  const text = normalizeMia(normalizedOriginal).replace(/(\d+(?:[.,]\d+)?)\s*(?:mil|k)\b/g, (_, n) => String(amount(n) * 1000));
  const down = text.match(/(?:anticipo|adelanto|entrada)\s*(?:de\s*)?(?:usd|u\$s|us\$|\$)?\s*([\d.,]+)/)?.[1];
  const monthly = text.match(/(?:cuotas?|mensual(?:es)?)\s*(?:de\s*)?(?:usd|u\$s|us\$|\$)?\s*([\d.,]+)/)?.[1] || text.match(/(?:usd|u\$s|us\$|\$)?\s*(\d[\d.,]*)\s*(?:usd\s*)?(?:por mes|mensuales|al mes)/)?.[1];
  const total=text.match(/(?:presupuesto(?: total)?|precio total|total de compra)\s*(?:de\s*)?(?:usd|u\$s|us\$|\$)?\s*([\d.,]+)/)?.[1];
  if (down || monthly || /anticipo|adelanto|entrada|cuota|mensual/.test(text)) return { original, total:total?amount(total)||undefined:undefined, down: down ? amount(down) || undefined : undefined, monthly: monthly ? amount(monthly) || undefined : undefined };
  const values = [...text.matchAll(/\d[\d.,]*/g)].map(m => amount(m[0])).filter(n => Number.isFinite(n) && n > 0);
  return values.length ? { original, total: Math.max(...values) } : undefined;
}
export function miaMissingStage(facts: MiaFacts): MiaStage {
  return !facts.neighborhoods.length ? 'seleccion_barrios' : facts.deliveryMonths === undefined && !['can_wait','flexible'].includes(facts.deliveryPreference||'') ? 'seleccion_entrega' : !facts.rooms ? 'seleccion_ambientes' : 'busqueda_unidades';
}
function numericChoice(text: string) { const words:Record<string,string>={uno:'1',una:'1',un:'1',dos:'2',tres:'3',cuatro:'4',cinco:'5',seis:'6',siete:'7',ocho:'8',nueve:'9'}; const normalized=normalizeMia(text).replace(/[).!\s]/g, '');const clean=words[normalized]||normalized; return /^\d$/.test(clean) ? Number(clean) : undefined; }
export function miaStageAdvisor(stage: MiaStage, text: string) {
  if (requestsHuman(text)) return true;
  const choice = numericChoice(text);
  return choice !== undefined && choice === ({ bienvenida: 1, seleccion_barrios: 9, seleccion_entrega: 5, seleccion_ambientes: 4, unidades_presentadas: 3, unidad_seleccionada: 1, explicacion_compra: 2, seleccion_moneda: 3 } as Partial<Record<MiaStage, number>>)[stage];
}
export function parseMiaPreferences(text: string, stage: MiaStage): Partial<MiaFacts> {
  const normalized = normalizeMia(text).replaceAll('_',' ').replace(/\buno?\b/g,'1').replace(/\bdos\b/g,'2').replace(/\btres\b/g,'3'), facts: Partial<MiaFacts> = {};
  if(!/[?¿]/.test(text)&&!/no (?:quiero|busco|necesito).{0,20}(?:cuotas|financia)/.test(normalized)&&/\b(?:anticipo|en cuotas|con cuotas|financiacion|financiar|financiado)\b/.test(normalized))facts.paymentPreference='installments';
  else if(!/[?¿]/.test(text)&&/\b(?:de contado|al contado|pago contado)\b/.test(normalized))facts.paymentPreference='cash';
  const room = normalized.match(/\b([123])\s*ambientes?\b/);
  if (room || /monoambiente/.test(normalized)) facts.rooms = room ? Number(room[1]) : 1;
  const delivery = [...normalized.matchAll(/(\d{1,3})(?:\s*[-a]\s*(\d{1,3}))?\s*mes(?:es)?/g)].at(-1);
  const years=normalized.match(/(\d)(?:\s*[-a]\s*(\d))?\s*anos?/);
  if(years)facts.deliveryMonths=Number(years[2]||years[1])*12;
  if (delivery) facts.deliveryMonths = Number(delivery[2] || delivery[1]);
  if (/inmediata|listo para (?:habitar|rentar)|terminado|ya terminado/.test(normalized)) facts.deliveryMonths = 0;
  // Willingness to wait is a valid answer, not an invented numeric maximum.
  if(!/[?¿]/.test(text)) {
    if(/\b(?:sin (?:un )?(?:plazo|limite)|no tengo (?:un )?plazo|el plazo me da igual|cualquier plazo)\b/.test(normalized))facts.deliveryPreference='flexible';
    else if(/\b(?:no tengo apuro|no hay apuro)\b/.test(normalized))facts.deliveryPreference='can_wait';
    else if(/\b(?:no (?:puedo|quiero) esperar|lo necesito pronto|me urge|tengo apuro)\b/.test(normalized))facts.deliveryPreference='soon';
    else if(/\b(?:(?:puedo|podemos|prefiero|quiero) esperar|no tengo apuro|no hay apuro|puedo aguardar|no me molesta esperar|no tengo problema (?:en|con) esperar|no hay problema (?:en|con) esperar|(?:me sirve|acepto|busco) (?:en pozo|en obra))\b/.test(normalized))facts.deliveryPreference='can_wait';
  }
  if(facts.deliveryMonths!==undefined)facts.deliveryPreference=undefined;
  const neighborhoods = MIA_NEIGHBORHOODS.filter(n => normalized.includes(normalizeMia(n)));
  if (neighborhoods.length) facts.neighborhoods = neighborhoods;
  const choice = numericChoice(text);
  if (stage === 'seleccion_entrega' && choice && choice <= 4) facts.deliveryMonths = [0, 6, 24, 36][choice - 1];
  if (stage === 'seleccion_ambientes' && choice && choice <= 3) facts.rooms = choice;
  if (stage === 'seleccion_barrios') {
    const numbers = normalizeMia(text).match(/\b[1-8]\b/g);
    if (numbers?.length && !/mes|ambiente/.test(normalized)) facts.neighborhoods = [...new Set(numbers.map(n => MIA_NEIGHBORHOODS[Number(n)-1]))];
    else if (!facts.neighborhoods && !facts.rooms && facts.deliveryMonths===undefined && !/[?¿]/.test(text) && !/precio|cuota|entrega|brochure|correo|email|reserv|asesor|ayuda|^hola$|^perfecto$|^si$|^no$|^gracias$/.test(normalized) && /^[\p{L}\s,.-]{3,100}$/u.test(text.trim())) facts.neighborhoods = text.replace(/^(?:prefiero|me interesa(?:n)?|busco|quiero|en)\s+/i,'').split(/,|\s+y\s+/).map(n => n.trim()).filter(Boolean);
  }
  return facts;
}
function floorNumber(unit: MiaUnit) { if (/^pb$/i.test(unit.floor || '')) return 0; return /^\d+$/.test(unit.floor || '') ? Number(unit.floor) : undefined; }
export function miaUnitFits(unit: MiaUnit, facts: MiaFacts) {
  const budget = facts.budget;
  if (unit.currency !== 'USD' || !unit.planUrls?.length || unit.rooms !== facts.rooms || !unit.area || floorNumber(unit) === undefined || unit.deliveryMonths === undefined || (facts.deliveryMonths!==undefined ? unit.deliveryMonths > facts.deliveryMonths : facts.deliveryPreference==='soon')) return false;
  if (facts.projectName?normalizeMia(unit.project)!==normalizeMia(facts.projectName):!facts.neighborhoods.some(n => normalizeMia(unit.neighborhood || '').includes(normalizeMia(n)))) return false;
  if(facts.paymentPreference==='installments'&&unit.cash)return false;
  if (!unit.cash && !(unit.down && unit.months && unit.installment)) return false;
  if (budget?.total && unit.price > budget.total * 1.1) return false;
  // Apply every known allowance independently. A missing amount is not a zero budget.
  if (budget?.down && (unit.cash?unit.price>budget.down:!unit.down||unit.down>budget.down)) return false;
  if (budget?.monthly && !unit.cash && (!unit.installment || unit.installment > budget.monthly)) return false;
  return true;
}
export function selectMiaPair(inventory: MiaUnit[], facts: MiaFacts): MiaUnit[] {
  const candidates = inventory.filter(q => miaUnitFits(q, facts)).sort((a,b) => Number(!!facts.budget?.total && a.price > facts.budget.total) - Number(!!facts.budget?.total && b.price > facts.budget.total) || a.price-b.price);
  for (const first of candidates) {
    const second = candidates.filter(q => q.project === first.project && q.unit !== first.unit && q.price > first.price)
      .sort((a,b) => Number(!!facts.budget?.total && a.price > facts.budget.total) - Number(!!facts.budget?.total && b.price > facts.budget.total) || b.price-a.price || floorNumber(b)!-floorNumber(a)!)[0];
    if (second) return [first,second].map(q => ({...q, originalBudget:facts.budget?.total}));
  }
  return candidates.slice(0,1).map(q => ({...q, originalBudget:facts.budget?.total}));
}
/** Exact typology first. Explicitly label a different typology only when there is no exact option. */
export function selectMiaProposal(inventory:MiaUnit[],facts:MiaFacts):{offers:MiaUnit[];alternativeRooms?:number} {
  const exact=selectMiaPair(inventory,facts);
  if(exact.length)return {offers:exact};
  for(const rooms of [facts.rooms!+1,facts.rooms!-1].filter(n=>n>=1&&n<=3)) {
    const offers=selectMiaPair(inventory,{...facts,rooms});
    if(offers.length===2)return {offers,alternativeRooms:rooms};
  }
  return {offers:[]};
}

export function miaHandoff(state: MiaSequence, reason = 'asesor'): MiaDecision {
  return { next: { ...state, stage: 'pendiente_asesor', resumeStage:state.stage, reason }, reply: reason === 'reserva' ? '¡Excelente! 😊 Guardé tu interés en solicitar la reserva de esta unidad. Un asesor debe confirmar disponibilidad y condiciones para continuar. La unidad todavía no está reservada.' : '¡Perfecto! 😊 Tu consulta queda pendiente para que la continúe un asesor del equipo.', handoff: true };
}
export async function advanceMiaSequence(state: MiaSequence, text: string, inventory: (facts: MiaFacts) => Promise<MiaUnit[]>, options:{reservationData?:MiaReservation}={}): Promise<MiaDecision> {
  if (miaStageAdvisor(state.stage,text)) return miaHandoff(state);
  if (state.stage === 'pendiente_asesor' || state.stage === 'conversacion_humana') return { next: state, reply: '' };
  let next: MiaSequence = {...state, facts:{...state.facts}};
  const choice = numericChoice(text), normalized = normalizeMia(text);
  if (state.stage === 'recopilacion_reserva') {
    const incoming=options.reservationData??extractMiaReservation(text,state.reservation);
    next.reservation={...state.reservation,...incoming};
    if(miaReservationMissing(next.reservation).length){
      const hasNewData=Object.keys(incoming).length>0;
      const first=miaReservationMissing(next.reservation)[0];
      return {next,reply:hasNewData||!text?miaReservationPrompt(next.reservation):`Podemos ir de a poco 😊 ¿Me compartís tu ${MIA_RESERVATION_FIELDS[first]}? Si querés revisar ese dato con un asesor, decímelo.`};
    }
    next.stage='seleccion_moneda';
    return {next,reply:MIA_CURRENCY_MESSAGE};
  }
  if (state.stage === 'seleccion_moneda') {
    if(/[?¿]/.test(text))return {next,reply:'Podés indicar tu preferencia en pesos argentinos o dólares estadounidenses. El importe y, si corresponde, la cotización te los confirma el administrador antes de que transfieras. ¿Qué moneda preferís?'};
    const currency=choice===1||/pesos|\bars\b/.test(normalized)?'ARS':choice===2||/dolares|\busd\b/.test(normalized)?'USD':undefined;
    if(!currency)return {next,reply:'¿Preferís pesos argentinos o dólares estadounidenses? También podés pedirme un asesor.'};
    next.reservation={...state.reservation,currency};
    const decision=miaHandoff(next,'reserva');
    decision.reply=`¡Gracias! 😊 Ya reuní tus datos y tu preferencia de ${currency==='ARS'?'pesos argentinos':'dólares estadounidenses'} para solicitar la reserva de la unidad ${state.selected?.unit} de ${state.selected?.project}. Un asesor va a revisar la disponibilidad y las condiciones, y un administrador te va a facilitar la cuenta autorizada para transferir. La reserva queda pendiente de esa revisión y de su aceptación.`;
    return decision;
  }
  if (state.stage === 'unidades_presentadas') {
    const picked = choice === 1 || choice === 2 ? state.offers[choice-1] : state.offers.find(q => normalized.includes('unidad '+normalizeMia(q.unit)));
    if (!picked) return {next,reply:'Podemos revisar qué no te convence de estas unidades y buscar alternativas reales. También podés pedir un asesor. ¿Qué cambiarías de la propuesta?'};
    next = {...next,stage:'unidad_seleccionada',facts:{...next.facts,rooms:picked.rooms},selected:picked};
    return {next,reply:`¡Qué bueno que te interesó la unidad ${picked.unit} de ${picked.project}! 😊\n¿Cómo te gustaría avanzar?\n\n1️⃣ Hablar con un asesor\n2️⃣ Solicitar la reserva\n3️⃣ Conocer el proceso de compra`};
  }
  if (state.stage === 'unidad_seleccionada' || state.stage === 'explicacion_compra') {
    if (/reserv/.test(normalized) || choice === (state.stage === 'unidad_seleccionada' ? 2 : 1)) {
      if(!state.selected)return miaHandoff(next,'unidad_sin_seleccionar');
      next={...next,stage:'recopilacion_reserva',reason:undefined,reservation:state.reservation||{}};
      if(!miaReservationMissing(next.reservation).length)return {next:{...next,stage:'seleccion_moneda'},reply:MIA_CURRENCY_MESSAGE};
      return {next,reply:miaReservationPrompt(next.reservation,true)};
    }
    if (/proceso|compra|boleto/.test(normalized) || choice === 3) return {next:{...next,stage:'explicacion_compra'},reply:'¡Por supuesto! 😊 Primero el asesor verifica disponibilidad y condiciones de la unidad elegida. Después se prepara la solicitud de reserva y se acuerda la firma del boleto y la forma de pago. Los importes de reserva, comisiones y ajustes deben confirmarse para este proyecto; no voy a darte condiciones que no estén verificadas.\n\n1️⃣ Solicitar la reserva\n2️⃣ Hablar con un asesor'};
    return {next,reply:'¿Preferís solicitar la reserva, conocer el proceso de compra o hablar con un asesor?'};
  }
  if (state.stage === 'bienvenida' && !(choice === 2 || /desarrollo|catalogo|ver proyectos/.test(normalized))) return {next,reply:'Para continuar, podés elegir ver nuestros desarrollos o hablar con un asesor.'};
  if (state.stage !== 'bienvenida') next.facts = {...next.facts,...parseMiaPreferences(text,state.stage)};
  next.stage = miaMissingStage(next.facts);
  if (next.stage !== 'busqueda_unidades') return {next,reply:MIA_STAGE_MESSAGES[next.stage]!};
  const {offers,alternativeRooms} = selectMiaProposal(await inventory(next.facts),next.facts);
  if (!offers.length) {
    const decision = miaHandoff(next,'datos_unidades_incompletos');
    decision.reply = 'Ya tengo tus preferencias 😊 Me falta verificar unidades compatibles con sus planos y condiciones de pago completos. Dejo la consulta al asesor para que revise las opciones reales y continúe con vos.';
    return decision;
  }
  next = {...next,stage:'unidades_presentadas',offers};
  const reply=renderMiaProposal(offers,next.facts.rooms,alternativeRooms);
  if(reply.length>4096)return {...miaHandoff(next,'propuesta_extensa'),reply:'Ya tengo tus preferencias 😊 La propuesta necesita revisión para compartir correctamente los planos y las condiciones por WhatsApp. Un asesor va a continuar con vos.'};
  return {next,reply};
}
