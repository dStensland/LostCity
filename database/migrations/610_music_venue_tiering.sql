-- Migration: Music Venue Tiering
--
-- Keep this file mirrored in database/migrations and supabase/migrations.
-- Update database/schema.sql in the same change set when schema changes are involved.

-- Music programming style enum — intentionally separate from a future
-- film_programming_style to allow multi-role venues (Star Community Bar,
-- Eddie's Attic, Eyedrum) to carry both roles without semantic overload.
DO $$ BEGIN
  CREATE TYPE music_programming_style_enum AS ENUM
    ('listening_room', 'curated_indie', 'jazz_club', 'dj_electronic', 'drive_in_amph');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE places
  ADD COLUMN IF NOT EXISTS music_programming_style music_programming_style_enum,
  ADD COLUMN IF NOT EXISTS music_venue_formats text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS capacity integer;

-- Derived-classification helpers expect these indexes for fast filtering.
CREATE INDEX IF NOT EXISTS idx_places_music_programming_style
  ON places (music_programming_style)
  WHERE music_programming_style IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_places_capacity_desc
  ON places (capacity DESC NULLS LAST)
  WHERE capacity IS NOT NULL;

COMMENT ON COLUMN places.music_programming_style IS
  'Editorial programming identity for music venues. NULL = not an editorial music venue. Distinct from a future film_programming_style to allow multi-role venues.';

COMMENT ON COLUMN places.music_venue_formats IS
  'Posture tags for music venues: listening_room, standing_room, outdoor, seated, dj_booth, arena, lawn, amphitheater. Parallels films venue_formats.';

COMMENT ON COLUMN places.capacity IS
  'Raw room capacity. Display band (intimate/club/theater/arena) derived in TS.';
