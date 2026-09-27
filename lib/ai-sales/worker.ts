import { createHash, randomUUID } from 'crypto';
import { aiDb,salesPipelinePriority } from './store';
import { AIProviderError,calculateScore,provider, type Signals } from './model';
import { getSalesEvidence } from '@/lib/crm-sales-context';

export async function processSales({liveOnly=false}:{liveOnly?:boolean}={}){
 if(process.env.AI_SALES_ENABLED!=='true')return {enabled:false,processed:0};
 const ai=provider(), sql=aiDb(), deadline=Date.now()+(liveOnly?45000:220000),runToken=randomUUID();
 let processed=0,failed=0,budgetLimited=false,modelCalls=0;
 const dailyLimit=Math.min(1000,Math.max(1,Number(process.env.AI_SALES_DAILY_LIMIT)||200));
 // Conservative default for the current provider quota. Time-only reviews remain batched.
 const modelLimit=Math.min(20,Math.max(1,Number(process.env.AI_SALES_MODEL_CALLS_PER_RUN)||1));
 try{
  const gate=await sql`UPDATE crm_ai_control SET lease_token=${runToken},lease_until=now()+interval '4 minutes'
    WHERE id=1 AND (lease_until IS NULL OR lease_until<now()) RETURNING id`;
  if(!gate.length)return {enabled:true,processed:0,busy:true};
  const [tables]=await sql`SELECT to_regclass('public.crm_notifications') IS NOT NULL AS notifications`;
  await sql`INSERT INTO crm_ai_state(lead_id) SELECT DISTINCT lead_id FROM crm_ai_events WHERE processed_at IS NULL ON CONFLICT DO NOTHING`;
  // Time-based review is coalesced and uses saved semantic analysis, not a new model request.
  await sql`INSERT INTO crm_ai_events(lead_id,event_type,source,source_id,dedupe_key)
    SELECT s.lead_id,'followup_due','scheduler',s.lead_id::text,'review:'||s.lead_id::text||':'||date_trunc('hour',now())::text
    FROM crm_ai_state s WHERE s.next_review_at<=now() AND s.last_analyzed_at IS NOT NULL
    AND s.ai_status NOT IN ('CLOSED_WON','LOST') AND NOT EXISTS(SELECT 1 FROM crm_ai_events e WHERE e.lead_id=s.lead_id AND e.processed_at IS NULL)
    ORDER BY s.next_review_at LIMIT 500 ON CONFLICT(dedupe_key) DO NOTHING`;
  while(Date.now()<deadline&&processed+failed<20){
   const token=randomUUID();
   const [job]=await sql`UPDATE crm_ai_state SET lease_token=${token},lease_until=now()+interval '5 minutes'
     WHERE lead_id=(SELECT s.lead_id FROM crm_ai_state s JOIN crm_leads l ON l.id=s.lead_id WHERE (s.lease_until IS NULL OR s.lease_until<now())
       AND s.attempts<5 AND (s.retry_at IS NULL OR s.retry_at<=now())
       AND EXISTS(SELECT 1 FROM crm_ai_events e WHERE e.lead_id=s.lead_id AND e.processed_at IS NULL)
       AND (NOT ${liveOnly} OR EXISTS(SELECT 1 FROM crm_ai_events e WHERE e.lead_id=s.lead_id AND e.processed_at IS NULL AND e.source NOT IN ('initial_backfill','scheduler')))
       AND (EXISTS(SELECT 1 FROM crm_ai_events e WHERE e.lead_id=s.lead_id AND e.processed_at IS NULL AND e.source<>'initial_backfill')
         OR COALESCE((SELECT requests FROM crm_ai_usage WHERE day=CURRENT_DATE),0)<${Math.max(1,Math.floor(dailyLimit/4))})
       AND (NOT ${budgetLimited} OR EXISTS(SELECT 1 FROM crm_ai_events e WHERE e.lead_id=s.lead_id AND e.processed_at IS NULL AND e.event_type='followup_due'))
       ORDER BY CASE WHEN EXISTS(SELECT 1 FROM crm_ai_events e WHERE e.lead_id=s.lead_id AND e.processed_at IS NULL AND e.source NOT IN ('initial_backfill','scheduler')) THEN 0 ELSE 1 END,
       ${salesPipelinePriority(sql)},
       (SELECT MIN(e.id) FROM crm_ai_events e WHERE e.lead_id=s.lead_id AND e.processed_at IS NULL AND e.source NOT IN ('initial_backfill','scheduler')) ASC NULLS LAST,
       l.created_at DESC NULLS LAST,l.id DESC FOR UPDATE OF s SKIP LOCKED LIMIT 1) RETURNING *`;
   if(!job)break;
   try{
    const captured=await sql`SELECT id,event_type FROM crm_ai_events WHERE lead_id=${job.lead_id} AND processed_at IS NULL ORDER BY id`;
    const events=await sql`SELECT * FROM crm_ai_events WHERE id=ANY(${captured.map(e=>e.id)}::bigint[]) ORDER BY id DESC LIMIT 12`;
    const [lead]=await sql`SELECT l.*,d.name AS development_name FROM crm_leads l LEFT JOIN developments d ON d.id=l.development_id WHERE l.id=${job.lead_id}`;
    if(!lead)throw new Error('LEAD_MISSING');
    // Count the entire CRM history: the recent conversation window may omit older calls.
    const [callTotals]=await sql`SELECT COUNT(*)::int AS count FROM crm_activities WHERE lead_id=${lead.id} AND type='llamada'`;
    const lastCalls=await sql`SELECT id,title,LEFT(body,1800) AS body,created_at,scheduled_at FROM crm_activities
      WHERE lead_id=${lead.id} AND type='llamada' ORDER BY created_at DESC,id DESC LIMIT 3`;
    const [evidence]=await getSalesEvidence([lead.id],lead.assigned_agent_id||randomUUID(),true,true);
    const [mail]=await sql`SELECT COUNT(*) FILTER(WHERE event_type='email_clicked' AND created_at>now()-interval '30 days')::int AS clicks,
      COUNT(*) FILTER(WHERE event_type='email_opened' AND created_at>now()-interval '30 days')::int AS opens FROM crm_ai_events WHERE lead_id=${lead.id}`;
    const inventory=await sql`SELECT id,name,LEFT(to_jsonb(d)->>'description',800) AS description,
      to_jsonb(d)->>'location' AS location,to_jsonb(d)->>'address' AS address,
      COALESCE(to_jsonb(d)->>'price_from',to_jsonb(d)->>'priceFrom') AS price_from,
      to_jsonb(d)->>'currency' AS currency,to_jsonb(d)->>'status' AS status
      FROM developments d ORDER BY name LIMIT 80`;
    const feedback=await sql`SELECT f.action,r.title FROM crm_ai_feedback f JOIN crm_ai_recommendations r ON r.id=f.recommendation_id WHERE r.lead_id=${lead.id} ORDER BY f.created_at DESC LIMIT 10`;
    const recent=evidence.events.filter(e=>Date.parse(e.fecha)>Date.now()-30*86400000);
    const [hasResults]=await sql`SELECT to_regclass('public.crm_activity_results') IS NOT NULL AS ready`;
    const visits=hasResults.ready?await sql`SELECT a.id,COALESCE(a.scheduled_at,r.updated_at,a.created_at) AS happened_at
      FROM crm_activities a JOIN crm_activity_results r ON r.activity_id=a.id
      WHERE a.lead_id=${lead.id} AND a.type='reunion' AND a.title ~* 'visita'
      AND r.outcome_status='completed' AND length(trim(r.outcome))>0
      AND COALESCE(a.scheduled_at,r.updated_at,a.created_at)<=now()
      ORDER BY happened_at DESC LIMIT 1`:[];
    const visit=visits[0];
    const signals:Signals={lastInbound:evidence.lastInbound||null,lastOutbound:evidence.lastOutbound||null,lastContact:evidence.lastContact||null,
      inboundCount:recent.filter(e=>e.direccion==='inbound').length,clicks:mail.clicks,opens:mail.opens,createdAt:new Date(lead.created_at).toISOString(),pipeline:lead.status,
      completedVisit:Boolean(visit&&(!evidence.lastOutbound||Date.parse(evidence.lastOutbound)<+new Date(visit.happened_at))),
      visitAt:visit?new Date(visit.happened_at).toISOString():null};
    const timerOnly=captured.every(e=>e.event_type==='followup_due')&&job.analysis?.semantic&&job.model_version===ai.version;
    const context={now:new Date().toISOString(),lead:{id:'lead',name:lead.first_name,status:lead.status,source:lead.source,hasEmail:Boolean(lead.email),hasPhone:Boolean(lead.phone),phoneCountryCode:lead.country_code,development:lead.development_name||lead.development_name_text,
       notes:(lead.notes||'').slice(0,8000),forms:JSON.stringify(lead.meta_properties||{}).slice(0,12000),imported:JSON.stringify(lead.hubspot_properties||{}).slice(0,12000)},
       callHistory:{count:callTotals.count,lastCalls},
       previous:job.analysis?.semantic||null,events:events.map(e=>({id:String(e.id),type:e.event_type,data:{...e.event_data,body:(e.event_data?.body||'').slice(0,1800)}})),
       history:evidence.events.slice(0,job.last_analyzed_at?12:30),historyTruncated:evidence.total>(job.last_analyzed_at?12:30),upcoming:evidence.next.filter(e=>!e.resultado).slice(0,10),signals,inventory,feedback};
    if(!timerOnly){
      const slot=await sql`UPDATE crm_ai_control SET next_model_at=now()+interval '60 seconds' WHERE id=1 AND lease_token=${runToken} AND next_model_at<=now() RETURNING id`;
      if(!slot.length){await sql`UPDATE crm_ai_state SET lease_token=NULL,lease_until=NULL WHERE lead_id=${lead.id} AND lease_token=${token}`;break;}
      if(modelCalls>=modelLimit){
        await sql`UPDATE crm_ai_state SET lease_token=NULL,lease_until=NULL WHERE lead_id=${lead.id} AND lease_token=${token}`;
        break;
      }
      const usage=await sql`INSERT INTO crm_ai_usage(day,requests) VALUES(CURRENT_DATE,1)
        ON CONFLICT(day) DO UPDATE SET requests=crm_ai_usage.requests+1 WHERE crm_ai_usage.requests<${dailyLimit} RETURNING requests`;
      if(!usage.length){
        budgetLimited=true;
        await sql`UPDATE crm_ai_state SET lease_token=NULL,lease_until=NULL WHERE lead_id=${lead.id} AND lease_token=${token}`;
        // New semantic work waits for tomorrow; time-only reviews remain available.
        await sql`UPDATE crm_ai_state SET retry_at=date_trunc('day',now())+interval '1 day' WHERE lead_id=${lead.id}`;
        continue;
      }
      modelCalls++;
    }
    const semantic=timerOnly?job.analysis.semantic:await ai.analyze({...context,compactRetry:job.attempts>0});
    const allowed=new Set(['lead',...events.map(e=>String(e.id)),...evidence.events.map(e=>e.id),...(job.analysis?.semantic?.confirmed||[]).map((f:{evidenceId:string})=>f.evidenceId)]);
    semantic.confirmed=semantic.confirmed.filter((f:{evidenceId:string})=>allowed.has(f.evidenceId));
    semantic.propertyMatches=semantic.propertyMatches.filter((p:{id:string})=>inventory.some(d=>d.id===p.id));
    const calculated=calculateScore(semantic,signals);
    const fingerprint=createHash('sha256').update(JSON.stringify([calculated.status,calculated.nextAction,signals.lastInbound,signals.lastOutbound,lead.status])).digest('hex');
    const snapshot={semantic,signals,...calculated};
    await sql.begin(async tx=>{
     const [locked]=await tx`SELECT lease_token FROM crm_ai_state WHERE lead_id=${lead.id} FOR UPDATE`;
     if(locked?.lease_token!==token)throw new Error('LEASE_LOST');
     await tx`UPDATE crm_ai_state SET ai_score=${calculated.score},ai_status=${calculated.status},summary=${semantic.summary},analysis=${tx.json(snapshot)},
       next_followup_at=${calculated.closed?null:calculated.due},last_analyzed_at=now(),model_version=${ai.version},next_review_at=now()+interval '30 minutes',
       updated_at=now(),attempts=0,last_error=NULL,retry_at=NULL,lease_token=NULL,lease_until=NULL WHERE lead_id=${lead.id}`;
     await tx`UPDATE crm_ai_recommendations SET status='superseded',updated_at=now() WHERE lead_id=${lead.id} AND status IN ('pending','snoozed') AND (fingerprint<>${fingerprint} OR ${calculated.closed})`;
     if(!calculated.closed){
      await tx`INSERT INTO crm_ai_recommendations(lead_id,assigned_agent_id,fingerprint,priority,title,reasoning,confidence,suggested_message,due_at)
        VALUES(${lead.id},${lead.assigned_agent_id},${fingerprint},${calculated.alert},${calculated.nextAction},${semantic.reasoning.join('\n')},${semantic.confidence},${semantic.suggestedMessage},${calculated.due})
        ON CONFLICT(lead_id,fingerprint) DO UPDATE SET assigned_agent_id=EXCLUDED.assigned_agent_id,priority=EXCLUDED.priority,reasoning=EXCLUDED.reasoning,confidence=EXCLUDED.confidence,suggested_message=EXCLUDED.suggested_message,due_at=EXCLUDED.due_at,updated_at=now()`;
     }
     if(job.ai_score!==calculated.score||job.ai_status!==calculated.status||!timerOnly){
       await tx`INSERT INTO crm_ai_history(lead_id,previous_score,score,previous_status,status,reasoning,snapshot)
         VALUES(${lead.id},${job.last_analyzed_at?job.ai_score:null},${calculated.score},${job.last_analyzed_at?job.ai_status:null},${calculated.status},${semantic.reasoning.join('\n')},${tx.json(snapshot)})`;
     }
     // Internal bell only. No email, WhatsApp or push delivery. Read current ownership.
     if(tables.notifications&&!calculated.closed&&['HIGH','CRITICAL'].includes(calculated.alert)&&events.some(e=>e.source!=='initial_backfill')){
       await tx`INSERT INTO crm_notifications(id,recipient_agent_id,lead_id,event_key,type,title,body,href)
         SELECT gen_random_uuid(),l.assigned_agent_id,l.id,${'ai-sales:'+fingerprint+':'+calculated.alert},'ai_sales',
           ${'AI Sales · '+calculated.nextAction},${semantic.reasoning.join('\n')},${'/admin/crm/'+lead.id+'#ai-sales'}
         FROM crm_leads l WHERE l.id=${lead.id} AND l.assigned_agent_id IS NOT NULL
           AND EXISTS(SELECT 1 FROM crm_ai_recommendations r WHERE r.lead_id=l.id AND r.fingerprint=${fingerprint} AND r.status='pending')
         ON CONFLICT(event_key) DO NOTHING`;
     }
     await tx`UPDATE crm_ai_events SET processed_at=now() WHERE id=ANY(${captured.map(e=>e.id)}::bigint[])`;
    });
    processed++;
   }catch(error){
    failed++;
    const providerFailure=error instanceof AIProviderError;
    if(providerFailure&&[401,403,429,500,502,503,504].includes(error.status))await sql`UPDATE crm_ai_control SET next_model_at=GREATEST(next_model_at,now()+make_interval(secs=>${error.retrySeconds})) WHERE id=1 AND lease_token=${runToken}`;
    const reason=providerFailure?`Proveedor IA: ${error.status} (${error.providerCode}). Se reintentará sin perder los datos anteriores.`:'No se completó el análisis. Se conservaron los datos anteriores.';
    await sql`UPDATE crm_ai_state SET attempts=attempts+1,last_error=${reason},
      retry_at=now()+make_interval(secs=>${providerFailure?error.retrySeconds:300})*(attempts+1),lease_token=NULL,lease_until=NULL WHERE lead_id=${job.lead_id} AND lease_token=${token}`;
    console.error('AI Sales analysis failed',providerFailure?error.message:error && typeof error==='object' && 'name' in error ? error.name : 'UnknownError');
    // Authentication, quota and provider outages affect the whole batch, not just this lead.
    if(providerFailure&&[401,403,429,500,502,503,504].includes(error.status))break;
   }
  }
  return {enabled:true,processed,failed,budgetLimited,modelCalls};
 }finally{try{await sql`UPDATE crm_ai_control SET lease_token=NULL,lease_until=NULL WHERE id=1 AND lease_token=${runToken}`;}finally{await sql.end();}}
}
