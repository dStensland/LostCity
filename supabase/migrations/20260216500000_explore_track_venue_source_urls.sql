-- Add per-track-venue source URLs so editorial blurbs can link to Wikipedia,
-- Atlas Obscura, official sites, or articles. Same venue can have different
-- source links in different tracks.

ALTER TABLE explore_track_venues
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS source_label TEXT DEFAULT 'Learn more';

COMMENT ON COLUMN explore_track_venues.source_url IS 'External link for the editorial blurb (Wikipedia, Atlas Obscura, etc.)';
COMMENT ON COLUMN explore_track_venues.source_label IS 'Display label for the source link (e.g. "Wikipedia", "Atlas Obscura")';
