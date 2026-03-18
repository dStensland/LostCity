-- Add artist_id FK to exhibition_artists for unified artist identity
ALTER TABLE exhibition_artists ADD COLUMN IF NOT EXISTS artist_id UUID REFERENCES artists(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_exhibition_artists_artist_id ON exhibition_artists(artist_id) WHERE artist_id IS NOT NULL;
