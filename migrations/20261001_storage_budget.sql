CREATE TABLE IF NOT EXISTS storage_upload_reservations (
  path TEXT PRIMARY KEY, bytes BIGINT NOT NULL CHECK(bytes>0),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS storage_upload_reservations_expiry ON storage_upload_reservations(expires_at);
ALTER TABLE storage_upload_reservations ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS database_worker_leases (
  worker_key TEXT PRIMARY KEY, owner UUID NOT NULL, lease_until TIMESTAMPTZ NOT NULL
);
ALTER TABLE database_worker_leases ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_crm_activities_type_schedule ON crm_activities(type,scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_email_trackings_first_open ON crm_email_trackings(first_opened_at) WHERE first_opened_at IS NOT NULL;
