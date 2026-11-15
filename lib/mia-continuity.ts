import type { MiaDecision,MiaSequence } from '@/lib/mia-sequence';
import { normalizeMia } from '@/lib/mia-sequence';
/** Advisor notification and automation pause are separate decisions. */
export function continueMiaAfterAdvisor(decision:MiaDecision):MiaDecision {
  if(!decision.handoff)return decision;
  const reason=decision.next.reason||'asesor';
  const resume=decision.next.resumeStage;
  return {...decision,handoff:false,notifyAdvisor:true,next:{...decision.next,stage:reason==='reserva'?'seguimiento_asesor':resume&&!['pendiente_asesor','conversacion_humana'].includes(resume)?resume:'conversacion_comercial',advisorRequest:{reason,requestedAt:new Date().toISOString()}},reply:decision.reply+'\n\nMientras tanto, puedo seguir ayudándote con la consulta.'};
}
export function miaMeetingDecision(state:MiaSequence,text:string):MiaDecision|undefined {
  const t=normalizeMia(text);
  if(/\bno\s+(?:quiero|necesito|puedo|prefiero)/.test(t))return;
  if(/(?:como (?:es|seria|funciona)|cuanto dura|en que consiste|que se (?:habla|ve)|es necesaria)/.test(t)&&!/quiero (?:coordinar|agendar)|agendemos|coordinemos|podemos coordinar/.test(t))return;
  const kind=/video\s*llamada|videoconferencia/.test(t)?'videollamada':/\breunion\b|\bvisita\b/.test(t)?'reunión':/^(?:una )?llamada[.!]*$/.test(t)?'llamada':undefined;
  const timeMention=/\b(?:lunes|martes|miercoles|jueves|viernes|sabado|domingo|manana|tarde|noche|hoy|pasado manana)\b|\b\d{1,2}[/:]\d{1,2}\b|\ba las \d{1,2}\b/.test(t);
  if(kind&&timeMention)return {next:{...state,meeting:{kind,requestedAt:new Date().toISOString(),preference:text.slice(0,400),preferenceAt:new Date().toISOString()}},notifyAdvisor:true,reply:'Anoté tu preferencia para la reunión 😊 El asesor te va a confirmar el horario. Mientras tanto, puedo ayudarte a revisar las opciones.'};
  if(kind){
    return {next:{...state,meeting:{kind,requestedAt:new Date().toISOString()}},notifyAdvisor:!state.meeting||state.meeting.kind!==kind,reply:`Podemos coordinar una ${kind} con un asesor 😊 ¿Qué día y franja horaria te quedan cómodos? El horario queda sujeto a confirmación del equipo.`};
  }
  if(state.meeting&&!state.meeting.preference&&/\b(?:lunes|martes|miercoles|jueves|viernes|sabado|domingo|manana|tarde|noche|hoy|pasado manana)\b|\b\d{1,2}[/:]\d{1,2}\b|\ba las \d{1,2}\b/.test(t)){
    return {next:{...state,meeting:{...state.meeting,preference:text.slice(0,400),preferenceAt:new Date().toISOString()}},notifyAdvisor:true,reply:'Gracias 😊 Anoté tu preferencia para que el asesor confirme el horario. Mientras tanto, ¿qué te gustaría revisar de los departamentos?'};
  }
}
