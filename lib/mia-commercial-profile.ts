import { miaDeliveryPreferenceSummary } from '@/lib/mia-delivery-preference';
import type { AgentMemory } from '@/lib/mia-agent-search';
import type { AgentPreferences } from '@/lib/mia-agent-search';
import { getSharedDatabase, releaseSharedDatabase } from '@/lib/database-pool';

type Interest = { temperature: 'frio'|'tibio'|'caliente'; reason: string };
const normalize=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();

/** Classify only explicit customer signals. Silence and greetings are not disinterest. */
export function miaInterest(customerText:string):Interest|null {
  const text=normalize(customerText.split('\n[Origen del anuncio]')[0]);
  if(/^(?:no me interesa|no quiero comprar|no quiero invertir|no por ahora)[.! ]*$|solo (?:estoy )?(?:mirando|averiguando|explorando)(?:[.!]|$)|(?:prefiero|quiero) (?:comprar |invertir )?mas adelante/.test(text))
    return {temperature:'frio',reason:'El cliente indicó que está explorando o que no quiere avanzar por ahora.'};
  // A refusal, a hypothetical question or cancellation must never become a hot lead.
  if(/\bno\b|cancel|todavia|aun no|hipotetic|si quisiera/.test(text))return null;
  if(/(?:quiero|quisiera|me gustaria|podemos|necesito|vamos a|puedo|podria)\s+(?:\w+\s+){0,3}(?:agendar|coordinar|reunir|visitar|reservar|avanzar)|\b(?:agendemos|coordinemos|reservemos)\b|(?:enviame|mandame|pasame|quiero|necesito)\s+(?:una |la )?propuesta/.test(text))
    return {temperature:'caliente',reason:'El cliente solicitó una reunión, visita, reserva o propuesta comercial.'};
  if(/\b(?:busco|estoy buscando|me interesa|presupuesto|anticipo|financiacion|cuotas|ambientes|dormitorios)\b/.test(text))
    return {temperature:'tibio',reason:'El cliente expresó una búsqueda concreta o consultó condiciones de compra.'};
  return null;
}

export function miaPreferenceSummary(p:AgentPreferences):string {
  const purpose={living:'Vivienda',investment:'Inversión',temporary_rental:'Alquiler temporario'};
  const money=(label:string,value:AgentPreferences['total'])=>value?`${label}: ${value.currency} ${value.amount.toLocaleString('es-AR')}`:'';
  return [p.purpose?`Objetivo: ${purpose[p.purpose]}`:'',p.projects.length?`Desarrollos: ${p.projects.join(', ')}`:'',
    p.neighborhoods.length?`Zonas: ${p.neighborhoods.join(', ')}`:'',p.rooms.length?`Ambientes: ${p.rooms.join(' o ')}`:'',
    money('Presupuesto total máximo',p.total),money('Anticipo máximo',p.down),money('Cuota máxima',p.monthly),
    p.delivery==='immediate'?'Entrega inmediata':p.delivery==='construction'?'Acepta obra o preventa':'',
    p.financing===true?'Busca financiación':''].filter(Boolean).join('. ');
}

/** Runs inside the current inbound transaction. Never writes lead status or owner. */
export async function persistMiaCommercialProfile(tx:any,conversationId:string,inboundId:string,p?:AgentPreferences,pendingQuestions?:{question:string;reason:string}[],deliveryPreference?:AgentMemory['deliveryPreference']) {
  const [row]=await tx`SELECT l.id,l.temperature,l.notes,l.meta_properties,m.content FROM crm_whatsapp_conversations c
    JOIN crm_leads l ON l.id=c.lead_id JOIN crm_whatsapp_messages m ON m.conversation_id=c.id
    WHERE c.id=${conversationId} AND m.id=${inboundId} AND m.direction='inbound' FOR UPDATE OF l`;
  if(!row)return;
  const interest=miaInterest(row.content),summary=p?[miaPreferenceSummary(p),miaDeliveryPreferenceSummary(deliveryPreference)].filter(Boolean).join('. '):'';
  const previous=row.meta_properties?.mia_commercial_profile_v1;
  // Preserve a human-set temperature; MIA can update its own classification.
  const mayColor=!row.temperature||previous?.appliedTemperature===row.temperature;
  // Keep a hot opportunity through neutral follow-ups; only an explicit cold signal downgrades it.
  const temperature=interest&&!(row.temperature==='caliente'&&interest.temperature==='tibio')&&mayColor?interest.temperature:row.temperature||'';
  const reason=row.temperature==='caliente'&&interest?.temperature==='tibio'?previous?.reason||interest.reason:interest?.reason||previous?.reason||'';
  const preferences=p?summary:previous?.summary||'';
  const pending=pendingQuestions||previous?.pendingQuestions||[];
  if(!preferences&&!interest&&!previous?.summary&&!pending.length)return;
  if(previous?.summary===preferences&&previous?.reason===reason&&previous?.temperature===temperature&&JSON.stringify(previous?.pendingQuestions||[])===JSON.stringify(pending))return;
  const note=['MIA · Interés: '+({frio:'frío',tibio:'tibio',caliente:'caliente'}[temperature as 'frio'|'tibio'|'caliente']||'sin definir'),reason,preferences,pending.length?'Por confirmar con el equipo:\n'+pending.map((q:{question:string;reason:string})=>q.question+' — '+q.reason).join('\n'):''].filter(Boolean).join('\n');
  const profile={deliveryPreference:deliveryPreference||previous?.deliveryPreference||null,pendingQuestions:pending,summary:preferences,reason,temperature,appliedTemperature:mayColor?temperature:previous?.appliedTemperature||null,inboundId,updatedAt:new Date().toISOString()};
  await tx`UPDATE crm_leads SET temperature=${temperature},notes=concat_ws(E'\n\n',NULLIF(notes,''),${note}::text),
    meta_properties=COALESCE(meta_properties,'{}'::jsonb)||${tx.json({mia_commercial_profile_v1:profile})},updated_at=NOW() WHERE id=${row.id}`;
}

/** Agenda turns bypass the search planner but must still record explicit interest. */
export async function recordMiaMeetingInterest(conversationId:string,inboundId?:string) {
  if(!inboundId)return;
  const sql=getSharedDatabase();
  try { await sql.begin(async tx=>{
    await tx`SELECT pg_advisory_xact_lock(hashtext(${'mia-agent-memory:'+conversationId}))`;
    const [latest]=await tx`SELECT m.id FROM crm_whatsapp_messages m JOIN crm_whatsapp_conversations c ON c.id=m.conversation_id
      WHERE m.conversation_id=${conversationId} AND m.status NOT IN ('historical','cleared') AND c.ai_enabled=TRUE
      ORDER BY m.created_at DESC,m.id DESC LIMIT 1`;
    if(latest?.id===inboundId)await persistMiaCommercialProfile(tx,conversationId,inboundId);
  }); } finally { await releaseSharedDatabase(sql); }
}
