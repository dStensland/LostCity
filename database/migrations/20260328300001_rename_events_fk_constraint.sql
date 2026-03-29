-- Fix: PostgreSQL does NOT auto-rename FK constraints when columns are renamed.
-- The constraint is still events_venue_id_fkey but code references events_place_id_fkey.
ALTER TABLE events RENAME CONSTRAINT events_venue_id_fkey TO events_place_id_fkey;
