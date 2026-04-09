-- Add film metadata columns to screening_titles.
-- These are film-level properties (not run/venue-specific).

ALTER TABLE screening_titles ADD COLUMN IF NOT EXISTS director TEXT;
ALTER TABLE screening_titles ADD COLUMN IF NOT EXISTS runtime_minutes INTEGER;
ALTER TABLE screening_titles ADD COLUMN IF NOT EXISTS year INTEGER;
ALTER TABLE screening_titles ADD COLUMN IF NOT EXISTS rating TEXT;
