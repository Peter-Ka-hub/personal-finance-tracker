ALTER TABLE categories."Categories" ADD COLUMN IF NOT EXISTS "archivedAt" timestamptz;
SELECT pg_temp.require_core(false);
SELECT pg_temp.require_features(true, true);
