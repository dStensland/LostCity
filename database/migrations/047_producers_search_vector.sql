-- Migration: Add full-text search support to event_producers table
-- This adds a tsvector column with weighted fields for relevance ranking

-- Add search_vector column to event_producers
ALTER TABLE event_producers ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create trigger function to automatically update search_vector
-- Weights: A = name (highest), B = org_type/categories, C = description
CREATE OR REPLACE FUNCTION producers_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.org_type, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.categories, ' '), '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.neighborhood, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create trigger to maintain search_vector on insert/update
DROP TRIGGER IF EXISTS producers_search_vector_trigger ON event_producers;
CREATE TRIGGER producers_search_vector_trigger
  BEFORE INSERT OR UPDATE OF name, org_type, categories, neighborhood, description
  ON event_producers FOR EACH ROW EXECUTE FUNCTION producers_search_vector_update();

-- Backfill existing producers with search_vector
UPDATE event_producers SET search_vector =
  setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(org_type, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(array_to_string(categories, ' '), '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(neighborhood, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(description, '')), 'C')
WHERE search_vector IS NULL;

-- Create GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_producers_search_vector ON event_producers USING GIN(search_vector);

-- Create trigram index on name for fuzzy matching
CREATE INDEX IF NOT EXISTS idx_producers_name_trgm ON event_producers USING GIN(name gin_trgm_ops);

COMMENT ON COLUMN event_producers.search_vector IS 'Full-text search vector with weighted fields: A=name, B=org_type/categories/neighborhood, C=description';
