import postgres from 'postgres';
import { z } from 'zod';
export const filtersSchema=z.object({
 category:z.enum(['all','hot','waiting','followup','visit','risk','reactivate','advancing']).default('all'),
 page:z.coerce.number().int().min(0).max(100000).default(0),
 query:z.string().max(160).default(''),owner:z.string().max(160).default(''),status:z.string().max(40).default(''),
 score:z.coerce.number().min(0).max(100).default(0),intent:z.coerce.number().min(0).max(100).default(0),urgency:z.coerce.number().min(0).max(100).default(0),
 source:z.string().max(160).default(''),campaign:z.string().max(160).default(''),development:z.string().max(160).default(''),zone:z.string().max(160).default(''),budget:z.string().max(160).default(''),country:z.string().max(160).default(''),language:z.string().max(160).default(''),
 lastBefore:z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/).default(''),followupBefore:z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/).default('')
});
export type SalesFilters=z.infer<typeof filtersSchema>;
export function aiDb(){
 const url=process.env.POSTGRES_PRISMA_URL||process.env.POSTGRES_URL||process.env.DATABASE_URL;
 if(!url)throw new Error('AI_DATABASE_UNAVAILABLE');
 return postgres(url,{ssl:'require',max:1,prepare:false,connect_timeout:10});
}
export type Actor={id:string;all:boolean};
// Use the CRM pipeline (not the AI's inferred status) for the requested order.
export function salesPipelinePriority(sql:ReturnType<typeof aiDb>){
 return sql`CASE lower(btrim(COALESCE(l.status,'')))
   WHEN 'interesado' THEN 0 WHEN 'interesados' THEN 0
   WHEN 'en curso' THEN 1
   WHEN 'contactado' THEN 2 WHEN 'contactados' THEN 2 ELSE 3 END`;
}
export async function readSales(actor:Actor,leadId?:string,filters=filtersSchema.parse({})){
 const sql=aiDb();
 try{
  const [ready]=await sql`SELECT to_regclass('public.crm_ai_state') IS NOT NULL AS ready`;
  if(!ready.ready)return {ready:false,leads:[],feed:[],recommendations:[],team:[],pending:0};
  const f=filters;
  const scope=sql`(${actor.all} OR l.assigned_agent_id=${actor.id}) AND (${leadId||null}::uuid IS NULL OR l.id=${leadId||null}::uuid)`;
  const where=sql`${scope}
    AND (${f.query}='' OR concat_ws(' ',l.first_name,l.last_name,l.source,l.development_name_text,s.analysis->'semantic'->'preferences') ILIKE ${'%'+f.query+'%'})
    AND (${f.owner}='' OR ag.name=${f.owner}) AND (${f.status}='' OR s.ai_status=${f.status})
    AND COALESCE(s.ai_score,0)>=${f.score} AND COALESCE((s.analysis->'semantic'->>'intent')::numeric,0)>=${f.intent}
    AND COALESCE((s.analysis->'semantic'->>'urgency')::numeric,0)>=${f.urgency}
    AND (${f.source}='' OR l.source ILIKE ${'%'+f.source+'%'})
    AND (${f.campaign}='' OR l.meta_properties::text ILIKE ${'%'+f.campaign+'%'})
    AND (${f.development}='' OR concat_ws(' ',l.development_name_text,d.name) ILIKE ${'%'+f.development+'%'})
    AND (${f.zone}='' OR s.analysis->'semantic'->'preferences'->>'zone' ILIKE ${'%'+f.zone+'%'})
    AND (${f.budget}='' OR s.analysis->'semantic'->'preferences'->>'budget' ILIKE ${'%'+f.budget+'%'})
    AND (${f.country}='' OR s.analysis->'semantic'->'preferences'->>'country' ILIKE ${'%'+f.country+'%'})
    AND (${f.language}='' OR s.analysis->'semantic'->'preferences'->>'language' ILIKE ${'%'+f.language+'%'})
    AND (${f.lastBefore}='' OR s.analysis->'signals'->>'lastContact'<${f.lastBefore+'T23:59:59'})
    AND (${f.followupBefore}='' OR s.next_followup_at::text<${f.followupBefore+' 23:59:59'})`;
  const active=sql`COALESCE(s.ai_status,'NEW') NOT IN ('CLOSED_WON','LOST')`;
  const actionable=sql`(s.last_analyzed_at IS NULL OR EXISTS(SELECT 1 FROM crm_ai_recommendations ar WHERE ar.lead_id=l.id AND (ar.status='pending' OR (ar.status='snoozed' AND ar.snoozed_until<=now()))))`;
  const conditions={all:sql`${active} AND ${actionable}`,hot:sql`${active} AND s.ai_score>=80`,waiting:sql`${active} AND s.ai_status='WAITING_AGENT'`,followup:sql`${active} AND ${actionable} AND s.next_followup_at<now()`,
    visit:sql`${active} AND s.analysis->>'visitFollowup'='true'`,risk:sql`${active} AND s.analysis->>'risk'='true'`,reactivate:sql`${active} AND s.analysis->>'reactivate'='true'`,advancing:sql`${active} AND s.ai_status IN ('HIGH_INTENT','VISIT_READY','NEGOTIATING')`};
  const joins=sql`FROM crm_leads l LEFT JOIN crm_ai_state s ON s.lead_id=l.id LEFT JOIN agents ag ON ag.id=l.assigned_agent_id LEFT JOIN developments d ON d.id=l.development_id`;
  const [counts]=await sql`SELECT COUNT(*) FILTER(WHERE ${conditions.all})::int AS all,COUNT(*) FILTER(WHERE ${conditions.hot})::int AS hot,
    COUNT(*) FILTER(WHERE ${conditions.waiting})::int AS waiting,COUNT(*) FILTER(WHERE ${conditions.followup})::int AS followup,
    COUNT(*) FILTER(WHERE ${conditions.visit})::int AS visit,COUNT(*) FILTER(WHERE ${conditions.risk})::int AS risk,
    COUNT(*) FILTER(WHERE ${conditions.reactivate})::int AS reactivate,COUNT(*) FILTER(WHERE ${conditions.advancing})::int AS advancing ${joins} WHERE ${where}`;
  const leads=await sql`SELECT l.id,l.created_at,l.first_name,l.last_name,l.source,l.status AS pipeline,l.assigned_agent_id,
    ag.name AS agent,l.development_name_text AS development,s.ai_score,s.ai_status,s.analysis,s.last_analyzed_at,s.next_followup_at,s.last_error,
    s.retry_at,s.attempts,
    EXISTS(SELECT 1 FROM crm_ai_events e WHERE e.lead_id=l.id AND e.processed_at IS NULL AND e.source='manual') AS manual_pending,
    CASE WHEN s.lease_until>now() THEN 'processing'
      WHEN EXISTS(SELECT 1 FROM crm_ai_events e WHERE e.lead_id=l.id AND e.processed_at IS NULL) THEN
        CASE WHEN s.attempts>=5 THEN 'failed' WHEN s.retry_at>now() THEN 'retry' ELSE 'pending' END
      WHEN s.last_analyzed_at IS NOT NULL THEN 'updated' ELSE 'pending' END AS analysis_state
    ${joins} WHERE ${where} AND (${Boolean(leadId)} OR ${conditions[f.category]})
    ORDER BY CASE WHEN s.last_analyzed_at IS NOT NULL THEN s.ai_score END DESC NULLS LAST,
      ${salesPipelinePriority(sql)},l.created_at DESC NULLS LAST,l.id DESC LIMIT 50 OFFSET ${leadId?0:f.page*50}`;
  const feed=await sql`SELECT h.*,l.first_name,l.last_name FROM crm_ai_history h JOIN crm_leads l ON l.id=h.lead_id
    WHERE (${actor.all} OR l.assigned_agent_id=${actor.id}) AND (${leadId||null}::uuid IS NULL OR l.id=${leadId||null}::uuid) ORDER BY h.created_at DESC LIMIT 60`;
  const recommendations=await sql`SELECT r.* FROM crm_ai_recommendations r JOIN crm_leads l ON l.id=r.lead_id
    WHERE (${actor.all} OR l.assigned_agent_id=${actor.id}) AND l.id=ANY(${leads.map(l=>l.id)}::uuid[])
    AND (r.status='pending' OR (r.status='snoozed' AND r.snoozed_until<=now())) ORDER BY r.due_at ASC NULLS LAST`;
  const team=actor.all?await sql`SELECT a.id,a.name,COUNT(l.id)::int AS leads,
    COUNT(l.id) FILTER(WHERE s.ai_score>=80 AND s.ai_status NOT IN ('CLOSED_WON','LOST'))::int AS hot,
    COUNT(l.id) FILTER(WHERE s.ai_status='WAITING_AGENT')::int AS waiting,
    COUNT(l.id) FILTER(WHERE s.next_followup_at<now() AND s.ai_status NOT IN ('CLOSED_WON','LOST'))::int AS overdue,
    COUNT(l.id) FILTER(WHERE s.last_analyzed_at IS NOT NULL AND s.analysis->'signals'->>'lastContact' IS NULL)::int AS no_activity,
    COUNT(l.id) FILTER(WHERE s.analysis->'signals'->>'visitAt' IS NOT NULL)::int AS visited,
    COUNT(l.id) FILTER(WHERE s.ai_status IN ('ACTIVE','HIGH_INTENT','VISIT_READY','NEGOTIATING'))::int AS active
    FROM agents a LEFT JOIN crm_leads l ON l.assigned_agent_id=a.id LEFT JOIN crm_ai_state s ON s.lead_id=l.id
    WHERE a.active=true GROUP BY a.id,a.name ORDER BY a.name`:[];
  const [pending]=await sql`SELECT COUNT(DISTINCT e.lead_id)::int AS count FROM crm_ai_events e JOIN crm_leads l ON l.id=e.lead_id WHERE e.processed_at IS NULL AND (${actor.all} OR l.assigned_agent_id=${actor.id})`;
  const owners=await sql`SELECT DISTINCT ag.name ${joins} WHERE ${scope} AND ag.name IS NOT NULL ORDER BY ag.name`;
  return {ready:true,enabled:process.env.AI_SALES_ENABLED==='true',leads,feed,recommendations,team,pending:pending.count,counts,total:leadId?leads.length:counts[f.category],owners:owners.map(a=>a.name)};
 }finally{await sql.end();}
}
