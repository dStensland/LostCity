-- Migration: add festival_type to festivals for conference labeling

ALTER TABLE festivals
  ADD COLUMN IF NOT EXISTS festival_type TEXT;

UPDATE festivals
SET festival_type = 'festival'
WHERE festival_type IS NULL;

ALTER TABLE festivals
  ALTER COLUMN festival_type SET DEFAULT 'festival';
