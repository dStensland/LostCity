-- Migration: add first-class is_show flag for performance-oriented event filtering
--
-- Keep this file mirrored in database/migrations and supabase/migrations.
-- Update database/schema.sql in the same change set when schema changes are involved.

ALTER TABLE events
ADD COLUMN IF NOT EXISTS is_show BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN events.is_show IS
'True when the event is a booked performance/show worth planning around (concert, play, screening, comedy headliner). False for open-format nightlife, classes, exhibits, and non-show event types.';
