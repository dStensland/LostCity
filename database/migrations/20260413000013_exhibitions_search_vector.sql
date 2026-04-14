-- Migration: Exhibitions Search Vector
--
-- Keep this file mirrored in database/migrations and supabase/migrations.
-- Update database/schema.sql in the same change set when schema changes are involved.

-- Add tsvector search_vector column to exhibitions for unified search.

ALTER TABLE exhibitions ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE INDEX IF NOT EXISTS idx_exhibitions_search_vector
  ON exhibitions USING gin(search_vector)
  WHERE is_active = true;

-- Backfill existing rows
UPDATE exhibitions
SET search_vector = to_tsvector('simple',
  COALESCE(title, '') || ' ' ||
  COALESCE(description, '') || ' ' ||
  COALESCE(medium, '') || ' ' ||
  COALESCE(array_to_string(tags, ' '), '')
);

-- Trigger to keep search_vector updated on INSERT/UPDATE
CREATE OR REPLACE FUNCTION exhibitions_search_vector_trigger()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('simple',
    COALESCE(NEW.title, '') || ' ' ||
    COALESCE(NEW.description, '') || ' ' ||
    COALESCE(NEW.medium, '') || ' ' ||
    COALESCE(array_to_string(NEW.tags, ' '), '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_exhibitions_search_vector ON exhibitions;
CREATE TRIGGER trg_exhibitions_search_vector
  BEFORE INSERT OR UPDATE OF title, description, medium, tags
  ON exhibitions
  FOR EACH ROW
  EXECUTE FUNCTION exhibitions_search_vector_trigger();

