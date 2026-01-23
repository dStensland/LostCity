-- Migration: Fix series table for PostgREST access
-- Ensures table exists, has correct columns, and proper grants for API access

-- Create series table if it doesn't exist
CREATE TABLE IF NOT EXISTS series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  series_type TEXT NOT NULL CHECK (series_type IN ('film', 'recurring_show', 'class_series', 'festival_program', 'tour', 'other')),

  -- Media
  image_url TEXT,
  trailer_url TEXT,

  -- For films
  director TEXT,
  runtime_minutes INTEGER,
  year INTEGER,
  rating TEXT,
  imdb_id TEXT,
  tmdb_id TEXT,

  -- For recurring shows
  frequency TEXT,
  day_of_week TEXT,

  -- Organization
  category TEXT,
  tags TEXT[],
  genres TEXT[],  -- Added: was missing from original migration
  producer_id UUID,  -- No FK constraint - producers table may not exist

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add genres column if table exists but column doesn't
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'series' AND column_name = 'genres'
  ) THEN
    ALTER TABLE series ADD COLUMN genres TEXT[];
  END IF;
END $$;

-- Add series_id to events table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'series_id'
  ) THEN
    ALTER TABLE events ADD COLUMN series_id UUID REFERENCES series(id);
  END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_series_slug ON series(slug);
CREATE INDEX IF NOT EXISTS idx_series_type ON series(series_type);
CREATE INDEX IF NOT EXISTS idx_series_title ON series(title);
CREATE INDEX IF NOT EXISTS idx_series_is_active ON series(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_events_series_id ON events(series_id);

-- Enable RLS but allow all operations for service_role
ALTER TABLE series ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (to recreate cleanly)
DROP POLICY IF EXISTS "series_select_all" ON series;
DROP POLICY IF EXISTS "series_insert_all" ON series;
DROP POLICY IF EXISTS "series_update_all" ON series;
DROP POLICY IF EXISTS "series_delete_all" ON series;

-- Create permissive policies - series data is public
CREATE POLICY "series_select_all" ON series FOR SELECT USING (true);
CREATE POLICY "series_insert_all" ON series FOR INSERT WITH CHECK (true);
CREATE POLICY "series_update_all" ON series FOR UPDATE USING (true);
CREATE POLICY "series_delete_all" ON series FOR DELETE USING (true);

-- Grant access to API roles
GRANT SELECT, INSERT, UPDATE, DELETE ON series TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON series TO authenticated;
GRANT ALL ON series TO service_role;

-- Notify PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
