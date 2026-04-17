-- Goblin Day TMDB enrichment round 2
ALTER TABLE goblin_movies
  ADD COLUMN IF NOT EXISTS director text,
  ADD COLUMN IF NOT EXISTS mpaa_rating text,
  ADD COLUMN IF NOT EXISTS trailer_url text,
  ADD COLUMN IF NOT EXISTS backdrop_path text,
  ADD COLUMN IF NOT EXISTS imdb_id text;
