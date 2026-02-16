-- Migration: Add banner_image_url to explore_tracks table

-- UP
ALTER TABLE explore_tracks ADD COLUMN banner_image_url TEXT;

-- DOWN
ALTER TABLE explore_tracks DROP COLUMN IF EXISTS banner_image_url;
