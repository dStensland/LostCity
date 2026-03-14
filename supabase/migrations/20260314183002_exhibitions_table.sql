-- Migration: Exhibitions Table
--
-- Keep this file mirrored in database/migrations and supabase/migrations.
-- Update database/schema.sql in the same change set when schema changes are involved.

-- Phase D: Exhibitions table — first-class entity for Arts portal.
-- Follows volunteer_opportunities pattern (portal-specific entity with its own purpose).

CREATE TABLE IF NOT EXISTS exhibitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  source_id INTEGER REFERENCES sources(id) ON DELETE SET NULL,
  portal_id UUID REFERENCES portals(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  opening_date DATE,
  closing_date DATE,
  medium TEXT,
  exhibition_type TEXT CHECK (exhibition_type IN ('solo','group','installation','retrospective','popup','permanent')),
  admission_type TEXT CHECK (admission_type IN ('free','ticketed','donation','suggested')),
  admission_url TEXT,
  source_url TEXT,
  tags TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT exhibitions_date_order CHECK (opening_date IS NULL OR closing_date IS NULL OR opening_date <= closing_date)
);

CREATE INDEX IF NOT EXISTS idx_exhibitions_venue ON exhibitions(venue_id, is_active);
CREATE INDEX IF NOT EXISTS idx_exhibitions_portal ON exhibitions(portal_id, is_active) WHERE portal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_exhibitions_source ON exhibitions(source_id) WHERE source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_exhibitions_dates ON exhibitions(opening_date, closing_date) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS exhibition_artists (
  exhibition_id UUID NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
  artist_name TEXT NOT NULL,
  artist_url TEXT,
  role TEXT DEFAULT 'artist' CHECK (role IN ('artist','curator','collaborator')),
  PRIMARY KEY (exhibition_id, artist_name)
);

-- Triggers
DROP TRIGGER IF EXISTS update_exhibitions_updated_at ON exhibitions;
CREATE TRIGGER update_exhibitions_updated_at
  BEFORE UPDATE ON exhibitions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE exhibitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exhibition_artists ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'exhibitions'
      AND policyname = 'exhibitions_public_select_active'
  ) THEN
    CREATE POLICY exhibitions_public_select_active
      ON exhibitions FOR SELECT
      USING (is_active = true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'exhibition_artists'
      AND policyname = 'exhibition_artists_public_select'
  ) THEN
    CREATE POLICY exhibition_artists_public_select
      ON exhibition_artists FOR SELECT
      USING (
        EXISTS (SELECT 1 FROM exhibitions WHERE exhibitions.id = exhibition_artists.exhibition_id AND exhibitions.is_active = true)
      );
  END IF;
END $$;
