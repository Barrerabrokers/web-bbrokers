ALTER TABLE crm_push_subscriptions ADD COLUMN IF NOT EXISTS email_replies BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE crm_push_subscriptions ADD COLUMN IF NOT EXISTS last_processed_at TIMESTAMPTZ;
UPDATE crm_push_subscriptions SET meeting_minutes=60 WHERE meeting_minutes<>60;
ALTER TABLE crm_notifications ALTER COLUMN lead_id DROP NOT NULL;
ALTER TABLE crm_notifications ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE crm_notifications ADD COLUMN IF NOT EXISTS source_id UUID;
CREATE TABLE IF NOT EXISTS crm_device_notification_state (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK(id), enabled_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO crm_device_notification_state(id) VALUES(TRUE) ON CONFLICT DO NOTHING;
ALTER TABLE crm_device_notification_state ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS crm_email_inbox_checks (
  agent_id UUID PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()-INTERVAL '15 minutes'
);
ALTER TABLE crm_email_inbox_checks ENABLE ROW LEVEL SECURITY;
-- Keep delivery receipts when switching email openings to the web event key.
INSERT INTO crm_push_deliveries(subscription_id,event_key,sent_at,retry_at,attempts)
SELECT subscription_id,'email-'||event_key,sent_at,retry_at,attempts FROM crm_push_deliveries WHERE event_key LIKE 'open:%'
ON CONFLICT DO NOTHING;
