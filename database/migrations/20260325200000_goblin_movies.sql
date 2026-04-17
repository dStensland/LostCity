-- Goblin Day horror movie tracker
CREATE TABLE goblin_movies (
  id serial PRIMARY KEY,
  tmdb_id integer,
  title text NOT NULL,
  release_date date,
  poster_path text,
  rt_critics_score integer CHECK (rt_critics_score >= 0 AND rt_critics_score <= 100),
  rt_audience_score integer CHECK (rt_audience_score >= 0 AND rt_audience_score <= 100),
  watched boolean NOT NULL DEFAULT false,
  daniel_list boolean NOT NULL DEFAULT false,
  ashley_list boolean NOT NULL DEFAULT false,
  streaming_info jsonb DEFAULT '[]'::jsonb,
  year integer NOT NULL CHECK (year >= 2024 AND year <= 2030),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Partial unique index: only one row per TMDB movie
CREATE UNIQUE INDEX goblin_movies_tmdb_id_unique
  ON goblin_movies (tmdb_id) WHERE tmdb_id IS NOT NULL;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION goblin_movies_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER goblin_movies_set_updated_at
  BEFORE UPDATE ON goblin_movies
  FOR EACH ROW EXECUTE FUNCTION goblin_movies_updated_at();

-- No RLS — public table for two friends
ALTER TABLE goblin_movies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "goblin_movies_public" ON goblin_movies
  FOR ALL USING (true) WITH CHECK (true);
