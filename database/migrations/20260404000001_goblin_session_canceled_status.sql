-- Allow 'canceled' status for goblin sessions.
-- The CHECK constraint from 20260326300000 only permitted ('planning', 'live', 'ended').
-- The API route and UI already treat 'canceled' as valid, but the DB rejected it.

ALTER TABLE goblin_sessions
  DROP CONSTRAINT IF EXISTS goblin_sessions_status_check;

ALTER TABLE goblin_sessions
  ADD CONSTRAINT goblin_sessions_status_check
    CHECK (status IN ('planning', 'live', 'ended', 'canceled'));
