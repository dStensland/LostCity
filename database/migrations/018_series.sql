-- Migration: Add series table for recurring events and multi-venue showings
-- A series represents a single "thing" (movie, show, class) that has multiple event instances

-- Series types
-- film: Movies playing at theaters (Oppenheimer, Barbie, etc.)
-- recurring_show: Regular performances (Tuesday Night Improv, Open Mic Night)
-- class_series: Ongoing classes (Yoga Mondays, Pottery Workshop Series)
-- festival_program: Events within a festival (Film Fest screenings, DragonCon panels)
-- tour: Touring acts with multiple dates (comedy tours, music tours)

CREATE TABLE series (
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
  rating TEXT,  -- PG, R, etc.
  imdb_id TEXT,
  tmdb_id TEXT,

  -- For recurring shows
  frequency TEXT,  -- weekly, monthly, etc.
  day_of_week TEXT,  -- monday, tuesday, etc.

  -- Organization
  category TEXT,
  tags TEXT[],
  producer_id UUID REFERENCES producers(id),

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add series_id to events table
ALTER TABLE events ADD COLUMN series_id UUID REFERENCES series(id);

-- Index for efficient lookups
CREATE INDEX idx_series_slug ON series(slug);
CREATE INDEX idx_series_type ON series(series_type);
CREATE INDEX idx_series_title ON series(title);
CREATE INDEX idx_series_is_active ON series(is_active) WHERE is_active = true;
CREATE INDEX idx_events_series_id ON events(series_id);

-- Trigger to auto-update updated_at on series
CREATE TRIGGER update_series_updated_at
  BEFORE UPDATE ON series
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Helper function to generate slug from title
CREATE OR REPLACE FUNCTION generate_series_slug(title TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN lower(regexp_replace(regexp_replace(title, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'));
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE series IS 'Represents recurring events or multi-showing content (films, weekly shows, class series)';
COMMENT ON COLUMN series.series_type IS 'Type: film, recurring_show, class_series, festival_program, tour, other';
COMMENT ON COLUMN series.frequency IS 'For recurring shows: weekly, monthly, biweekly, etc.';
COMMENT ON COLUMN events.series_id IS 'Links event instance to its parent series (null for standalone events)';
