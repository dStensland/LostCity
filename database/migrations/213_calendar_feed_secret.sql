-- Add per-user feed secret so calendar feed links can be rotated/revoked.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS calendar_feed_secret TEXT;

-- Backfill existing users.
UPDATE profiles
SET calendar_feed_secret = encode(gen_random_bytes(24), 'hex')
WHERE calendar_feed_secret IS NULL;

-- Enforce presence for new and existing rows.
ALTER TABLE profiles
  ALTER COLUMN calendar_feed_secret SET NOT NULL;

COMMENT ON COLUMN profiles.calendar_feed_secret IS
  'Per-user secret used to sign calendar feed tokens. Rotate to revoke leaked feed URLs.';
