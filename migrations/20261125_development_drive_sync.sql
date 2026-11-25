-- Source-backed inventory sync. Server-only: no browser roles can read snapshots.
CREATE TABLE IF NOT EXISTS development_drive_sync (
 slug text PRIMARY KEY,
 development_id uuid NOT NULL REFERENCES developments(id),
 enabled boolean NOT NULL DEFAULT false,
 source_url text NOT NULL,
 assets jsonb NOT NULL DEFAULT '{}'::jsonb,
 last_success timestamptz,
 last_hash text
);
CREATE TABLE IF NOT EXISTS development_drive_sync_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 development_id uuid NOT NULL REFERENCES developments(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 source_hash text NOT NULL,
 snapshot jsonb NOT NULL,
 source_rows jsonb NOT NULL
);
ALTER TABLE development_drive_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE development_drive_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS development_drive_sync_runs_development_created ON development_drive_sync_runs(development_id,created_at DESC);
