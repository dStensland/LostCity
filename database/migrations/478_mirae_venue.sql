-- Migration: Mirae Venue
--
-- Keep this file mirrored in database/migrations and supabase/migrations.
-- Update database/schema.sql in the same change set when schema changes are involved.

-- Mirae — Modern Asian-fusion restaurant in Brookhaven from John and Grace Lee
-- (team behind Fudo). Coursed and shareable dining, Resy reservations.
-- is_active = false: events promoted via Resy/Instagram, no crawlable events page.

INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website, description, vibes, active
)
VALUES (
  'Mirae',
  'mirae',
  '1350 Dresden Dr NE Suite 1001',
  'Brookhaven',
  'Atlanta',
  'GA',
  '30319',
  33.86230000,
  -84.33620000,
  'restaurant',
  'restaurant',
  'https://www.miraerestaurant.com',
  'Modern Asian-fusion restaurant from John and Grace Lee, the team behind Fudo. Offers a coursed and shareable dining experience with standout dishes like Chilean Seabass, Miso Short Ribs, and Aged Wagyu Don. Craft cocktails, sake, and soju program. Reservations via Resy.',
  ARRAY['asian-fusion', 'date-night', 'craft-cocktails', 'upscale', 'resy'],
  true
)
ON CONFLICT (slug) DO NOTHING;

-- Register inactive source (events via Resy/Instagram, no crawlable event feed)
INSERT INTO sources (name, slug, url, source_type, is_active, integration_method, owner_portal_id)
SELECT
  'Mirae',
  'mirae',
  'https://www.miraerestaurant.com',
  'venue',
  false,
  'none',
  (SELECT id FROM portals WHERE slug = 'atlanta')
WHERE NOT EXISTS (SELECT 1 FROM sources WHERE slug = 'mirae');
