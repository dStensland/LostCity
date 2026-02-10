-- Migration 171: Taxonomy & Preferences Expansion
-- Adds favorite_genres to user_preferences, portal_id to inferred_preferences,
-- updates search vectors to include genres (replacing subcategory), and adds
-- venue genre inference materialized view.
-- Depends on: 165_taxonomy_genre_refactor.sql (venues.genres, festivals.genres, needs_* columns)

-- ============================================================================
-- 1. USER PREFERENCES: FAVORITE GENRES
-- ============================================================================

-- Stores {category: [genre1, genre2, ...]} selected during onboarding
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS favorite_genres JSONB DEFAULT '{}';

COMMENT ON COLUMN user_preferences.favorite_genres IS 'Genre preferences by category, e.g. {"music": ["jazz", "hip-hop"], "food_drink": ["brunch", "cocktails"]}';

-- ============================================================================
-- 2. INFERRED PREFERENCES: PORTAL ATTRIBUTION
-- ============================================================================

-- Track which portal a preference signal came from
ALTER TABLE inferred_preferences
  ADD COLUMN IF NOT EXISTS portal_id UUID REFERENCES portals(id);

CREATE INDEX IF NOT EXISTS idx_inferred_preferences_portal
  ON inferred_preferences(portal_id) WHERE portal_id IS NOT NULL;

COMMENT ON COLUMN inferred_preferences.portal_id IS 'Portal where this preference signal was captured (NULL = main app)';

-- ============================================================================
-- 3. EVENTS SEARCH VECTOR: REPLACE SUBCATEGORY WITH GENRES
-- ============================================================================

CREATE OR REPLACE FUNCTION events_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.category, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.genres, ' '), '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.raw_text, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. VENUES SEARCH VECTOR: ADD GENRES
-- ============================================================================

CREATE OR REPLACE FUNCTION venues_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.aliases, ' '), '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.neighborhood, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.vibes, ' '), '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.spot_type, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.spot_types, ' '), '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.genres, ' '), '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.short_description, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.address, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. VENUE GENRE INFERENCE MATERIALIZED VIEW
-- ============================================================================

-- Aggregates genre data from events to infer venue genres
-- Used by backfill_genres.py and potentially by the API for genre-based venue filtering
CREATE MATERIALIZED VIEW IF NOT EXISTS venue_genre_inference AS
SELECT
  venue_id,
  genre,
  COUNT(*) AS event_count,
  COUNT(*) FILTER (WHERE start_date >= CURRENT_DATE - INTERVAL '90 days') AS recent_count
FROM events, unnest(genres) AS genre
WHERE venue_id IS NOT NULL
  AND genres IS NOT NULL
  AND start_date >= CURRENT_DATE - INTERVAL '365 days'
GROUP BY venue_id, genre
HAVING COUNT(*) >= 3;

CREATE UNIQUE INDEX IF NOT EXISTS idx_venue_genre_inference_pk
  ON venue_genre_inference(venue_id, genre);

CREATE INDEX IF NOT EXISTS idx_venue_genre_inference_venue
  ON venue_genre_inference(venue_id);

COMMENT ON MATERIALIZED VIEW venue_genre_inference IS 'Genre distribution per venue based on event history (last 365 days, min 3 events). Refresh with: REFRESH MATERIALIZED VIEW CONCURRENTLY venue_genre_inference;';

-- ============================================================================
-- 6. BACKFILL SEARCH VECTORS FOR EXISTING ROWS WITH GENRES
-- ============================================================================

-- Update events that have genres so their search_vector includes the genre terms
UPDATE events SET search_vector =
  setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(array_to_string(tags, ' '), '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(category, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(array_to_string(genres, ' '), '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(description, '')), 'C') ||
  setweight(to_tsvector('english', COALESCE(raw_text, '')), 'D')
WHERE genres IS NOT NULL AND array_length(genres, 1) > 0;

-- Update venues that have genres so their search_vector includes the genre terms
UPDATE venues SET search_vector =
  setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(array_to_string(aliases, ' '), '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(neighborhood, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(array_to_string(vibes, ' '), '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(spot_type, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(array_to_string(spot_types, ' '), '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(array_to_string(genres, ' '), '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(description, '')), 'C') ||
  setweight(to_tsvector('english', COALESCE(short_description, '')), 'C') ||
  setweight(to_tsvector('english', COALESCE(address, '')), 'C')
WHERE genres IS NOT NULL AND array_length(genres, 1) > 0;

-- DOWN (rollback)
-- DROP MATERIALIZED VIEW IF EXISTS venue_genre_inference;
-- ALTER TABLE user_preferences DROP COLUMN IF EXISTS favorite_genres;
-- ALTER TABLE inferred_preferences DROP COLUMN IF EXISTS portal_id;
-- Then restore the old search vector functions (with subcategory, without genres)
