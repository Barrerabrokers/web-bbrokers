CREATE TABLE IF NOT EXISTS crm_google_contact_sync (
  lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
  account_email TEXT NOT NULL CHECK (account_email IN ('pablo@barrerabrokers.com','martina@barrerabrokers.com')),
  resource_name TEXT,
  synced_version TEXT,
  create_pending BOOLEAN NOT NULL DEFAULT FALSE,
  checked_at TIMESTAMPTZ,
  last_error TEXT,
  PRIMARY KEY (lead_id, account_email)
);
ALTER TABLE crm_google_contact_sync ENABLE ROW LEVEL SECURITY;
