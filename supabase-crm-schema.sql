-- Ejecutar una sola vez en Supabase SQL Editor.
-- El servidor no ejecuta DDL durante las solicitudes del CRM.

CREATE TABLE IF NOT EXISTS crm_leads (
  id UUID PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  country_code TEXT DEFAULT '+54',
  phone TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'nuevo',
  temperature TEXT DEFAULT '',
  source TEXT DEFAULT '',
  development_id UUID NULL,
  development_name_text TEXT DEFAULT '',
  assigned_agent_id UUID NULL REFERENCES agents(id) ON DELETE SET NULL,
  notes TEXT DEFAULT '',
  hubspot_object_id TEXT NULL,
  hubspot_properties JSONB DEFAULT '{}'::jsonb,
  meta_lead_id TEXT NULL,
  meta_form_id TEXT NULL,
  meta_page_id TEXT NULL,
  meta_properties JSONB DEFAULT '{}'::jsonb,
  created_by UUID NULL REFERENCES agents(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_leads_email_unique ON crm_leads (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_leads_hubspot_object_id ON crm_leads (hubspot_object_id) WHERE hubspot_object_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_leads_meta_lead_id ON crm_leads (meta_lead_id) WHERE meta_lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_leads_status ON crm_leads(status);
CREATE INDEX IF NOT EXISTS idx_crm_leads_assigned_agent ON crm_leads(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_updated_at ON crm_leads(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_leads_created_at ON crm_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_leads_agent_created_at ON crm_leads(assigned_agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_leads_agent_status_created_at ON crm_leads(assigned_agent_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS crm_activities (
  id UUID PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  scheduled_at TIMESTAMPTZ NULL,
  created_by UUID NULL REFERENCES agents(id) ON DELETE SET NULL,
  external_source TEXT NULL,
  external_id TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_activities_external_unique ON crm_activities (external_source, external_id) WHERE external_source IS NOT NULL AND external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_activities_lead_id ON crm_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_created_at ON crm_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_activities_lead_created_at ON crm_activities(lead_id, created_at DESC);
