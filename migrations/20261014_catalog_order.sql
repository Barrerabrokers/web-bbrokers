ALTER TABLE properties ADD COLUMN IF NOT EXISTS sort_order INTEGER;
ALTER TABLE developments ADD COLUMN IF NOT EXISTS sort_order INTEGER;

-- Preserve newest-first ordering initially; append new rows on later runs.
WITH ranked AS (
  SELECT id, (COALESCE((SELECT MAX(sort_order) FROM properties), -1) + ROW_NUMBER() OVER (ORDER BY created_at DESC, id ASC))::integer AS position
  FROM properties WHERE sort_order IS NULL
)
UPDATE properties p SET sort_order = r.position FROM ranked r WHERE p.id=r.id AND p.sort_order IS NULL;
WITH ranked AS (
  SELECT id, (COALESCE((SELECT MAX(sort_order) FROM developments), -1) + ROW_NUMBER() OVER (ORDER BY created_at DESC, id ASC))::integer AS position
  FROM developments WHERE sort_order IS NULL
)
UPDATE developments d SET sort_order = r.position FROM ranked r WHERE d.id=r.id AND d.sort_order IS NULL;
CREATE INDEX IF NOT EXISTS properties_catalog_order_idx ON properties(sort_order,created_at DESC,id);
CREATE INDEX IF NOT EXISTS developments_catalog_order_idx ON developments(sort_order,created_at DESC,id);
