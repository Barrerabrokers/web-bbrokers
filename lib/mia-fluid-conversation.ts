import { normalizeMiaSearch, type AgentMemory } from '@/lib/mia-agent-search';
type Message={direction:string;content:string};
/** Empathy names the concern expressed by the customer; it never infers consent or urgency. */
export function miaEmpathyReply(text:string,memory:AgentMemory,previous:string[]){
 const t=normalizeMiaSearch(text),last=previous.at(-1)||'';
 if(/no me interesa|no me (?:escribas|contactes)|dejame de|baja|cancel|reprogram|cambiar.*reunion/.test(t))return null;
 if(/no quiero.*presion|no me presiones|sin presion/.test(t))return 'Parece que querés decidir sin presión. ¿Te molestaría que aclaremos solo la duda que vos elijas?';
 if(/esta caro|es caro|muy caro|se me va|fuera de (?:mi )?presupuesto|precio me preocupa|me preocupa el precio/.test(t)){
  if(/Parece que el (?:precio|número)/.test(last)&&/^(?:esta|es|muy) caro$/.test(t))return '¿Caro?';
  if(memory.preferences.total||memory.form?.budget)return last.includes('priorizar')?'¿La entrega o las cuotas?':'Parece que el precio supera lo que querés destinar. ¿Qué te ayudaría más a priorizar: una entrega distinta o un plan de cuotas diferente?';
  return last.includes('numero te frena')?'¿Qué rango te permitiría avanzar con tranquilidad?':'Parece que el número te frena. ¿Qué número te haría sentir cómodo para avanzar?';
 }
 if(/lo voy a pensar|quiero pensarlo|lo pienso|lo veo|necesito pensarlo|tengo que pensarlo/.test(t)&&!text.includes('?'))return last.includes('evaluarlo con calma')?'¿Qué información te falta para decidir con tranquilidad?':'Parece que querés evaluarlo con calma. ¿Qué necesitás aclarar primero: la financiación o la unidad?';
 if(/me preocupa.*entrega|miedo.*(?:demora|entrega)|no quiero.*demor/.test(t))return memory.deliveryPreference||memory.preferences.delivery==='immediate'?'Parece que cumplir el plazo es fundamental para vos. ¿Qué te daría más tranquilidad sobre la entrega?':'Parece que una demora te preocupa. ¿Qué fecha de entrega necesitás como límite?';
 if(/me da miedo|me preocupa|no estoy seguro|tengo dudas/.test(t)&&!text.includes('?'))return 'Suena como que necesitás más claridad antes de avanzar. ¿Qué parte te genera más dudas?';
 return null;
}
export function miaConversationSummary(memory:AgentMemory,messages:Message[],text:string){
 const replies=messages.filter(m=>m.direction==='outbound'),lastSummary=replies.map(m=>m.content.startsWith('Entonces,')).lastIndexOf(true);
 if(replies.length-(lastSummary+1)<4||!/^(si|dale|ok|perfecto|es correcto|correcto|entiendo|me interesa)$/.test(normalizeMiaSearch(text)))return null;
 const p=memory.preferences,parts:string[]=[];
 if(p.purpose)parts.push('buscás '+(p.purpose==='living'?'para vivir':p.purpose==='temporary_rental'?'para alquiler temporario':'para invertir'));
 if(p.neighborhoods.length)parts.push('en '+p.neighborhoods.join(' o '));
 if(p.total)parts.push('con un tope de '+p.total.currency+' '+new Intl.NumberFormat('es-AR').format(p.total.amount));
 if(p.delivery==='immediate')parts.push('con entrega inmediata');else if(memory.deliveryPreference)parts.push(/20\d{2}/.test(memory.deliveryPreference.evidence)?'con entrega para '+memory.deliveryPreference.evidence.match(/20\d{2}/)![0]:'con un plazo objetivo de '+memory.deliveryPreference.targetMonths+' meses');
 if(p.financing===true)parts.push('y con financiación');
 if(parts.length<3)return null;
 return 'Entonces, '+parts.join(', ')+'.\n¿Es correcto?';
}
