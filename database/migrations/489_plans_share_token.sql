-- ============================================================
-- MIGRATION 489: Add share_token to plans for activation loop
-- ============================================================
-- Enables the plan sharing flow:
--   create plan → share link → cold visitor sees value → signs up
--
-- share_token is auto-generated on insert, serves as the
-- public URL key (token IS the authorization for unauthenticated
-- access, same pattern as itineraries.share_token).
-- ============================================================

-- Add share_token column with default generation
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE
    DEFAULT encode(gen_random_bytes(12), 'hex');

-- Backfill existing plans that have NULL share_token
UPDATE plans
SET share_token = encode(gen_random_bytes(12), 'hex')
WHERE share_token IS NULL;

-- Make NOT NULL after backfill
ALTER TABLE plans
  ALTER COLUMN share_token SET NOT NULL;
