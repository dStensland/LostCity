-- Migration: Venue Destination Details
--
-- Keep this file mirrored in database/migrations and supabase/migrations.
-- Update database/schema.sql in the same change set when schema changes are involved.

-- Phase F: Venue destination details — extension table for Adventure portal.
-- 1:1 relationship with venues table. PK is the venue_id FK.

CREATE TABLE IF NOT EXISTS venue_destination_details (
  venue_id INTEGER PRIMARY KEY REFERENCES venues(id) ON DELETE CASCADE,
  commitment_level TEXT CHECK (commitment_level IN ('hour','halfday','fullday','weekend')),
  difficulty TEXT CHECK (difficulty IN ('easy','moderate','challenging','expert')),
  trail_length_miles NUMERIC,
  conditions_notes TEXT,
  accessibility_notes TEXT,
  parking_type TEXT CHECK (parking_type IN ('free_lot','paid_lot','street','garage','none')),
  parking_capacity INTEGER,
  seasonal_availability TEXT[],
  best_time_of_day TEXT CHECK (best_time_of_day IN ('morning','afternoon','evening','any')),
  dog_friendly BOOLEAN,
  kid_friendly BOOLEAN,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger
DROP TRIGGER IF EXISTS update_venue_destination_details_updated_at ON venue_destination_details;
CREATE TRIGGER update_venue_destination_details_updated_at
  BEFORE UPDATE ON venue_destination_details
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- No RLS needed — venues table handles access control.
-- No separate indexes needed — PK covers the primary lookup.
