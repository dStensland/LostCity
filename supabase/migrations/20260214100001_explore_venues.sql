-- Add explore columns to venues for the Explore city guide feature
ALTER TABLE venues ADD COLUMN IF NOT EXISTS explore_category text;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS explore_featured boolean DEFAULT false;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS explore_blurb text;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS hero_image_url text;

-- Index for explore queries
CREATE INDEX IF NOT EXISTS idx_venues_explore
  ON venues(explore_category) WHERE explore_category IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_venues_explore_featured
  ON venues(explore_featured) WHERE explore_featured = true;
