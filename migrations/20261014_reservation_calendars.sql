-- Apply before deploying reservation signatures.
CREATE TABLE IF NOT EXISTS crm_reservation_calendars (
  id UUID PRIMARY KEY, activity_id UUID REFERENCES crm_activities(id) ON DELETE SET NULL,
  recipient_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL, synced_version TEXT, checked_at TIMESTAMPTZ, last_error TEXT,
  UNIQUE(activity_id, recipient_id)
);
ALTER TABLE crm_reservation_calendars ENABLE ROW LEVEL SECURITY;
