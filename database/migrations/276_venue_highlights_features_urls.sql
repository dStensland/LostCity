-- 276_venue_highlights_features_urls.sql
-- Add external URL columns for linking out to Atlas Obscura, Wikipedia, venue subpages, etc.
-- Also deduplicate venue_highlights rows (169 exact title duplicates).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Add url column to venue_highlights
-- ---------------------------------------------------------------------------
ALTER TABLE venue_highlights ADD COLUMN IF NOT EXISTS url TEXT;

COMMENT ON COLUMN venue_highlights.url IS 'External link: Atlas Obscura, Wikipedia, venue subpage, etc.';

-- ---------------------------------------------------------------------------
-- 2) Add url column to venue_features
-- ---------------------------------------------------------------------------
ALTER TABLE venue_features ADD COLUMN IF NOT EXISTS url TEXT;

COMMENT ON COLUMN venue_features.url IS 'External link: venue attraction page, ticket purchase, etc.';

-- ---------------------------------------------------------------------------
-- 3) Deduplicate venue_highlights (keep lowest id per venue_id + title)
-- ---------------------------------------------------------------------------
DELETE FROM venue_highlights
WHERE id NOT IN (
  SELECT MIN(id)
  FROM venue_highlights
  GROUP BY venue_id, title
);

-- Prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_venue_highlights_unique_title
  ON venue_highlights (venue_id, title);

COMMIT;
