-- Additive queue schema; does not alter leads or credentials.
-- Runtime bootstrap in lib/meta-recovery-store.ts mirrors this migration.
BEGIN;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '3s';
SELECT pg_advisory_xact_lock(1296389185, 1);
CREATE TABLE IF NOT EXISTS public.crm_meta_recovery_jobs (
  id UUID PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'queued'
    CONSTRAINT crm_meta_recovery_status CHECK (status IN ('queued','running','complete','partial','failed')),
  created_by TEXT,
  since_at TIMESTAMPTZ NOT NULL,
  until_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  state JSONB,
  lease_token UUID,
  lease_until TIMESTAMPTZ,
  CONSTRAINT crm_meta_recovery_window CHECK (since_at = until_at - interval '720 hours'),
  CONSTRAINT crm_meta_recovery_object CHECK (state IS NULL OR jsonb_typeof(state) = 'object'),
  CONSTRAINT crm_meta_recovery_lease_pair CHECK ((lease_token IS NULL) = (lease_until IS NULL)),
  CONSTRAINT crm_meta_recovery_terminal_lease CHECK (status IN ('queued','running') OR lease_token IS NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS crm_meta_recovery_one_active
  ON public.crm_meta_recovery_jobs ((true)) WHERE status IN ('queued','running');
CREATE INDEX IF NOT EXISTS crm_meta_recovery_latest
  ON public.crm_meta_recovery_jobs (created_at DESC, id DESC);
ALTER TABLE public.crm_meta_recovery_jobs ENABLE ROW LEVEL SECURITY;
COMMIT;
