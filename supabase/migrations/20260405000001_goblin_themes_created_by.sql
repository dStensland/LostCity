-- Add missing created_by column to goblin_themes.
-- The POST /api/goblinday/sessions/[id]/themes route has always written
-- created_by, but the column was never created in the original migration
-- (20260325500000_goblin_sessions.sql).  Inserts have been failing with a
-- "column does not exist" error.

ALTER TABLE goblin_themes
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);
