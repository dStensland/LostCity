-- ============================================================
-- MIGRATION 489: Add share_token to plans for activation loop
-- ============================================================

ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE
    DEFAULT encode(gen_random_bytes(12), 'hex');

UPDATE plans
SET share_token = encode(gen_random_bytes(12), 'hex')
WHERE share_token IS NULL;

ALTER TABLE plans
  ALTER COLUMN share_token SET NOT NULL;
