import { randomUUID } from 'crypto';
const ZONE='America/Argentina/Buenos_Aires',DAY=86400000;
/** A fixed weekly slot: Sunday 20:00 Argentina (23:00 UTC). Keep Sunday's slot while its dispatch window is open. */
export function miaSundayFollowupDue(now=new Date(),notBefore?:string|null){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const get=(key:string)=>Number(parts.find(p=>p.type===key)?.value);
 const day=Date.UTC(get('year'),get('month')-1,get('day'));
 let slot=day+((7-new Date(day).getUTCDay())%7)*DAY+23*3600000;
 const minimum=notBefore?Date.parse(notBefore):NaN;
 if(Number.isFinite(minimum)&&minimum>slot)slot+=Math.ceil((minimum-slot)/(7*DAY))*7*DAY;
 return new Date(slot).toISOString();
}
export function miaSundayDispatchOpen(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:ZONE,weekday:'short',hour:'numeric',hourCycle:'h23'}).formatToParts(now);
 return parts.find(p=>p.type==='weekday')?.value==='Sun'&&Number(parts.find(p=>p.type==='hour')?.value)>=20;
}
/** One email and WhatsApp per active lead per Sunday, independent of replies during the week. */
export async function reconcileMiaSalesFollowup(sql:any,e:any,c:any,now=new Date()){
 return sql.begin(async(tx:any)=>{
  await tx`SELECT pg_advisory_xact_lock(hashtext(${'mia-followup:'+e.lead_id}))`;
  const [allowed]=await tx`SELECT e.analysis FROM crm_mia_sales_enrollments e JOIN crm_mia_sales_control c ON c.run_id=e.run_id JOIN crm_leads l ON l.id=e.lead_id JOIN agents a ON a.id=c.agent_id WHERE e.lead_id=${e.lead_id} AND e.state='working' AND c.enabled AND c.automatic_assignments AND a.active AND l.assigned_agent_id=c.agent_id AND l.assigned_agent_id=${c.agent_id} FOR SHARE OF e,c`;
  if(!allowed)return {scheduled:0};
  const due=miaSundayFollowupDue(now,allowed.analysis?.action==='wait'?allowed.analysis.nextContactAt:null);
  await tx`UPDATE crm_mia_sales_jobs SET state='stopped',error='Reemplazado por seguimiento semanal los domingos a las 20:00 de Argentina.' WHERE lead_id=${e.lead_id} AND kind='followup' AND state IN('pending','blocked') AND (source_key LIKE 'followup:%' OR (source_key LIKE 'weekly-sunday:%' AND due_at<${due}::timestamptz))`;
  const uncertain=await tx`SELECT id FROM crm_mia_sales_jobs WHERE lead_id=${e.lead_id} AND run_id=${c.run_id} AND kind='followup' AND state IN('sending','review') LIMIT 1`;
  if(uncertain.length)return {scheduled:0};
  let scheduled=0;
  for(const channel of ['email','whatsapp']){
   const rows=await tx`INSERT INTO crm_mia_sales_jobs(id,run_id,lead_id,channel,kind,source_key,subject,content,due_at,followup_anchor_at) VALUES(${randomUUID()},${c.run_id},${e.lead_id},${channel},'followup',${'weekly-sunday:'+c.run_id+':'+e.lead_id+':'+due+':'+channel},'Seguimos con tu búsqueda · Barrera Brokers','',${due}::timestamptz,${now.toISOString()}::timestamptz) ON CONFLICT(source_key) DO NOTHING RETURNING id`;
   scheduled+=rows.length;
  }
  return {scheduled,dueAt:due};
 });
}
