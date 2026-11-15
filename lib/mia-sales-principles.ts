import { normalizeMiaSearch, type AgentMemory } from '@/lib/mia-agent-search';
import type { MiaOpportunity } from '@/lib/mia-opportunities';

/** Commercial style is not evidence. Never infer scarcity, appreciation or customer stories. */
export const MIA_SALES_PRINCIPLES = `Asesorá sin presión. Usá solo necesidades expresadas, no emociones inventadas. Traducí hechos verificados en utilidad condicional para ese cliente, sin prometer comodidad, renta, valorización ni ahorro. Primero propósito y prioridad, después datos. Respondé preguntas directas antes de calificar. Una pregunta por mensaje, máximo tres líneas, hasta dos opciones que cumplan todos los filtros. No confundas cuándo quiere avanzar con entrega. No menciones escasez ni testimonios, ni siquiera genéricos, sin evidencia autorizada del CRM. No uses afirmaciones de pérdida o el multiplicador 2,5 como hechos. El objetivo es coordinar con un agente comercial, nunca cerrar una reserva por chat. Respetá más adelante, no fuerces una cita ni repitas datos conocidos.`;

export function learnMiaSalesNeeds(memory:AgentMemory,text:string){
 const t=normalizeMiaSearch(text);
 const needs={...memory.salesNeeds};
 if(/lo mas importante|mi prioridad|priorizo|me importa mas|necesito ante todo/.test(t)){
  if(/entrega|fecha|mudarm/.test(t))needs.focus='delivery';
  else if(/ubicacion|barrio|familia|cerca/.test(t))needs.focus='location';
  else if(/renta|alquiler|ingreso/.test(t))needs.focus='rental';
  else if(/precio|presupuesto|cuota|financia/.test(t))needs.focus='budget';
  else if(/espacio|comodidad|ambiente/.test(t))needs.focus='space';
 }
 if(/(?:quiero|podemos|me gustaria) avanzar (?:ahora|hoy|esta semana)|cuanto antes/.test(t))needs.advance='soon';
 if(/mas adelante|todavia no se|aun no se/.test(t))needs.advance='later';
 return {...memory,salesNeeds:needs};
}

export function miaNeedBenefit(memory:AgentMemory){
 switch(memory.salesNeeds?.focus){
  case 'delivery':return 'para organizar tu mudanza según el plazo que necesitás';
  case 'location':return 'para priorizar la zona que elegiste en tu búsqueda';
  case 'rental':return 'para evaluar si encaja con tu objetivo de alquiler, sin asumir una renta';
  case 'budget':return 'para evaluar los pagos sin salir del presupuesto que definiste';
  case 'space':return 'para revisar si la distribución se adapta a tu día a día';
  default:return memory.preferences.purpose==='living'?'para planificar tu próximo hogar con información concreta':memory.preferences.purpose?'para evaluar la inversión con información concreta':'para concentrarnos en opciones que te sirvan';
 }
}

export function miaProjectBenefit(p:MiaOpportunity,memory:AgentMemory){
 const why=miaNeedBenefit(memory),focus=memory.salesNeeds?.focus;
 if(focus==='location')return `${p.name} está en ${p.neighborhood}, ${why}.`;
 if(focus==='budget')return `${p.name}, en ${p.neighborhood}: podemos revisar su plan verificado ${why}.`;
 if(focus==='space')return `${p.name}, en ${p.neighborhood}: podemos revisar sus planos ${why}.`;
 if(p.months!==null)return `${p.name}, en ${p.neighborhood}, informa entrega en ${p.delivery.toLowerCase()}; es una referencia ${why}.`;
 return `${p.name} está en ${p.neighborhood}; podemos revisar esta ubicación ${why}.`;
}

export function miaTrustReply(text:string){
 const t=normalizeMiaSearch(text);
 if(/testimonio|otros clientes|quien compro|referencias de clientes/.test(t))return 'Para cuidar tu decisión, necesito confirmar qué testimonios están autorizados para compartir. ¿Qué aspecto te gustaría comprobar del desarrollo?';
 if(/quedan pocas|ultima unidad|se va a agotar|subira de precio|se valoriza/.test(t))return 'Necesitamos confirmar disponibilidad y condiciones actuales antes de hablar de oportunidades que se puedan perder. ¿Qué unidad te interesa revisar?';
 if(/no conozco|desconfio|me da desconfianza|es muy nuevo/.test(t))return 'Suena como que necesitás más confianza antes de avanzar. ¿Qué te daría más tranquilidad: revisar la documentación o hablar con un agente comercial?';
 if(/algo mas barato|opcion mas barata|opciones mas baratas/.test(t))return 'Tiene sentido cuidar tu presupuesto. ¿Preferís mantener la fecha de entrega o evaluar otro plazo para buscar un valor menor?';
 return null;
}
