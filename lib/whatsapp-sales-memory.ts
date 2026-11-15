import type { WhatsAppAttachment } from '@/lib/whatsapp-attachment-policy';
import { extractConversationForms, extractWhatsAppForm } from '@/lib/whatsapp-form-context';
type Message = {direction:string;content:string;status?:string;senderType?:string;attachment?:WhatsAppAttachment};
const clean = (s:string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
/** Resolve the customer's current request, independently of old ads and assistant guesses. */
export function customerProjectRequest(text:string):string[] {
  const query=clean(text);
  const mentions: {name:string;position:number}[]=[];
  const names: [string,RegExp][]=[['Feel Recoleta',/\b(?:feel\s+)?recoleta\b/g],['Feel Palermo',/\b(?:feel\s+)?palermo\b/g],['Alpha Place Belgrano',/\balpha(?:\s+place)?\s+belgrano\b/g],['Alpha Place Libertador',/\balpha(?:\s+place)?\s+libertador\b/g]];
  for(const [name,pattern] of names)for(const match of query.matchAll(pattern))mentions.push({name,position:match.index!});
  mentions.sort((a,b)=>a.position-b.position);
  if(!mentions.length)return [];
  const namesMentioned=[...new Set(mentions.map(m=>m.name))];
  const between=query.slice(mentions[0].position,mentions.at(-1)!.position);
  if(namesMentioned.length>1 && (/compar|\bentre\b|ambos|las dos/.test(query) || /\bo\b/.test(between)))return namesMentioned;
  return [mentions.at(-1)!.name];
}
export function buildSalesMemory(messages:Message[], crm:Record<string,unknown> = {}) {
  const valid=messages.filter(m=>m.direction!=='unknown' && m.status!=='historical');
  const incoming=valid.filter(m=>m.direction==='inbound');
  const crmText=Object.entries((crm.formularioMeta||{}) as Record<string,unknown>).filter(([key])=>key.startsWith('meta_field_')).map(([key,value])=>`${key.replace(/^meta_field_/,'').replace(/_/g,' ')}: ${String(value||'').replace(/_/g,' ')}`).join('\n');
  const form={...extractWhatsAppForm(crmText),...extractConversationForms(incoming)};
  if(!form.name && typeof crm.nombre==='string')form.name=crm.nombre;
  if(!form.email && typeof crm.email==='string')form.email=crm.email;
  let projects:string[]=[];
  let rooms=form.apartment;
  let budget=form.budget;
  let goal:string|undefined;
  let floorPreference:string|undefined;
  let proposalRequested=false;
  for(const message of incoming){
    const focus=customerProjectRequest(message.content);if(focus.length)projects=focus;
    const body=message.content.split('[Origen del anuncio]')[0];
    const text=clean(body);
    const floorMatch=body.match(/pisos?\s+altos?|(?:desde|minimo|mínimo)\s+(?:el\s+)?piso\s*\d+|piso\s*\d+(?:\s*(?:o superior|para arriba))?/i);
    if(floorMatch)floorPreference=floorMatch[0];
    else if(/no me gustan? (?:los )?pisos? bajos?/.test(text))floorPreference='piso alto';
    const index=valid.indexOf(message),previous=valid.slice(0,index).filter(m=>m.direction==='outbound').at(-1)?.content||'';
    if(/^(?:si|dale|me sirve|de acuerdo|avancemos)\b/.test(text) && /primer paso|alternativa|empezar|unidad menor/i.test(previous) && /monoambiente/i.test(previous) && /anticipo|Te sirve empezar con esta alternativa/i.test(previous)) {
      rooms='Monoambiente';
      const acceptedFloor=previous.match(/\bpiso\s*(\d+)\b/i);if(acceptedFloor)floorPreference=acceptedFloor[0];
      const acceptedProject=customerProjectRequest(previous);if(acceptedProject.length===1)projects=acceptedProject;
      proposalRequested=true;
    }
    if(/(?:quiero|manda|envia|avanzar|avancemos).{0,30}propuesta/.test(text) || (/^si\b/.test(text) && /propuesta/i.test(previous)))proposalRequested=true;
    if(/no quiero|prefiero esperar|ahora no/.test(text))proposalRequested=false;
    const roomMatch=[...body.matchAll(/\b([123])\s*ambientes?\b|\bmonoambiente\b/gi)].at(-1);
    if(roomMatch)rooms=roomMatch[0];
    const parsedBudget=extractWhatsAppForm(body).budget;
    if(parsedBudget)budget=parsedBudget;
    else if(/anticipo|presupuesto|cuota/.test(text) && /\d/.test(body))budget=body.slice(0,700);
    if(/\b(?:invertir|inversion|renta|alquil|reventa|para vivir|vivienda)\b/.test(text))goal=body.slice(0,500);
  }
  // Inspect all saved turns; retain important early answers and relevant evidence within model limits.
  const evidence=valid.map((m,index)=>({index,role:m.direction==='inbound'?'cliente':m.senderType==='agent'?'respuesta del administrador/equipo':'respuesta anterior (puede contener errores)',text:(m.content+(m.attachment?`\n[Archivo enviado: ${m.attachment.filename}; tipo ${m.attachment.type}. El contenido del archivo no fue extraído.]`:'')).slice(0,600),score:(index>=valid.length-12?100:0)+(m.direction==='inbound'?10:0)+(/presupuesto|anticipo|cuota|ambientes|invert|vivir|reserva|no quiero|formulario|nombre|email/i.test(m.content)?30:0)}));
  const selected:typeof evidence=[];let size=0;
  for(const item of [...evidence].sort((a,b)=>b.score-a.score||b.index-a.index)){const cost=item.text.length+100;if(size+cost<=12000){selected.push(item);size+=cost;}}
  selected.sort((a,b)=>a.index-b.index);
  const questions=valid.filter(m=>m.direction==='outbound'&&m.content.includes('?')).map(m=>m.content.match(/[^.!\n]*\?/g)?.join(' ')||'').filter(Boolean);
  return {consultedMessages:valid.length,projectRequest:projects,known:{...form,apartment:rooms,budget,goal,floorPreference,proposalRequested},previousQuestions:[...new Set(questions)].slice(-25),conversationEvidence:selected.map(({index,role,text})=>({turn:index,role,text}))};
}
export function asksKnownQualification(text:string,memory:ReturnType<typeof buildSalesMemory>) {
  const questions=clean(text.match(/[^.!\n]*\?/g)?.join(' ')||'');
  return !!((memory.known.apartment && /(?:cuantos|que cantidad|que tipo).{0,35}(?:ambientes|departamento)/.test(questions)) || (memory.known.budget && /(?:cual|cuanto|que).{0,30}(?:presupuesto|anticipo disponible|podes destinar)/.test(questions)) || (memory.known.name && /(?:como te llamas|tu nombre)/.test(questions)) || (memory.known.email && /(?:tu (?:email|correo)|correo electronico)/.test(questions)));
}
