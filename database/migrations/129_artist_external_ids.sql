-- Add MusicBrainz and Wikidata identifiers to artists table
ALTER TABLE artists ADD COLUMN IF NOT EXISTS musicbrainz_id UUID;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS wikidata_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_artists_musicbrainz_id ON artists(musicbrainz_id) WHERE musicbrainz_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_artists_wikidata_id ON artists(wikidata_id) WHERE wikidata_id IS NOT NULL;
