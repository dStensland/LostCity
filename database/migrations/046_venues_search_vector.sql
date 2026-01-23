-- Migration: Add full-text search support to venues table
-- This adds a tsvector column with weighted fields for relevance ranking

-- Add search_vector column to venues
ALTER TABLE venues ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create trigger function to automatically update search_vector
-- Weights: A = name (highest), B = aliases/vibes/neighborhood, C = description/address
CREATE OR REPLACE FUNCTION venues_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.aliases, ' '), '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.neighborhood, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.vibes, ' '), '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.spot_type, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.spot_types, ' '), '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.short_description, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.address, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create trigger to maintain search_vector on insert/update
DROP TRIGGER IF EXISTS venues_search_vector_trigger ON venues;
CREATE TRIGGER venues_search_vector_trigger
  BEFORE INSERT OR UPDATE OF name, aliases, neighborhood, vibes, spot_type, spot_types, description, short_description, address
  ON venues FOR EACH ROW EXECUTE FUNCTION venues_search_vector_update();

-- Backfill existing venues with search_vector
UPDATE venues SET search_vector =
  setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(array_to_string(aliases, ' '), '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(neighborhood, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(array_to_string(vibes, ' '), '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(spot_type, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(array_to_string(spot_types, ' '), '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(description, '')), 'C') ||
  setweight(to_tsvector('english', COALESCE(short_description, '')), 'C') ||
  setweight(to_tsvector('english', COALESCE(address, '')), 'C')
WHERE search_vector IS NULL;

-- Create GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_venues_search_vector ON venues USING GIN(search_vector);

-- Create trigram index on name for fuzzy matching
CREATE INDEX IF NOT EXISTS idx_venues_name_trgm ON venues USING GIN(name gin_trgm_ops);

-- Create trigram index on neighborhood for fuzzy matching
CREATE INDEX IF NOT EXISTS idx_venues_neighborhood_trgm ON venues USING GIN(neighborhood gin_trgm_ops);

COMMENT ON COLUMN venues.search_vector IS 'Full-text search vector with weighted fields: A=name/aliases, B=neighborhood/vibes/types, C=description/address';
