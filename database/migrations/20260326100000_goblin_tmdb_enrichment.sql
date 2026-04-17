-- Add TMDB enrichment columns to goblin_movies
ALTER TABLE goblin_movies
  ADD COLUMN IF NOT EXISTS genres jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tmdb_vote_average numeric(3,1),
  ADD COLUMN IF NOT EXISTS tmdb_vote_count integer,
  ADD COLUMN IF NOT EXISTS tmdb_popularity numeric(10,2),
  ADD COLUMN IF NOT EXISTS runtime_minutes integer,
  ADD COLUMN IF NOT EXISTS keywords jsonb DEFAULT '[]'::jsonb;
