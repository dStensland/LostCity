-- Migration: Atlanta Tier 1/2 Venue Gap Fill
--
-- Keep this file mirrored in database/migrations and supabase/migrations.
-- Update database/schema.sql in the same change set when schema changes are involved.
--
-- Seeds 6 destination venues confirmed NOT in the system. All are destination-only
-- (no crawlable event calendar). Each gets venue INSERT + inactive source registration.
-- Excluded: Best End Brewing (permanently closed Jan 2025).

-- ============================================================
-- 1. Tiger Sun — omakase cocktail dojo on a 1960s bus, Reynoldstown
-- ============================================================
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website,
  description, vibes, active
) VALUES (
  'Tiger Sun', 'tiger-sun',
  '904 Memorial Dr SE', 'Reynoldstown', 'Atlanta', 'GA', '30316',
  33.746870, -84.351500, 'bar', 'bar',
  'https://www.tigersunatl.com',
  'Reservation-only omakase-style cocktail dojo aboard a refurbished 1960s tour bus near Muchacho in Reynoldstown. Immersive story-driven cocktail experiences.',
  ARRAY['craft-cocktails', 'speakeasy', 'date-night', 'intimate', 'reservations-only'],
  true
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
VALUES ('tiger-sun', 'Tiger Sun', 'https://www.tigersunatl.com', 'venue', 'monthly', false,
  (SELECT id FROM portals WHERE slug = 'atlanta'), 'none')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 2. Side Quest — Vietnamese-inspired bar above Pisces, Edgewood
-- ============================================================
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website,
  description, vibes, active
) VALUES (
  'Side Quest', 'side-quest',
  '483 Edgewood Ave SE', 'Old Fourth Ward', 'Atlanta', 'GA', '30312',
  33.754123, -84.371804, 'bar', 'bar',
  'https://www.instagram.com/sidequest.atl',
  'Vietnamese and Lao-inspired bar and kitchen above Pisces on Edgewood. Craft cocktails and Southeast Asian dishes from the team behind Lucky Star and Stereo.',
  ARRAY['craft-cocktails', 'asian-fusion', 'date-night', 'intimate'],
  true
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
VALUES ('side-quest', 'Side Quest', 'https://www.instagram.com/sidequest.atl', 'venue', 'monthly', false,
  (SELECT id FROM portals WHERE slug = 'atlanta'), 'none')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 3. Carroll Street Cafe — neighborhood brunch anchor, Cabbagetown
-- ============================================================
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website,
  description, vibes, active
) VALUES (
  'Carroll Street Cafe', 'carroll-street-cafe',
  '208 Carroll St SE', 'Cabbagetown', 'Atlanta', 'GA', '30312',
  33.748986, -84.367948, 'restaurant', 'restaurant',
  'https://carrollstreetcabbagetown.com',
  'Bohemian neighborhood cafe in historic Cabbagetown serving breakfast, brunch, lunch, and dinner with a cozy patio and full bar.',
  ARRAY['brunch', 'neighborhood', 'outdoor-seating', 'cozy', 'casual'],
  true
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
VALUES ('carroll-street-cafe', 'Carroll Street Cafe', 'https://carrollstreetcabbagetown.com', 'venue', 'monthly', false,
  (SELECT id FROM portals WHERE slug = 'atlanta'), 'none')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 4. The Forum Cocktail Co — speakeasy at The Works, West Midtown
-- ============================================================
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website,
  description, vibes, active
) VALUES (
  'The Forum Cocktail Co', 'the-forum-cocktail-co',
  '1235 Chattahoochee Ave NW', 'West Midtown', 'Atlanta', 'GA', '30318',
  33.797500, -84.428500, 'bar', 'bar',
  'https://theforumcocktailco.com',
  'Bespoke craft cocktail bar at The Works complex in West Midtown with small plates and a hidden reservation-only speakeasy called The Midnight Room.',
  ARRAY['craft-cocktails', 'speakeasy', 'date-night', 'intimate', 'small-plates'],
  true
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
VALUES ('the-forum-cocktail-co', 'The Forum Cocktail Co', 'https://theforumcocktailco.com', 'venue', 'monthly', false,
  (SELECT id FROM portals WHERE slug = 'atlanta'), 'none')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 5. The Albert — neighborhood pub, Inman Park
-- ============================================================
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website,
  description, vibes, active
) VALUES (
  'The Albert', 'the-albert',
  '918 Austin Ave NE', 'Inman Park', 'Atlanta', 'GA', '30307',
  33.762007, -84.357522, 'bar', 'bar',
  'https://www.thealbertatlanta.com',
  'Beloved Inman Park neighborhood pub since 2007. Trivia nights, award-winning bar food, and a character-filled patio scene.',
  ARRAY['neighborhood', 'trivia', 'outdoor-seating', 'gastropub', 'casual'],
  true
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
VALUES ('the-albert', 'The Albert', 'https://www.thealbertatlanta.com', 'venue', 'monthly', false,
  (SELECT id FROM portals WHERE slug = 'atlanta'), 'none')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 6. Redacted Basement Drink Parlor — speakeasy, Summerhill
-- ============================================================
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website,
  description, vibes, active
) VALUES (
  'Redacted Basement Drink Parlor', 'redacted-basement-drink-parlor',
  '63 Georgia Ave SE', 'Summerhill', 'Atlanta', 'GA', '30312',
  33.736701, -84.385677, 'bar', 'bar',
  'https://redactedbdp.com',
  'Underground speakeasy beneath Summerhill''s Georgia Avenue strip. Conspiracy-theory-themed cocktails, charcuterie, and Cold War-era decor accessed through an unmarked side door.',
  ARRAY['speakeasy', 'craft-cocktails', 'date-night', 'intimate', 'hidden'],
  true
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
VALUES ('redacted-basement-drink-parlor', 'Redacted Basement Drink Parlor', 'https://redactedbdp.com', 'venue', 'monthly', false,
  (SELECT id FROM portals WHERE slug = 'atlanta'), 'none')
ON CONFLICT (slug) DO NOTHING;
