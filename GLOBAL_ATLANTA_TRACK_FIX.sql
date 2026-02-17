-- Global Atlanta "A Beautiful Mosaic" Track - Immediate Data Quality Fixes
-- Date: 2026-02-14
-- Adds 15 cultural venues to the track and fixes venue types

BEGIN;

-- Add high-priority venues to a-beautiful-mosaic track
INSERT INTO explore_track_venues (track_slug, venue_id, sort_order) VALUES
  ('a-beautiful-mosaic', 2623, 1),   -- Plaza Fiesta
  ('a-beautiful-mosaic', 2430, 2),   -- Plaza Las Americas
  ('a-beautiful-mosaic', 1205, 3),   -- Buford Highway Farmers Market
  ('a-beautiful-mosaic', 352, 4),    -- Sweet Auburn Curb Market
  ('a-beautiful-mosaic', 756, 5),    -- Latin American Association
  ('a-beautiful-mosaic', 3931, 6),   -- IRC Atlanta
  ('a-beautiful-mosaic', 3901, 7),   -- CPACS
  ('a-beautiful-mosaic', 979, 8),    -- Shrine Cultural Center
  ('a-beautiful-mosaic', 1972, 9),   -- Westside Cultural Arts Center
  ('a-beautiful-mosaic', 985, 10),   -- Ebenezer Baptist Church
  ('a-beautiful-mosaic', 2177, 11),  -- MJCCA
  ('a-beautiful-mosaic', 1804, 12),  -- Blooms Emporium Chinatown
  ('a-beautiful-mosaic', 1722, 13),  -- Jeju Sauna
  ('a-beautiful-mosaic', 1334, 14),  -- Hudgens Center
  ('a-beautiful-mosaic', 649, 15)    -- Fine Arts Gallery GSU Clarkston
ON CONFLICT (track_slug, venue_id) DO NOTHING;

-- Fix venue types for better discoverability
UPDATE venues SET 
  venue_type = 'international_market',
  neighborhood = 'Buford Highway'
WHERE id = 2623; -- Plaza Fiesta

UPDATE venues SET venue_type = 'international_market' WHERE id = 2430; -- Plaza Las Americas
UPDATE venues SET venue_type = 'international_market' WHERE id = 1205; -- Buford Hwy FM
UPDATE venues SET venue_type = 'international_market' WHERE id = 1216; -- Great Wall Supermarket
UPDATE venues SET venue_type = 'nonprofit' WHERE id IN (756, 3931, 3901); -- LAA, IRC, CPACS

-- Verify results
SELECT 
  v.id, 
  v.name, 
  v.venue_type, 
  v.neighborhood,
  CASE WHEN v.image_url IS NOT NULL OR v.hero_image_url IS NOT NULL THEN 'Yes' ELSE 'No' END as has_image
FROM explore_track_venues etv
JOIN venues v ON etv.venue_id = v.id
WHERE etv.track_slug = 'a-beautiful-mosaic'
ORDER BY etv.sort_order;

COMMIT;
