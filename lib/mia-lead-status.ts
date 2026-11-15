import { randomUUID } from 'crypto';

export type MiaStatusEvent = { id:string; direction:string; content:string; at:string; successful?:boolean };
export type MiaStatusDecision = { status:string; reason:string; evidenceIds:string[] };
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();

// Quoted email threads, advertisements and automated absence notices are not customer intent.
export function miaCustomerStatusText(body:string){
 return body.split(/\r?\n\s*>|\r?\n\s*(?:El .{0,250}|On .{0,250})(?:escribi[oó]:|wrote:)|\r?\n\s*\[Origen del anuncio\]/i)[0].trim();
}
export function decideMiaLeadStatus(current:string,events:MiaStatusEvent[]):MiaStatusDecision|null {
 if(/^(vendido|reservado|reuni[oó]n|perdido|no contactar)$/i.test(current.trim()))return null;
 let status=current,reason='',evidenceIds:string[]=[],human=false;
 for(const event of [...events].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)||a.id.localeCompare(b.id))){
  if(event.direction!=='inbound')continue;
  const text=normalize(miaCustomerStatusText(event.content));
  if(!text||/en este momento no estoy disponible.{0,80}(?:respondere|responderemos)|respuesta automatica|fuera de (?:la )?oficina|out of office|automatic reply/.test(text))continue;
  human=true;
  const decline=/\b(?:no (?:me interesa|estoy interesad[oa]|sigo interesad[oa]|deseo recibir|quiero recibir)|ya no (?:estoy interesad[oa]|busco)|ya (?:compre|compramos)|suspend(?:er|an|e) (?:la )?busqueda|no me (?:escribas|contactes|llames|mandes)|darme de baja|dame de baja|no contactar|no quiero mas mensajes)\b/.test(text)||/^(?:no[, ]+gracias|baja|stop)[.!\s]*$/.test(text);
  const interest=!decline&&!/\b(?:no|nunca)\s+(?:quiero|busco|estoy|me)\b/.test(text)&&/\b(?:me interesa|estoy interesad[oa]|quiero (?:comprar|invertir|reservar|agendar|organizar una reunion)|busco|buscando|pasame (?:los )?(?:precios|valores|planos|brochure)|(?:precios|financiacion|brochure|plano|presupuesto)|hay (?:monoambientes|departamentos))\b/.test(text);
  if(decline){status='No interesado / no califica';reason='El cliente rechazó continuar o suspendió la búsqueda.';}
  else if(interest){status='Interesado';reason='El cliente expresó una búsqueda o pidió información comercial concreta.';}
  else if(!['Interesado','No interesado / no califica'].includes(status)){
   status=/^(?:hola(?: mia)?|buen(?:os dias| dia|as tardes|as noches)|gracias|ok(?:ay)?|dale|si|perfecto)[.!\s]*$/.test(text)?'Contactado':'En curso';
   reason=status==='Contactado'?'El cliente respondió sin expresar todavía una necesidad concreta.':'Hay una interacción del cliente en la conversación.';
  }else continue;
  evidenceIds=[event.id];
 }
 if(!human&&['Nuevo','Intento de contacto','No contesta'].includes(current)){
  const sent=events.filter(e=>e.direction==='outbound'&&e.successful).at(-1);
  if(sent){status='No contesta';reason='MIA registró un envío exitoso y no hay una respuesta humana desde la asignación.';evidenceIds=[sent.id];}
 }
 return reason&&status!==current?{status,reason,evidenceIds}:null;
}

/** State reconciliation only: never dispatch messages, status workflows or conversion events. */
export async function reconcileMiaLeadStatuses(sql:any,input:{agentId:string;leadIds?:string[]|null;dryRun?:boolean}) {
 const leads=await sql`SELECT l.id FROM crm_leads l JOIN crm_mia_sales_enrollments e ON e.lead_id=l.id
  WHERE l.assigned_agent_id=${input.agentId} AND (${!input.leadIds} OR l.id=ANY(${input.leadIds||[]}::uuid[])) ORDER BY l.id`;
 const changed:{id:string;from:string;to:string}[]=[],blocked:{id:string;reason:string}[]=[];
 for(const item of leads){
  try{
   const change=await sql.begin(async(tx:any)=>{
    const [lead]=await tx`SELECT l.status,e.started_at FROM crm_leads l JOIN crm_mia_sales_enrollments e ON e.lead_id=l.id
     WHERE l.id=${item.id} AND l.assigned_agent_id=${input.agentId} FOR UPDATE OF l`;
    if(!lead)return null;
    const events=await tx`SELECT m.id::text id,m.direction,m.content,m.created_at at,(m.direction='outbound' AND m.status IN('sent','delivered','read')) successful
     FROM crm_whatsapp_messages m JOIN crm_whatsapp_conversations c ON c.id=m.conversation_id
     WHERE c.lead_id=${item.id} AND c.channel='whatsapp' AND m.created_at>=${lead.started_at}
      AND m.status NOT IN('historical','cleared','failed','error') AND (m.direction='outbound' OR m.sender_type='customer')
     UNION ALL SELECT a.id::text,'inbound',a.body,COALESCE(a.scheduled_at,a.created_at),FALSE FROM crm_activities a
      WHERE a.lead_id=${item.id} AND a.external_source='gmail_inbound' AND COALESCE(a.scheduled_at,a.created_at)>=${lead.started_at}
     UNION ALL SELECT j.id::text,'outbound',j.content,j.sent_at,TRUE FROM crm_mia_sales_jobs j
      WHERE j.lead_id=${item.id} AND j.channel='email' AND j.state='sent' AND j.sent_at>=${lead.started_at}
     ORDER BY at,id`;
    const decision=decideMiaLeadStatus(lead.status,events.map((e:any)=>({...e,at:new Date(e.at).toISOString()})));
    if(!decision)return null;
    if(input.dryRun)return {id:item.id,from:lead.status,to:decision.status};
    await tx`UPDATE crm_leads SET status=${decision.status},updated_at=NOW() WHERE id=${item.id} AND assigned_agent_id=${input.agentId}`;
    await tx`INSERT INTO crm_activities(id,lead_id,type,title,body,created_by,external_source,external_id)
     VALUES(${randomUUID()},${item.id},'nota','MIA: estado actualizado según la interacción',
      ${`${lead.status} → ${decision.status}. ${decision.reason}\nEvidencia: ${decision.evidenceIds.join(', ')}`},${input.agentId},'mia_status_reconciliation',${randomUUID()})`;
    return {id:item.id,from:lead.status,to:decision.status};
   });
   if(change)changed.push(change);
  }catch(error){if((error as {code?:string}).code!=='P0001')throw error;blocked.push({id:item.id,reason:(error as Error).message});}
 }
 return {changed,blocked};
}
