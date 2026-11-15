-- Queue existing completed meetings once; do not alter the contact or agent outcome.
INSERT INTO crm_ai_events(lead_id,event_type,source,source_id,dedupe_key)
SELECT DISTINCT a.lead_id,'meeting_completed','initial_backfill',a.lead_id::text,
 'meeting-results-v4:'||a.lead_id::text
FROM crm_activities a JOIN crm_activity_results r ON r.activity_id=a.id
JOIN crm_leads l ON l.id=a.lead_id
WHERE a.type='reunion' AND r.outcome_status='completed' AND length(trim(r.outcome))>0
 AND COALESCE(a.scheduled_at,a.created_at)<=now()
 AND lower(btrim(COALESCE(l.status,''))) NOT IN
 ('vendido','perdido','no interesado','no califica','no interesado / no califica','closed_won','closed_lost')
ON CONFLICT(dedupe_key) DO NOTHING;
UPDATE crm_ai_state s SET attempts=0,retry_at=NULL
WHERE EXISTS(SELECT 1 FROM crm_ai_events e WHERE e.lead_id=s.lead_id
 AND e.dedupe_key='meeting-results-v4:'||s.lead_id::text AND e.processed_at IS NULL);
