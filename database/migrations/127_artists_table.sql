-- Canonical artists table — flexible across all media disciplines
CREATE TABLE IF NOT EXISTS artists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  discipline TEXT NOT NULL DEFAULT 'musician',
  bio TEXT,
  image_url TEXT,
  genres TEXT[],
  hometown TEXT,

  -- External IDs (nullable, discipline-dependent)
  deezer_id INTEGER,
  spotify_id TEXT,
  imdb_id TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artists_slug ON artists(slug);
CREATE INDEX IF NOT EXISTS idx_artists_discipline ON artists(discipline);
CREATE INDEX IF NOT EXISTS idx_artists_deezer_id ON artists(deezer_id) WHERE deezer_id IS NOT NULL;
