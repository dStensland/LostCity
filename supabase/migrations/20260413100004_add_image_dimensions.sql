-- Migration: Add Image Dimensions
--
-- Keep this file mirrored in database/migrations and supabase/migrations.
-- Update database/schema.sql in the same change set when schema changes are involved.

-- Add image dimension columns for server-side hero tier detection
-- These are populated at crawl time via image intrinsics
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS image_width integer,
  ADD COLUMN IF NOT EXISTS image_height integer;

-- Index for efficient tier computation (only care about images that exist)
CREATE INDEX IF NOT EXISTS idx_events_image_dimensions
  ON events (image_width, image_height)
  WHERE image_url IS NOT NULL;

COMMENT ON COLUMN events.image_width IS 'Width in pixels of image_url, populated at crawl time';
COMMENT ON COLUMN events.image_height IS 'Height in pixels of image_url, populated at crawl time';
