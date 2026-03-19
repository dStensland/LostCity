-- Migration: Adventure Destination Images
--
-- Keep this file mirrored in database/migrations and supabase/migrations.
-- Update database/schema.sql in the same change set when schema changes are involved.

-- Backfill Wikimedia Commons image URLs for two core adventure destinations
-- that were missing images. Uses IS NULL guard so a curated image added later
-- is never overwritten.

UPDATE venues
SET image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Anna_Ruby_Falls.jpg/800px-Anna_Ruby_Falls.jpg'
WHERE slug = 'anna-ruby-falls'
  AND image_url IS NULL;

UPDATE venues
SET image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Panther_Creek_Falls%2C_GA.jpg/800px-Panther_Creek_Falls%2C_GA.jpg'
WHERE slug = 'panther-creek-falls'
  AND image_url IS NULL;

-- Fix Panola Mountain State Park missing coordinates and address
UPDATE venues
SET lat = 33.6353,
    lng = -84.1703,
    address = '2620 Highway 155 S'
WHERE slug = 'panola-mountain'
  AND lat IS NULL;
