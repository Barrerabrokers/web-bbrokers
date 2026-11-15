import type { aiDb } from './store';

// Continue analysis after a meeting even when the CRM pipeline has moved forward.
export function salesMeetingEligibility(sql:ReturnType<typeof aiDb>,hasResults:boolean){
 const attended=hasResults?sql`EXISTS(SELECT 1 FROM crm_activities a JOIN crm_activity_results r ON r.activity_id=a.id
   WHERE a.lead_id=l.id AND a.type='reunion' AND r.outcome_status='completed'
   AND length(trim(r.outcome))>0 AND COALESCE(a.scheduled_at,a.created_at)<=now())`:sql`false`;
 return sql`(lower(btrim(COALESCE(l.status,''))) IN ('interesado','interesados','reunion','reunión')
   OR (lower(btrim(COALESCE(l.status,''))) NOT IN
     ('vendido','perdido','no interesado','no califica','no interesado / no califica','closed_won','closed_lost') AND ${attended}))`;
}
