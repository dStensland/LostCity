-- Migration: Seed high-profile Atlanta restaurants and bars
-- These are editorially-validated venues from Eater, The Infatuation, Rough Draft.
-- Tier 1: Places that define Atlanta's food scene and are actively covered by press.

-- Kimball House (Decatur) — James Beard-nominated oyster bar + cocktails
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng,
  venue_type, spot_type, website, description, vibes, active)
VALUES (
  'Kimball House', 'kimball-house', '303 E Howard Ave', 'Decatur', 'Atlanta', 'GA', '30030',
  33.7748, -84.2963,
  'cocktail_bar', 'bar',
  'https://www.kimball-house.com',
  'James Beard-nominated oyster bar and cocktail lounge in a restored Victorian railway depot. Known for its exceptional raw bar, absinthe service, and craft cocktails.',
  ARRAY['date-spot', 'upscale', 'cocktail-focused', 'oyster-bar'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- Little Spirit (Inman Park) — natural wine bar from Kimball House team
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng,
  venue_type, spot_type, website, description, vibes, active)
VALUES (
  'Little Spirit', 'little-spirit', '1399 Dekalb Ave NE', 'Inman Park', 'Atlanta', 'GA', '30307',
  33.7623, -84.3524,
  'wine_bar', 'bar',
  'https://www.littlespiritatl.com',
  'Natural wine bar and restaurant from the Kimball House team. Small plates, curated wine list, and cocktails in a cozy Inman Park setting.',
  ARRAY['intimate', 'natural-wine', 'date-spot'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- 8ARM (Poncey-Highland) — plant-forward, Infatuation favorite
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng,
  venue_type, spot_type, website, description, vibes, active)
VALUES (
  '8ARM', '8arm', '710 Ponce De Leon Ave NE', 'Poncey-Highland', 'Atlanta', 'GA', '30306',
  33.7736, -84.3615,
  'restaurant', 'restaurant',
  'https://www.8armatl.com',
  'Plant-forward restaurant with a creative seasonal menu. Part restaurant, part art gallery, part event space on the Ponce corridor.',
  ARRAY['creative', 'plant-forward', 'artsy'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- Empire State South (Midtown) — Hugh Acheson flagship
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng,
  venue_type, spot_type, website, description, vibes, active)
VALUES (
  'Empire State South', 'empire-state-south', '999 Peachtree St NE', 'Midtown', 'Atlanta', 'GA', '30309',
  33.7816, -84.3830,
  'restaurant', 'restaurant',
  'https://www.empirestatesouth.com',
  'James Beard Award-winning chef Hugh Acheson''s Midtown flagship. Southern-inspired menu with craft cocktails and a buzzy patio scene.',
  ARRAY['upscale', 'patio', 'southern', 'brunch-spot'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- Venkman's (Old Fourth Ward) — live music + dining
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng,
  venue_type, spot_type, website, description, vibes, active)
VALUES (
  'Venkman''s', 'venkmans', '740 Ralph McGill Blvd NE', 'Old Fourth Ward', 'Atlanta', 'GA', '30312',
  33.7613, -84.3722,
  'restaurant', 'restaurant',
  'https://www.venkmans.com',
  'Dinner-and-a-show concept in O4W with Southern comfort food and live music. Named after the Ghostbusters character.',
  ARRAY['live-music', 'good-for-groups', 'lively'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- The Lawrence (Midtown) — longtime neighborhood bar
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng,
  venue_type, spot_type, website, description, vibes, active)
VALUES (
  'The Lawrence', 'the-lawrence', '905 Juniper St NE', 'Midtown', 'Atlanta', 'GA', '30309',
  33.7790, -84.3810,
  'bar', 'bar',
  'https://www.thelawrenceatl.com',
  'Laid-back Midtown neighborhood bar with a spacious covered patio, craft beer, and bar food. A favorite local hangout.',
  ARRAY['patio', 'casual', 'neighborhood-bar'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- Companion (West Midtown) — critically acclaimed
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng,
  venue_type, spot_type, website, description, vibes, active)
VALUES (
  'Companion', 'companion', '1485 Howell Mill Rd NW', 'West Midtown', 'Atlanta', 'GA', '30318',
  33.7950, -84.4115,
  'restaurant', 'restaurant',
  'https://www.companionatl.com',
  'Critically acclaimed West Midtown restaurant from chef Nolan McKelvey. Seasonal American cuisine, fresh-baked bread, and an acclaimed brunch.',
  ARRAY['brunch-spot', 'seasonal', 'creative'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- Ammazza (Inman Park) — best pizza
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng,
  venue_type, spot_type, website, description, vibes, active)
VALUES (
  'Ammazza', 'ammazza', '591 Edgewood Ave NE', 'Inman Park', 'Atlanta', 'GA', '30312',
  33.7580, -84.3550,
  'restaurant', 'restaurant',
  'https://www.ammazza.com',
  'Wood-fired Neapolitan pizza in Inman Park. Cozy space with an excellent beer and wine selection.',
  ARRAY['casual', 'date-spot', 'good-for-groups'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- Noni's Bar & Deli (Edgewood) — late-night institution
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng,
  venue_type, spot_type, website, description, vibes, active)
VALUES (
  'Noni''s Bar & Deli', 'nonis-bar-and-deli', '357 Edgewood Ave SE', 'Old Fourth Ward', 'Atlanta', 'GA', '30312',
  33.7569, -84.3670,
  'bar', 'bar',
  'https://www.nonisatl.com',
  'Late-night Italian-inspired bar and deli on Edgewood Ave. Known for its sandwiches, DJ nights, and being open until 3am.',
  ARRAY['late-night', 'lively', 'dance-floor'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- Slutty Vegan (West End) — nationally known ATL brand
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng,
  venue_type, spot_type, website, description, vibes, active)
VALUES (
  'Slutty Vegan', 'slutty-vegan', '1542 Ralph David Abernathy Blvd', 'West End', 'Atlanta', 'GA', '30310',
  33.7387, -84.4155,
  'restaurant', 'restaurant',
  'https://www.sluttyveganatl.com',
  'Nationally famous plant-based burger joint founded by Pinky Cole in Atlanta. Known for creative vegan burgers and a party-like atmosphere.',
  ARRAY['casual', 'lively', 'plant-forward'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- Eggslut (Midtown / Colony Square) — Infatuation reviewed
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng,
  venue_type, spot_type, website, description, vibes, active)
VALUES (
  'Eggslut', 'eggslut', '800 Peachtree St NE', 'Midtown', 'Atlanta', 'GA', '30308',
  33.7793, -84.3836,
  'restaurant', 'restaurant',
  'https://www.eggslut.com',
  'LA-born egg sandwich concept at Colony Square. Known for the Fairfax sandwich and Slut (coddled egg on potato puree).',
  ARRAY['casual', 'brunch-spot', 'quick-bite'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- SOS Tiki Bar (Midtown) — cocktail destination
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng,
  venue_type, spot_type, website, description, vibes, active)
VALUES (
  'SOS Tiki Bar', 'sos-tiki-bar', '340 Church St NE', 'Midtown', 'Atlanta', 'GA', '30313',
  33.7771, -84.3773,
  'cocktail_bar', 'bar',
  'https://www.sostiki.com',
  'Tropical tiki bar in Midtown with expertly crafted rum cocktails, a lush patio, and a transportive atmosphere.',
  ARRAY['tropical', 'cocktail-focused', 'patio', 'date-spot'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- Good Word Brewing (Decatur) — craft beer staple
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng,
  venue_type, spot_type, website, description, vibes, active)
VALUES (
  'Good Word Brewing', 'good-word-brewing', '821 W College Ave', 'Decatur', 'Atlanta', 'GA', '30030',
  33.7720, -84.3070,
  'brewery', 'bar',
  'https://www.goodwordbrewing.com',
  'Community-focused brewery in Decatur with a solid tap list and food menu. Spacious indoor/outdoor seating.',
  ARRAY['casual', 'good-for-groups', 'dog-friendly'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- Lazy Betty (Summerhill) — tasting menu destination
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng,
  venue_type, spot_type, website, description, vibes, active)
VALUES (
  'Lazy Betty', 'lazy-betty', '1530 Dekalb Ave NE', 'Summerhill', 'Atlanta', 'GA', '30307',
  33.7600, -84.3480,
  'restaurant', 'restaurant',
  'https://www.lazybettyatl.com',
  'Modern American tasting menu restaurant with Korean influences. One of Atlanta''s most celebrated fine dining experiences.',
  ARRAY['upscale', 'date-spot', 'tasting-menu'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- Ticonderoga Club (Krog Street Market) — cocktail institution
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng,
  venue_type, spot_type, website, description, vibes, active)
VALUES (
  'Ticonderoga Club', 'ticonderoga-club', '99 Krog St NE Ste W', 'Inman Park', 'Atlanta', 'GA', '30307',
  33.7590, -84.3630,
  'cocktail_bar', 'bar',
  'https://www.ticonderogaclub.com',
  'Acclaimed cocktail bar and tavern in Krog Street Market. Classic cocktails, hearty tavern food, and a rotating seasonal menu.',
  ARRAY['cocktail-focused', 'intimate', 'date-spot'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- Spread Bagelry (Ponce) — Infatuation reviewed
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng,
  venue_type, spot_type, website, description, vibes, active)
VALUES (
  'Spread Bagelry', 'spread-bagelry', '695 Ponce De Leon Ave NE', 'Poncey-Highland', 'Atlanta', 'GA', '30308',
  33.7731, -84.3624,
  'restaurant', 'restaurant',
  'https://www.spreadbagelry.com',
  'Atlanta''s bagel destination. Hand-rolled, New York-style bagels with creative schmears and sandwiches.',
  ARRAY['casual', 'brunch-spot', 'quick-bite'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- Register inactive sources for venues (no crawlable event pages)
INSERT INTO sources (name, slug, url, source_type, is_active, integration_method, owner_portal_id)
SELECT 'Kimball House', 'kimball-house', 'https://www.kimball-house.com', 'venue', false, 'none',
  (SELECT id FROM portals WHERE slug = 'atlanta')
WHERE NOT EXISTS (SELECT 1 FROM sources WHERE slug = 'kimball-house');

INSERT INTO sources (name, slug, url, source_type, is_active, integration_method, owner_portal_id)
SELECT 'Little Spirit', 'little-spirit', 'https://www.littlespiritatl.com', 'venue', false, 'none',
  (SELECT id FROM portals WHERE slug = 'atlanta')
WHERE NOT EXISTS (SELECT 1 FROM sources WHERE slug = 'little-spirit');

INSERT INTO sources (name, slug, url, source_type, is_active, integration_method, owner_portal_id)
SELECT '8ARM', '8arm', 'https://www.8armatl.com', 'venue', false, 'none',
  (SELECT id FROM portals WHERE slug = 'atlanta')
WHERE NOT EXISTS (SELECT 1 FROM sources WHERE slug = '8arm');

INSERT INTO sources (name, slug, url, source_type, is_active, integration_method, owner_portal_id)
SELECT 'Empire State South', 'empire-state-south', 'https://www.empirestatesouth.com', 'venue', false, 'none',
  (SELECT id FROM portals WHERE slug = 'atlanta')
WHERE NOT EXISTS (SELECT 1 FROM sources WHERE slug = 'empire-state-south');

INSERT INTO sources (name, slug, url, source_type, is_active, integration_method, owner_portal_id)
SELECT 'Slutty Vegan', 'slutty-vegan', 'https://www.sluttyveganatl.com', 'venue', false, 'none',
  (SELECT id FROM portals WHERE slug = 'atlanta')
WHERE NOT EXISTS (SELECT 1 FROM sources WHERE slug = 'slutty-vegan');

INSERT INTO sources (name, slug, url, source_type, is_active, integration_method, owner_portal_id)
SELECT 'Lazy Betty', 'lazy-betty', 'https://www.lazybettyatl.com', 'venue', false, 'none',
  (SELECT id FROM portals WHERE slug = 'atlanta')
WHERE NOT EXISTS (SELECT 1 FROM sources WHERE slug = 'lazy-betty');

INSERT INTO sources (name, slug, url, source_type, is_active, integration_method, owner_portal_id)
SELECT 'Ticonderoga Club', 'ticonderoga-club', 'https://www.ticonderogaclub.com', 'venue', false, 'none',
  (SELECT id FROM portals WHERE slug = 'atlanta')
WHERE NOT EXISTS (SELECT 1 FROM sources WHERE slug = 'ticonderoga-club');
