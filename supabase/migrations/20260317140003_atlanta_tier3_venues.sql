-- Migration: Atlanta Tier 3 Destination Venues
--
-- Keep this file mirrored in database/migrations and supabase/migrations.
-- Update database/schema.sql in the same change set when schema changes are involved.
--
-- Seeds 12 lower-priority destination venues that complete hot-neighborhood coverage.
-- All are destination-only (no crawlable event calendar).
-- Excluded from original 15: St. Charles Greenwood (neighborhood name, not a venue),
-- Mambo Zombi (closed/relocating, no confirmed address), Bar Top (may not be open yet).
-- Corrected: Close Company is in Old Fourth Ward, not East Atlanta Village.

-- ============================================================
-- 1. Westside Motor Lounge — beer garden + live music, West Midtown
-- ============================================================
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website,
  description, vibes, active
) VALUES (
  'Westside Motor Lounge', 'westside-motor-lounge',
  '725 Echo St NW', 'West Midtown', 'Atlanta', 'GA', '30318',
  33.774822, -84.409987, 'bar', 'bar',
  'https://www.westsidemotorlounge.com',
  'West Midtown restaurant and bar with a sprawling outdoor courtyard, live music stage, beer garden, shuffleboard courts, firepits, and a vintage Airstream bar.',
  ARRAY['outdoor-seating', 'live-music', 'beer-garden', 'games', 'groups'],
  true
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
VALUES ('westside-motor-lounge', 'Westside Motor Lounge', 'https://www.westsidemotorlounge.com', 'venue', 'monthly', false,
  (SELECT id FROM portals WHERE slug = 'atlanta'), 'none')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 2. Dad's — nostalgia cocktail bar, Virginia-Highland
-- ============================================================
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website,
  description, vibes, active
) VALUES (
  'Dad''s', 'dads-atl',
  '870 N Highland Ave NE', 'Virginia-Highland', 'Atlanta', 'GA', '30306',
  33.778324, -84.353084, 'bar', 'bar',
  'https://www.dadsatl.com',
  'Nostalgia-inspired cocktail bar in a converted filling station serving creative drinks and latchkey-kid comfort food like pizza rolls and sliders.',
  ARRAY['craft-cocktails', 'retro', 'neighborhood', 'casual', 'comfort-food'],
  true
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
VALUES ('dads-atl', 'Dad''s', 'https://www.dadsatl.com', 'venue', 'monthly', false,
  (SELECT id FROM portals WHERE slug = 'atlanta'), 'none')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 3. Inner Voice Brewing — craft brewery, Decatur
-- ============================================================
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website,
  description, vibes, active
) VALUES (
  'Inner Voice Brewing', 'inner-voice-brewing',
  '308 W Ponce De Leon Ave, Ste H', 'Downtown Decatur', 'Decatur', 'GA', '30030',
  33.775318, -84.300248, 'brewery', 'brewery',
  'https://www.innervoicebrewing.beer',
  'Downtown Decatur craft brewery and taproom with 16 rotating taps focused on lagers, IPAs, and sours, blocks from Decatur Square.',
  ARRAY['craft-beer', 'brewery', 'casual', 'neighborhood'],
  true
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
VALUES ('inner-voice-brewing', 'Inner Voice Brewing', 'https://www.innervoicebrewing.beer', 'venue', 'monthly', false,
  (SELECT id FROM portals WHERE slug = 'atlanta'), 'none')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 4. Sebastian Pintxos Bar — Basque tapas, Midtown
-- ============================================================
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website,
  description, vibes, active
) VALUES (
  'Sebastian Pintxos Bar', 'sebastian-pintxos-bar',
  '818 Juniper St NE', 'Midtown', 'Atlanta', 'GA', '30308',
  33.776874, -84.383086, 'restaurant', 'restaurant',
  'https://www.sebastianpintxosbar.com',
  'Basque-inspired pintxos and tapas bar in Midtown with a dog-friendly patio, craft cocktails, and a hidden speakeasy lounge called 818.',
  ARRAY['tapas', 'craft-cocktails', 'dog-friendly', 'outdoor-seating', 'date-night'],
  true
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
VALUES ('sebastian-pintxos-bar', 'Sebastian Pintxos Bar', 'https://www.sebastianpintxosbar.com', 'venue', 'monthly', false,
  (SELECT id FROM portals WHERE slug = 'atlanta'), 'none')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 5. Poor Hendrix — Michelin-recognized neighborhood spot, Kirkwood
-- ============================================================
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website,
  description, vibes, active
) VALUES (
  'Poor Hendrix', 'poor-hendrix',
  '2371 Hosea L Williams Dr NE, Bldg 2', 'Kirkwood', 'Atlanta', 'GA', '30317',
  33.750877, -84.309441, 'restaurant', 'restaurant',
  'https://www.poorhendrix.com',
  'Michelin-recognized neighborhood restaurant and cocktail bar in Kirkwood serving honest New American fare in a comfortable atmosphere.',
  ARRAY['craft-cocktails', 'date-night', 'neighborhood', 'michelin'],
  true
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
VALUES ('poor-hendrix', 'Poor Hendrix', 'https://www.poorhendrix.com', 'venue', 'monthly', false,
  (SELECT id FROM portals WHERE slug = 'atlanta'), 'none')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 6. The Argonaut — oyster bar + cocktails, Kirkwood
-- ============================================================
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website,
  description, vibes, active
) VALUES (
  'The Argonaut', 'the-argonaut',
  '1963 Hosea L Williams Dr NE', 'Kirkwood', 'Atlanta', 'GA', '30317',
  33.751607, -84.323389, 'bar', 'bar',
  'https://www.theargonautatl.com',
  'Oyster and raw fish bar with a full cocktail program in Kirkwood, featuring an upstairs lounge called Kraken''s Den.',
  ARRAY['craft-cocktails', 'seafood', 'date-night', 'neighborhood'],
  true
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
VALUES ('the-argonaut', 'The Argonaut', 'https://www.theargonautatl.com', 'venue', 'monthly', false,
  (SELECT id FROM portals WHERE slug = 'atlanta'), 'none')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 7. Trackside Tavern — neighborhood dive, Decatur
-- ============================================================
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website,
  description, vibes, active
) VALUES (
  'Trackside Tavern', 'trackside-tavern',
  '313 E College Ave', 'Downtown Decatur', 'Decatur', 'GA', '30030',
  33.771075, -84.292021, 'bar', 'bar',
  'https://www.facebook.com/tracksidetaverndecatur',
  'Longtime Decatur dive bar near the train tracks with pool, darts, air hockey, cold beer, and a no-frills neighborhood atmosphere.',
  ARRAY['dive-bar', 'games', 'late-night', 'casual', 'neighborhood'],
  true
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
VALUES ('trackside-tavern', 'Trackside Tavern', 'https://www.facebook.com/tracksidetaverndecatur', 'venue', 'monthly', false,
  (SELECT id FROM portals WHERE slug = 'atlanta'), 'none')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 8. Fox Bros BBQ — beloved Texas-style BBQ, near Little Five Points
-- ============================================================
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website,
  description, vibes, active
) VALUES (
  'Fox Bros BBQ', 'fox-bros-bbq',
  '1238 DeKalb Ave NE', 'Little Five Points', 'Atlanta', 'GA', '30307',
  33.760995, -84.347533, 'restaurant', 'restaurant',
  'https://www.foxbrosbbq.com',
  'Beloved Texas-style barbecue restaurant in Little Five Points known for smoked brisket, ribs, and house-made sides.',
  ARRAY['bbq', 'casual', 'groups', 'neighborhood', 'comfort-food'],
  true
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
VALUES ('fox-bros-bbq', 'Fox Bros BBQ', 'https://www.foxbrosbbq.com', 'venue', 'monthly', false,
  (SELECT id FROM portals WHERE slug = 'atlanta'), 'none')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 9. Banshee — Michelin Bib Gourmand, East Atlanta Village
-- ============================================================
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website,
  description, vibes, active
) VALUES (
  'Banshee', 'banshee',
  '1271 Glenwood Ave SE', 'East Atlanta Village', 'Atlanta', 'GA', '30316',
  33.739972, -84.345932, 'restaurant', 'restaurant',
  'https://www.banshee-atl.com',
  'Michelin Bib Gourmand New American restaurant and late-night bar in East Atlanta Village with seasonal menus and a relaxed neighborhood vibe.',
  ARRAY['michelin', 'date-night', 'late-night', 'neighborhood', 'seasonal'],
  true
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
VALUES ('banshee', 'Banshee', 'https://www.banshee-atl.com', 'venue', 'monthly', false,
  (SELECT id FROM portals WHERE slug = 'atlanta'), 'none')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 10. Close Company — cocktail bar, Old Fourth Ward
-- ============================================================
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website,
  description, vibes, active
) VALUES (
  'Close Company', 'close-company',
  '505 N Angier Ave NE, Ste 320', 'Old Fourth Ward', 'Atlanta', 'GA', '30308',
  33.768489, -84.362795, 'bar', 'bar',
  'https://www.closecompanybar.com',
  'Lively cocktail bar from the Death & Company team serving inventive drinks and bar snacks on the Ponce corridor.',
  ARRAY['craft-cocktails', 'date-night', 'late-night', 'groups'],
  true
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
VALUES ('close-company', 'Close Company', 'https://www.closecompanybar.com', 'venue', 'monthly', false,
  (SELECT id FROM portals WHERE slug = 'atlanta'), 'none')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 11. Little Sparrow — Michelin-recognized French bistro, West Midtown
-- ============================================================
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website,
  description, vibes, active
) VALUES (
  'Little Sparrow', 'little-sparrow',
  '1198 Howell Mill Rd', 'West Midtown', 'Atlanta', 'GA', '30318',
  33.786755, -84.412232, 'restaurant', 'restaurant',
  'https://www.littlesparrowatl.com',
  'Michelin-recognized French bistro on Howell Mill serving refined seasonal dishes and craft cocktails in a chic setting.',
  ARRAY['michelin', 'date-night', 'french', 'craft-cocktails', 'upscale'],
  true
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
VALUES ('little-sparrow', 'Little Sparrow', 'https://www.littlesparrowatl.com', 'venue', 'monthly', false,
  (SELECT id FROM portals WHERE slug = 'atlanta'), 'none')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 12. Petit Chou — French-Southern bistro, Cabbagetown
-- ============================================================
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website,
  description, vibes, active
) VALUES (
  'Petit Chou', 'petit-chou',
  '662 Memorial Dr SE', 'Cabbagetown', 'Atlanta', 'GA', '30312',
  33.746864, -84.365859, 'restaurant', 'restaurant',
  'https://petitchouatl.com',
  'Charming Cabbagetown bistro blending French and Southern cuisine, known for standout brunch, pastries, and weeknight dinners.',
  ARRAY['brunch', 'french', 'neighborhood', 'cozy', 'bakery'],
  true
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
VALUES ('petit-chou', 'Petit Chou', 'https://petitchouatl.com', 'venue', 'monthly', false,
  (SELECT id FROM portals WHERE slug = 'atlanta'), 'none')
ON CONFLICT (slug) DO NOTHING;
