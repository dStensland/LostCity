-- Migration: Atlanta Nightlife Destination Venues
--
-- Keep this file mirrored in database/migrations and supabase/migrations.
-- Update database/schema.sql in the same change set when schema changes are involved.
--
-- Seeds 12 destination venues that are notable enough to appear on "best of Atlanta"
-- lists but don't have crawlable event calendars. Also registers sources.
-- Excluded (permanently closed): Regent Cocktail Club, Mac McGee (Decatur),
-- Kirkyard Public House, Blind Pig Parlor Bar.

-- ============================================================
-- 1. El Malo — rum & agave cocktail bar at Atlanta Dairies
-- ============================================================
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website,
  description, vibes, active
) VALUES (
  'El Malo', 'el-malo',
  '777 Memorial Dr SE, Ste A102B', 'Reynoldstown', 'Atlanta', 'GA', '30316',
  33.7461, -84.3602, 'bar', 'bar',
  'https://elmaloatl.com',
  'Rum and agave-focused craft cocktail listening bar inside the Atlanta Dairies complex. Moody, maximalist interiors with disco balls and velvet banquettes. Live DJs on weekends. Caribbean-inspired small plates.',
  ARRAY['craft-cocktails', 'date-night', 'late-night', 'live-music', 'intimate'],
  true
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
VALUES ('el-malo', 'El Malo', 'https://elmaloatl.com', 'venue', 'monthly', false,
  (SELECT id FROM portals WHERE slug = 'atlanta'), 'none')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 2. Jojo's Beloved — speakeasy at Colony Square, Midtown
-- ============================================================
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website,
  description, vibes, active
) VALUES (
  'Jojo''s Beloved', 'jojos-beloved',
  '1197 Peachtree St NE, Unit 150', 'Midtown', 'Atlanta', 'GA', '30361',
  33.7872, -84.3822, 'bar', 'bar',
  'https://www.jojosbeloved.com',
  'Hidden speakeasy-style cocktail lounge at Colony Square celebrating 70s and 80s disco glam. Retro decor, craft cocktails, intimate atmosphere. Reservations recommended.',
  ARRAY['speakeasy', 'craft-cocktails', 'date-night', 'retro', 'intimate'],
  true
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
VALUES ('jojos-beloved', 'Jojo''s Beloved', 'https://www.jojosbeloved.com', 'venue', 'monthly', false,
  (SELECT id FROM portals WHERE slug = 'atlanta'), 'none')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 3. Buddy Buddy — cocktail bar near the Beltline, Midtown
-- ============================================================
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website,
  description, vibes, active
) VALUES (
  'Buddy Buddy', 'buddy-buddy',
  '931 Monroe Dr NE, Ste C-106', 'Midtown', 'Atlanta', 'GA', '30308',
  33.7782, -84.3685, 'bar', 'bar',
  'https://www.buddybuddyatl.com',
  'Greek-inspired cocktail bar and restaurant at Midtown Promenade, steps from the Beltline. Playful riffs on classic cocktails, comfort food, and warm grandma''s-living-room decor.',
  ARRAY['craft-cocktails', 'date-night', 'neighborhood', 'cozy', 'beltline-adjacent'],
  true
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
VALUES ('buddy-buddy', 'Buddy Buddy', 'https://www.buddybuddyatl.com', 'venue', 'monthly', false,
  (SELECT id FROM portals WHERE slug = 'atlanta'), 'none')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 4. Strangers In Paradise — tiki bar at Lee + White, West End
-- ============================================================
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website,
  description, vibes, active
) VALUES (
  'Strangers In Paradise', 'strangers-in-paradise',
  '1020 White St SW, Ste B1', 'West End', 'Atlanta', 'GA', '30310',
  33.7358, -84.4109, 'bar', 'bar',
  'https://www.strangersinparadiseatl.com',
  'Tropical tiki cocktail bar at Lee + White along the Westside Beltline. Late-80s beachside resort vibes with frozen drinks, ceramic tiki mugs, and a palm leaf canopy. From Electric Hospitality (Ladybird, Muchacho).',
  ARRAY['craft-cocktails', 'tiki', 'tropical', 'outdoor-seating', 'date-night'],
  true
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
VALUES ('strangers-in-paradise', 'Strangers In Paradise', 'https://www.strangersinparadiseatl.com', 'venue', 'monthly', false,
  (SELECT id FROM portals WHERE slug = 'atlanta'), 'none')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 5. Hippin' Hops Brewery & Oyster Bar — GA's first Black-owned brewery
-- ============================================================
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website,
  description, vibes, active
) VALUES (
  'Hippin'' Hops Brewery & Oyster Bar', 'hippin-hops',
  '1308 Glenwood Ave SE', 'East Atlanta Village', 'Atlanta', 'GA', '30316',
  33.7403, -84.3448, 'brewery', 'brewery',
  'https://www.hippinhopsbrewery.com',
  'Georgia''s first Black-owned brick-and-mortar brewery. Brewpub and oyster bar with craft beer, fresh oysters, po''boys, and a beer garden with outdoor games.',
  ARRAY['brewery', 'craft-beer', 'outdoor-seating', 'games', 'community'],
  true
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
VALUES ('hippin-hops', 'Hippin'' Hops Brewery', 'https://www.hippinhopsbrewery.com', 'venue', 'monthly', false,
  (SELECT id FROM portals WHERE slug = 'atlanta'), 'none')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 6. ParkGrounds — cafe/bar with dog park, Reynoldstown
-- ============================================================
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website,
  description, vibes, active
) VALUES (
  'ParkGrounds', 'parkgrounds',
  '142 Flat Shoals Ave SE', 'Reynoldstown', 'Atlanta', 'GA', '30316',
  33.7445, -84.3520, 'bar', 'bar',
  'https://www.parkgroundsatl.com',
  'Neighborhood cafe by day, craft cocktail bar by night, with an integrated off-leash dog park. Open since 2010. Live music, frozen drinks, and a true Reynoldstown institution.',
  ARRAY['dog-friendly', 'outdoor-seating', 'neighborhood', 'live-music', 'brunch'],
  true
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
VALUES ('parkgrounds', 'ParkGrounds', 'https://www.parkgroundsatl.com', 'venue', 'monthly', false,
  (SELECT id FROM portals WHERE slug = 'atlanta'), 'none')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 7. Midtown Bowl — classic bowling alley since 1960
-- ============================================================
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website,
  description, vibes, active
) VALUES (
  'Midtown Bowl', 'midtown-bowl',
  '1936 Piedmont Cir NE', 'Midtown', 'Atlanta', 'GA', '30324',
  33.7983, -84.3622, 'recreation', 'recreation',
  'https://midtownbowl.com',
  'Atlanta''s classic 32-lane bowling alley operating since 1960. Full bar, arcade, pro shop, and late-night cosmic bowling. A Midtown institution.',
  ARRAY['bowling', 'games', 'late-night', 'retro', 'groups'],
  true
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
VALUES ('midtown-bowl', 'Midtown Bowl', 'https://midtownbowl.com', 'venue', 'monthly', false,
  (SELECT id FROM portals WHERE slug = 'atlanta'), 'none')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 8. Nite Owl Kitchen & Cocktails — Avondale Estates
-- ============================================================
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website,
  description, vibes, active
) VALUES (
  'Nite Owl Kitchen & Cocktails', 'nite-owl-kitchen',
  '6 Olive St, Ste 119', 'Avondale Estates', 'Avondale Estates', 'GA', '30002',
  33.7715, -84.2671, 'bar', 'bar',
  'https://niteowlkitchen.com',
  'Pizza and craft cocktail spot in the Olive & Pine food hall. Family friendly by day, live DJs and late-night vibes after dark. Covered patio. Open 7 days.',
  ARRAY['live-music', 'outdoor-seating', 'late-night', 'casual', 'groups'],
  true
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
VALUES ('nite-owl-kitchen', 'Nite Owl Kitchen & Cocktails', 'https://niteowlkitchen.com', 'venue', 'monthly', false,
  (SELECT id FROM portals WHERE slug = 'atlanta'), 'none')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 9. Anansi Cocktail Lounge — Avondale Estates / Decatur
-- ============================================================
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website,
  description, vibes, active
) VALUES (
  'Anansi Cocktail Lounge', 'anansi-cocktail-lounge',
  '2700 E College Ave, Ste 4000', 'Avondale Estates', 'Decatur', 'GA', '30030',
  33.7713, -84.2643, 'bar', 'bar',
  'https://anansiatl.com',
  'Black-owned intimate cocktail lounge with moody, sophisticated atmosphere. Craft cocktails, curated music, dim lighting. Named after Anansi the storyteller. Free parking.',
  ARRAY['craft-cocktails', 'date-night', 'intimate', 'late-night', 'Black-owned'],
  true
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
VALUES ('anansi-cocktail-lounge', 'Anansi Cocktail Lounge', 'https://anansiatl.com', 'venue', 'monthly', false,
  (SELECT id FROM portals WHERE slug = 'atlanta'), 'none')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 10. Sanctuary Nightclub — Latin nightclub (relocated to Alpharetta)
-- ============================================================
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website,
  description, vibes, active
) VALUES (
  'Sanctuary Nightclub', 'sanctuary-nightclub',
  '10595 Old Alabama Rd Connector', 'Alpharetta', 'Alpharetta', 'GA', '30022',
  34.0510, -84.2700, 'nightclub', 'nightclub',
  'https://www.sanctuarynightclub.com',
  'Atlanta''s longest-running Latin nightclub, established 1993. Weekly Latin Fridays with salsa, bachata, merengue, and reggaeton. Beginner salsa lessons before social dancing. Relocated from Buckhead to Alpharetta Jan 2026.',
  ARRAY['latin', 'salsa', 'bachata', 'dancing', 'late-night', 'nightclub'],
  true
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
VALUES ('sanctuary-nightclub', 'Sanctuary Nightclub', 'https://www.sanctuarynightclub.com', 'venue', 'monthly', true,
  (SELECT id FROM portals WHERE slug = 'atlanta'), 'python')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 11. Relapse Theatre — improv/sketch comedy, West Midtown
-- ============================================================
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website,
  description, vibes, active
) VALUES (
  'Relapse Theatre', 'relapse-theatre',
  '380 14th St NW', 'West Midtown', 'Atlanta', 'GA', '30318',
  33.7880, -84.4010, 'comedy_club', 'comedy_club',
  'https://www.relapsetheatre.com',
  'Atlanta''s home for improv, standup, and sketch comedy. Multiple shows nightly with a full-service bar featuring 200+ brands. Classes and workshops for aspiring performers.',
  ARRAY['comedy', 'improv', 'live-shows', 'late-night', 'fun'],
  true
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
VALUES ('relapse-theatre', 'Relapse Theatre', 'https://therelapsetheater-com.seatengine.com/events', 'venue', 'daily', true,
  (SELECT id FROM portals WHERE slug = 'atlanta'), 'python')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 12. Bob and Harriet's Home Bar — Kirkwood neighborhood bar
-- ============================================================
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website,
  description, vibes, active
) VALUES (
  'Bob and Harriet''s Home Bar', 'bob-and-harriets',
  '1992 Hosea L Williams Dr NE', 'Kirkwood', 'Atlanta', 'GA', '30317',
  33.7567, -84.3337, 'bar', 'bar',
  'https://www.homebaratl.com',
  'Kirkwood neighborhood gastropub serving breakfast, brunch, and dinner with a full bar. Cozy, homey atmosphere with outdoor seating.',
  ARRAY['neighborhood', 'brunch', 'gastropub', 'outdoor-seating', 'casual'],
  true
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
VALUES ('bob-and-harriets', 'Bob and Harriet''s Home Bar', 'https://www.homebaratl.com', 'venue', 'monthly', false,
  (SELECT id FROM portals WHERE slug = 'atlanta'), 'none')
ON CONFLICT (slug) DO NOTHING;
