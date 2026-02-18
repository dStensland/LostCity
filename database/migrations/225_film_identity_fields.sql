-- Migration 225: Dedicated film identity fields on events
--
-- Preserve venue-provided event titles in events.title while storing a
-- canonical movie identity for consolidation and tagging.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS film_title TEXT,
  ADD COLUMN IF NOT EXISTS film_release_year INTEGER,
  ADD COLUMN IF NOT EXISTS film_imdb_id TEXT,
  ADD COLUMN IF NOT EXISTS film_external_genres TEXT[],
  ADD COLUMN IF NOT EXISTS film_identity_source TEXT;

COMMENT ON COLUMN events.film_title IS
  'Canonical movie title matched from external metadata (keeps events.title as venue-facing display title)';
COMMENT ON COLUMN events.film_release_year IS
  'Canonical movie release year from external metadata or parser';
COMMENT ON COLUMN events.film_imdb_id IS
  'Canonical IMDb ID used to consolidate film screenings across venues/sources';
COMMENT ON COLUMN events.film_external_genres IS
  'External movie genres from metadata providers (OMDb/TMDb), before taxonomy normalization';
COMMENT ON COLUMN events.film_identity_source IS
  'Source of film identity fields, e.g. omdb or title_parse';

CREATE INDEX IF NOT EXISTS idx_events_film_imdb_id
  ON events(film_imdb_id)
  WHERE film_imdb_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_film_title_year
  ON events(film_title, film_release_year)
  WHERE film_title IS NOT NULL;
