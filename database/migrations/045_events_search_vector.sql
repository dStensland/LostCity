-- Migration: Add full-text search support to events table
-- This adds a tsvector column with weighted fields for relevance ranking

-- Enable required extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Add search_vector column to events
ALTER TABLE events ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create trigger function to automatically update search_vector
-- Weights: A = title (highest), B = tags/category, C = description, D = raw_text
CREATE OR REPLACE FUNCTION events_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.category, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.subcategory, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.raw_text, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create trigger to maintain search_vector on insert/update
DROP TRIGGER IF EXISTS events_search_vector_trigger ON events;
CREATE TRIGGER events_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title, tags, category, subcategory, description, raw_text
  ON events FOR EACH ROW EXECUTE FUNCTION events_search_vector_update();

-- Backfill existing events with search_vector
UPDATE events SET search_vector =
  setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(array_to_string(tags, ' '), '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(category, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(subcategory, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(description, '')), 'C') ||
  setweight(to_tsvector('english', COALESCE(raw_text, '')), 'D')
WHERE search_vector IS NULL;

-- Create GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_events_search_vector ON events USING GIN(search_vector);

-- Create trigram index on title for fuzzy matching
CREATE INDEX IF NOT EXISTS idx_events_title_trgm ON events USING GIN(title gin_trgm_ops);

-- Create trigram index on category for fuzzy matching
CREATE INDEX IF NOT EXISTS idx_events_category_trgm ON events USING GIN(category gin_trgm_ops);

COMMENT ON COLUMN events.search_vector IS 'Full-text search vector with weighted fields: A=title, B=tags/category, C=description, D=raw_text';
