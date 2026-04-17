-- Add freeform guest names for attendees who aren't app users
ALTER TABLE goblin_sessions
  ADD COLUMN IF NOT EXISTS guest_names text[] DEFAULT '{}';
