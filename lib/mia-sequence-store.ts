import { restoreMiaMissingFacts } from '@/lib/mia-context-facts';
import { continueMiaAfterAdvisor,miaMeetingDecision } from '@/lib/mia-continuity';
import { getMiaAccess,miaAccessAllows,miaConsultativeEnabled } from '@/lib/mia-access';
import { advanceMiaConsultative } from '@/lib/mia-consultative';
import type { MiaReservation } from '@/lib/mia-reservation';
import { interpretMiaReservation, miaKnownReservation } from '@/lib/mia-reservation-conversation';
import { randomUUID } from 'crypto';
import { getSharedDatabase, releaseSharedDatabase } from '@/lib/database-pool';
import { getMiaSources } from '@/lib/whatsapp-agent-settings';
import { getMiaGuidance, miaGuidancePrompt, EMPTY_MIA_GUIDANCE } from '@/lib/mia-guidance';
import { extractWhatsAppForm } from '@/lib/whatsapp-form-context';
import { DEFAULT_WHATSAPP_WELCOME, renderWhatsAppWelcome } from '@/lib/whatsapp-welcome-only';
import { advanceMiaSequence, parseMiaBudget, parseMiaPreferences, selectMiaProposal, miaMissingStage, MIA_STAGE_MESSAGES, miaFactsKey, miaStageAdvisor, type MiaSequence, type MiaFacts } from '@/lib/mia-sequence';
import { loadMiaSequenceInventory, verifyMiaOfferPlans } from '@/lib/mia-inventory';
import { generateGroqCustomerReply } from '@/lib/whatsapp-ai-provider';
import { hasMiaValues } from '@/lib/whatsapp-mia-safety';
import { loadMiaSourceContext } from '@/lib/whatsapp-mia-sources';

export const MIA_SEQUENCE_KEY='crm_mia_sequence_v1';
type Message={id:string;whatsappMessageId?:string;direction:string;senderType?:string;status:string;content:string;createdAt:string};
type Session={conversationId:string;resetMarkerId?:string;unavailableNotifiedFor?:string;searchIssues?:string[];state:MiaSequence;lastInboundId?:string;pending?:{messageId:string;reply:string;next:MiaSequence;handoff?:boolean}};

export function miaFormFacts(properties:Record<string,any>,messages:Message[]):MiaFacts {
  const facts:MiaFacts={neighborhoods:[]};
  const forms:Record<string,unknown>[]=[];
  for(const key of ['meta_form_submissions','whatsapp_form_submissions']) {
    try {const data=typeof properties[key]==='string'?JSON.parse(properties[key]):properties[key];if(Array.isArray(data))for(const entry of data)if(entry.fields)forms.push(entry.fields);}catch{}
  }
  forms.push(Object.fromEntries(Object.entries(properties).filter(([key])=>key.startsWith('meta_field_')).map(([key,value])=>[key.replace(/^meta_field_/,''),value])));
  for(const message of messages.filter(m=>m.direction==='inbound')) {
    const form=extractWhatsAppForm(message.content);if(Object.keys(form).length)forms.push({presupuesto:form.budget,ambientes:form.apartment});
  }
  for(const form of forms)for(const [key,value] of Object.entries(form)) {
    const name=key.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replaceAll('_',' '),text=String(value||'').trim();
    if(!text)continue;
    if(/presupuesto|budget/.test(name)&&!facts.budget)facts.budget=parseMiaBudget(text);
    if(/ambientes|tipo de departamento|apartment/.test(name)&&!facts.rooms)facts.rooms=parseMiaPreferences(text,'seleccion_ambientes').rooms;
    if(/barrio|neighborhood/.test(name)&&!facts.neighborhoods.length)facts.neighborhoods=parseMiaPreferences(text,'seleccion_barrios').neighborhoods||[];
    if(/entrega|delivery/.test(name)&&facts.deliveryMonths===undefined)facts.deliveryMonths=parseMiaPreferences(text,'seleccion_entrega').deliveryMonths;
  }
  // Recover explicit customer allowances from free text as well as labeled forms.
  // Bare numbers are menu answers, never money; advertised prices and AI messages are excluded.
  for(const message of messages.filter(m=>m.direction==='inbound'&&!['cleared','historical'].includes(m.status))) {
    const text=message.content.split('\n[Origen del anuncio]')[0];
    if(!/[?¿]/.test(text) && /(?:presupuesto|anticipo|cuotas?|mensual|(?:tengo|dispongo|puedo invertir|puedo destinar).{0,25}(?:usd|u\$s|d[oó]lares|\d))/i.test(text)) {
      const incoming=parseMiaBudget(text);
      if(incoming)facts.budget=facts.budget?{...incoming,...facts.budget,total:facts.budget.total||incoming.total,down:facts.budget.down||incoming.down,monthly:facts.budget.monthly||incoming.monthly}:incoming;
    }
  }
  return facts;
}

/** Preparing a reply never commits its next stage until that exact reply is saved as sent. */
export async function prepareMiaSequenceReply(conversationId:string,messages:Message[],name:string):Promise<string|null> {
  const last=messages.filter(m=>!['historical','cleared'].includes(m.status)&&m.direction!=='unknown').at(-1);
  if(!last||last.direction!=='inbound')return null;
  const sql=getSharedDatabase();
  try{return await sql.begin(async tx=>{
    const [conversation]=await tx`SELECT c.id,c.lead_id,c.ai_enabled,c.status,c.channel,c.assigned_agent_id,c.ai_assist_assigned,(SELECT id FROM crm_whatsapp_messages WHERE conversation_id=c.id AND status NOT IN ('historical','cleared') ORDER BY created_at DESC,id DESC LIMIT 1) AS latest_id FROM crm_whatsapp_conversations c WHERE c.id=${conversationId}`;
    if(!conversation?.lead_id||conversation.channel!=='whatsapp'||conversation.status==='closed'||conversation.latest_id!==last.id)return null;
    const access=await getMiaAccess(tx);
    if(!miaAccessAllows(access,conversationId))return null;
    const consultative=miaConsultativeEnabled(access);
    const manualPause=access.manualPause===true;
    const [lead]=await tx`SELECT id,meta_properties,first_name,last_name,email,phone,country_code FROM crm_leads WHERE id=${conversation.lead_id}`;
    if(!lead)return null;
    const props=lead.meta_properties||{};
    const stored=props[MIA_SEQUENCE_KEY];
    const originalState=JSON.stringify(stored||null);
    let session:Session|undefined=stored?.conversationId===conversationId?JSON.parse(JSON.stringify(stored)):undefined;
    const resetMarker=messages.filter(m=>m.status==='cleared').at(-1);
    const resetForMarker=!!(session&&resetMarker&&session.resetMarkerId!==resetMarker.id&&(
      !session.lastInboundId||!messages.some(m=>m.id===session!.lastInboundId)||session.state.reason==='datos_unidades_incompletos'&&!messages.some(m=>m.direction==='outbound'&&m.senderType==='ai'&&m.content.includes('Soy Mía'))
    ));
    if(resetForMarker)session=undefined;
    else if(session&&resetMarker)session.resetMarkerId=resetMarker.id;
    if(session?.pending?.messageId===last.id && (conversation.ai_enabled || !manualPause&&session.pending.handoff))return session.pending.reply;
    if(!conversation.ai_enabled||!manualPause&&conversation.assigned_agent_id&&!conversation.ai_assist_assigned)return null;
    if(session&&['pendiente_asesor','conversacion_humana'].includes(session.state.stage)){
      if(!manualPause)return null;
      session.state.stage=session.state.resumeStage||miaMissingStage(session.state.facts);
    }
    if(session?.lastInboundId===last.id)return null;
    const previous=messages.filter(m=>m.direction==='outbound'&&m.status!=='cleared'&&m.status!=='historical');
    // Never enroll chats already handled by a human or imported historical conversations automatically.
    if(!manualPause && !session && (previous.some(m=>m.senderType==='agent')||messages.some(m=>m.status==='historical')))return null;
    const fresh=!session&&(resetForMarker||!previous.length);
    if(!session)session={conversationId,resetMarkerId:resetMarker?.id,state:{stage:'bienvenida',facts:miaFormFacts(props,messages),offers:[]}};
    const sourceFacts=miaFormFacts(props,messages);
    session.state.facts={...sourceFacts,...session.state.facts,budget:sourceFacts.budget?{...session.state.facts.budget,...sourceFacts.budget}:session.state.facts.budget,rooms:session.state.facts.rooms||sourceFacts.rooms};
    session.state.facts=restoreMiaMissingFacts(session.state.facts,messages.slice(0,messages.findIndex(m=>m.id===last.id)));
    const meetingDecision=miaMeetingDecision(session.state,last.content);
    session.state.reservation={...miaKnownReservation(lead,props,messages,extractWhatsAppForm),...session.state.reservation};
    let reservationAnswer='';
    let reservationData:MiaReservation|undefined;
    if(!meetingDecision&&session.state.stage==='recopilacion_reserva'&&!miaStageAdvisor(session.state.stage,last.content)) {
      const guidance=await getMiaGuidance().catch(()=>EMPTY_MIA_GUIDANCE);
      const interpreted=await interpretMiaReservation(last.content,session.state.reservation,session.state.selected?.project||'el desarrollo seleccionado',miaGuidancePrompt(guidance,last.content));
      reservationData=interpreted.data;
      reservationAnswer=interpreted.answer;

    }
    const sources=await getMiaSources();
    let decision;
    const searchIssues:string[]=[];
    if(!consultative && fresh && !miaStageAdvisor(session.state.stage,last.content))decision={next:{...session.state,stage:'bienvenida' as const},reply:renderWhatsAppWelcome(DEFAULT_WHATSAPP_WELCOME,messages,{nombre:name})};
    else {
      const explicit=parseMiaPreferences(last.content,session.state.stage);
      if(!consultative&&['unidades_presentadas','unidad_seleccionada'].includes(session.state.stage) && (explicit.rooms&&explicit.rooms!==session.state.facts.rooms || explicit.neighborhoods&&JSON.stringify(explicit.neighborhoods)!==JSON.stringify(session.state.facts.neighborhoods) || explicit.deliveryMonths!==undefined&&explicit.deliveryMonths!==session.state.facts.deliveryMonths)) {
        session.state={...session.state,stage:'seleccion_ambientes',facts:{...session.state.facts,...explicit},offers:[],selected:undefined};
      }
      const inventory=async (facts:MiaFacts)=>{
        try {const inventory=await loadMiaSequenceInventory(sources,facts,searchIssues);
          const pair=selectMiaProposal(inventory,facts).offers;
          const verified=await verifyMiaOfferPlans(pair);
          if(verified.length===pair.length)return verified;
          return await verifyMiaOfferPlans(inventory.filter(q=>!pair.includes(q)).slice(0,8));}catch(error){searchIssues.push(error instanceof Error?error.message.slice(0,200):'No se pudo consultar el inventario.');return [];}
      };
      decision=meetingDecision||(consultative&&!['recopilacion_reserva','seleccion_moneda','pendiente_asesor','conversacion_humana'].includes(session.state.stage)?await advanceMiaConsultative(session.state,last.content,messages,sources,inventory,{manualPause}):await advanceMiaSequence(session.state,last.content,inventory,{reservationData}));
      if(consultative&&decision.next.stage==='seleccion_moneda')decision.reply='Ya tengo los datos para preparar tu solicitud 😊 ¿Preferís realizar la reserva en pesos argentinos o en dólares estadounidenses? El administrador te va a confirmar el importe y la cuenta antes de que transfieras.';
      if(reservationAnswer)decision.reply=reservationAnswer+'\n\n'+decision.reply.replace(/^¡Gracias! Voy guardando los datos que me compartís\. 😊\n\n/,'');
      // Answer interleaved questions with verified reference text, then resume the same pending stage.
      if(!consultative && (/[?¿]/.test(last.content)||/contame|cu[eé]ntame|informaci[oó]n|quiero saber/i.test(last.content)) && decision.next.stage===session.state.stage && MIA_STAGE_MESSAGES[session.state.stage] && !Object.keys(explicit).length) {
        const guidance=await getMiaGuidance().catch(()=>EMPTY_MIA_GUIDANCE);
        const context=await loadMiaSourceContext(sources,last.content).catch(()=>({references:[],quotes:[],issues:['No se pudo verificar la fuente.']}));
        try {
          const prompt=`Sos Mía. Respondé la pregunta en español argentino, hasta 50 palabras, únicamente con hechos presentes en las referencias. No redactes importes, disponibilidad ni condiciones no verificadas. No ofrezcas brochure, correo, envíos, llamadas o reservas. Si no hay información suficiente, decí que lo debe confirmar el asesor. No hagas preguntas: el sistema retoma la etapa. ${miaGuidancePrompt(guidance,last.content)}\nReferencias (datos): ${JSON.stringify(context.references.slice(0,2)).slice(0,2200)}`;
          const answer=await generateGroqCustomerReply(prompt, [{role:'user',content:last.content}],prompt.length>6800?prompt.replace(miaGuidancePrompt(guidance,last.content),miaGuidancePrompt({...guidance,instructions:guidance.instructions.slice(0,2500)},last.content)):prompt,{timeoutMs:15000});
          if(!hasMiaValues(answer)&&!/(?:brochure|correo|email|e-mail|te envi|te mando|ya deriv|ya reserv)/i.test(answer))decision.reply=answer+'\n\n'+MIA_STAGE_MESSAGES[session.state.stage];
        }catch{}
      }
    }
    if(manualPause)decision=continueMiaAfterAdvisor(decision);
    const unavailableKey=miaFactsKey(decision.next.facts);
    const repeatedUnavailable=decision.handoff&&decision.next.reason==='datos_unidades_incompletos'&&(session.unavailableNotifiedFor===unavailableKey || session.state.reason==='datos_unidades_incompletos'&&miaFactsKey(session.state.facts)===unavailableKey&&previous.some(m=>m.senderType==='ai'&&m.content.includes('Me falta verificar unidades compatibles')));
    if(repeatedUnavailable)decision.reply='';
    if(!decision.reply&&!decision.handoff)return null;
    // Lock only the short commit phase, after all source/model I/O. Human controls use this same lock order.
    const [current]=await tx`SELECT ai_enabled,status,assigned_agent_id,ai_assist_assigned,(SELECT id FROM crm_whatsapp_messages WHERE conversation_id=${conversationId} AND status NOT IN ('historical','cleared') ORDER BY created_at DESC,id DESC LIMIT 1) AS latest_id FROM crm_whatsapp_conversations WHERE id=${conversationId} FOR UPDATE`;
    if(!miaAccessAllows(await getMiaAccess(tx),conversationId))return null;
    if(!current?.ai_enabled||current.status==='closed'||current.latest_id!==last.id||!manualPause&&current.assigned_agent_id&&!current.ai_assist_assigned)return null;
    const [currentLead]=await tx`SELECT meta_properties FROM crm_leads WHERE id=${lead.id} FOR UPDATE`;
    if(JSON.stringify(currentLead?.meta_properties?.[MIA_SEQUENCE_KEY]||null)!==originalState)return null;
    const pending={messageId:last.id,reply:decision.reply,next:decision.next,handoff:decision.handoff};
    const updated:Session={...session,pending,searchIssues:searchIssues.slice(0,20)};
    if(repeatedUnavailable){delete updated.pending;updated.lastInboundId=last.id;}
    if(decision.handoff||decision.notifyAdvisor) {
      if(decision.handoff){updated.state=decision.next;
      await tx`UPDATE crm_whatsapp_conversations SET ai_enabled=FALSE,updated_at=NOW() WHERE id=${conversationId}`;}
      if(!repeatedUnavailable)await tx`INSERT INTO crm_notifications(id,recipient_agent_id,lead_id,event_key,type,title,body,href) SELECT ${randomUUID()},assigned_agent_id,${lead.id},${'mia-handoff:'+last.id},'campaign_recontact',${decision.next.reason==='reserva'?'Mía: solicitud de reserva pendiente':decision.next.meeting?'Mía: solicitud de reunión o llamada':'Mía: cliente solicita asesor'},${decision.next.meeting?`${decision.next.meeting.kind}. Preferencia: ${decision.next.meeting.preference||'Pendiente de indicar día y horario'}. Requiere confirmación del equipo.`:decision.next.selected?`${decision.next.selected.project} · Unidad ${decision.next.selected.unit}. Solicitud pendiente; no hay reserva confirmada.`:'Revisá las preferencias y los datos comerciales pendientes en el historial de WhatsApp.'},${'/admin/crm/'+lead.id} FROM crm_whatsapp_conversations WHERE id=${conversationId} ON CONFLICT(event_key) DO NOTHING`;
    }
    await tx`UPDATE crm_leads SET meta_properties=COALESCE(meta_properties,'{}'::jsonb)||${tx.json({[MIA_SEQUENCE_KEY]:updated})},updated_at=NOW() WHERE id=${lead.id}`;
    return decision.reply||null;
  });}finally{await releaseSharedDatabase(sql);}
}

export async function recordMiaSequenceOutbound(tx:any,conversationId:string,senderType:string,content:string,historical:boolean) {
  if(historical||!['ai','agent'].includes(senderType))return;
  const [lead]=await tx`SELECT l.id,l.meta_properties FROM crm_leads l JOIN crm_whatsapp_conversations c ON c.lead_id=l.id WHERE c.id=${conversationId} FOR UPDATE OF l`;
  const session:Session|undefined=lead?.meta_properties?.[MIA_SEQUENCE_KEY];
  if(!session||session.conversationId!==conversationId)return;
  if(senderType==='ai'&&session.pending?.reply===content) {
    if(session.pending.next.reason==='datos_unidades_incompletos')session.unavailableNotifiedFor=miaFactsKey(session.pending.next.facts);
    session.state=session.pending.next;session.lastInboundId=session.pending.messageId;delete session.pending;
  }else if(senderType==='agent') {
    if((await getMiaAccess(tx)).manualPause){delete session.pending;}else{
    session.state.resumeStage=session.state.resumeStage||session.state.stage;session.state.stage='conversacion_humana';delete session.pending;
    await tx`UPDATE crm_whatsapp_conversations SET ai_enabled=FALSE,updated_at=NOW() WHERE id=${conversationId}`;}
  }else return;
  await tx`UPDATE crm_leads SET meta_properties=COALESCE(meta_properties,'{}'::jsonb)||${tx.json({[MIA_SEQUENCE_KEY]:session})},updated_at=NOW() WHERE id=${lead.id}`;
}

/** Only an explicit CRM control action can restart a conversation handed to a human. */
export async function updateMiaSequenceControl(tx:any,conversationId:string,enabled:boolean) {
  const [lead]=await tx`SELECT l.id,l.meta_properties FROM crm_leads l JOIN crm_whatsapp_conversations c ON c.lead_id=l.id WHERE c.id=${conversationId} FOR UPDATE OF l`;
  let session:Session|undefined=lead?.meta_properties?.[MIA_SEQUENCE_KEY];
  if(!lead)return;
  if(!session||session.conversationId!==conversationId) {
    if(!enabled)return;
    session={conversationId,state:{stage:'bienvenida',facts:miaFormFacts(lead.meta_properties||{},[]),offers:[]}};
  }
  if(enabled && ['pendiente_asesor','conversacion_humana'].includes(session.state.stage)) session.state.stage=session.state.resumeStage||miaMissingStage(session.state.facts);
  if(!enabled && session.state.stage!=='conversacion_humana') {session.state.resumeStage=session.state.resumeStage||session.state.stage;session.state.stage='conversacion_humana';}
  delete session.pending;
  await tx`UPDATE crm_leads SET meta_properties=COALESCE(meta_properties,'{}'::jsonb)||${tx.json({[MIA_SEQUENCE_KEY]:session})},updated_at=NOW() WHERE id=${lead.id}`;
}
