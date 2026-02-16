-- Explore Tracks Data Cleanup
-- 1. Remove closed venues (Orpheus Brewing)
-- 2. Remove non-Atlanta venues (Nashville, Anaheim leaks)
-- 3. Remove address-only entries
-- 4. Enrich sparse tracks with real Atlanta venues
-- 5. Fix duplicate venue references (prefer venues with images)

-- ============================================================================
-- 1. REMOVE BAD VENUES FROM TRACKS
-- ============================================================================

-- Orpheus Brewing (closed) — venue_id 427
DELETE FROM explore_track_venues WHERE venue_id = 427;

-- 3rd & Lindsley (Nashville) — venue_ids 1390, 1521, 1648
DELETE FROM explore_track_venues WHERE venue_id IN (1390, 1521, 1648);

-- Art Urban Nashville — venue_id 1784
DELETE FROM explore_track_venues WHERE venue_id = 1784;

-- Angel Stadium (Anaheim, CA) — venue_id 2222
DELETE FROM explore_track_venues WHERE venue_id = 2222;

-- Address-only entries: find and remove venues whose names are just addresses
-- (These were pulled in by venue_type matching but have no real venue name)
DELETE FROM explore_track_venues
WHERE venue_id IN (
  SELECT v.id FROM venues v
  WHERE v.name ~ '^\d+ ' -- Starts with a number
    AND v.name !~ '[a-zA-Z]{4,}' -- No word longer than 3 chars (just street abbreviations)
    AND v.id IN (SELECT venue_id FROM explore_track_venues)
);

-- Also remove specific known address-only venues by pattern
DELETE FROM explore_track_venues
WHERE venue_id IN (
  SELECT v.id FROM venues v
  WHERE (
    v.name LIKE '%Baker Street' OR
    v.name LIKE '%Park Dr%' OR
    v.name LIKE '%Edgewood Ave%' OR
    v.name LIKE '%Hank Aaron Drive%'
  )
  AND v.venue_type IS NULL
  AND v.id IN (SELECT venue_id FROM explore_track_venues)
);

-- ============================================================================
-- 2. ENRICH "A Beautiful Mosaic" — International/Cultural
--    Track ID: 773457ae-e687-410d-a0d1-caaad0dcc570
-- ============================================================================

INSERT INTO explore_track_venues (track_id, venue_id, status, is_featured, editorial_blurb)
VALUES
  -- Buford Highway Farmers Market already mapped (id 1205)
  -- Korean BBQ
  ('773457ae-e687-410d-a0d1-caaad0dcc570', 703, 'approved', true,
   'Gwinnett''s Korean BBQ destination. All-you-can-eat galbi and bulgogi in a lively Duluth strip mall.'),
  ('773457ae-e687-410d-a0d1-caaad0dcc570', 1297, 'approved', false,
   'A Duluth staple for tabletop Korean BBQ with banchan that keeps coming.'),
  -- Vietnamese
  ('773457ae-e687-410d-a0d1-caaad0dcc570', 1303, 'approved', false,
   'Vietnamese banh mi and pho on the Buford Highway corridor.'),
  ('773457ae-e687-410d-a0d1-caaad0dcc570', 1304, 'approved', false,
   'Spicy, soul-warming bun bo hue in Duluth.'),
  -- Chinese
  ('773457ae-e687-410d-a0d1-caaad0dcc570', 1301, 'approved', true,
   'Dim sum institution. Weekend carts since the early days of Duluth''s Chinatown.'),
  ('773457ae-e687-410d-a0d1-caaad0dcc570', 1305, 'approved', false,
   'Hot pot done right. Duluth''s shabu-shabu spot for a cold night.'),
  -- Cafe culture
  ('773457ae-e687-410d-a0d1-caaad0dcc570', 1214, 'approved', false,
   'All-day Vietnamese cafe on the BuHi corridor. Pho and coffee.'),
  ('773457ae-e687-410d-a0d1-caaad0dcc570', 1308, 'approved', false,
   'European bakery in Duluth. Mozart on the speakers, strudel on the plate.'),
  -- Community
  ('773457ae-e687-410d-a0d1-caaad0dcc570', 3901, 'approved', false,
   'The heart of Pan Asian community services in Doraville.'),
  -- Clarkston
  ('773457ae-e687-410d-a0d1-caaad0dcc570', 719, 'approved', false,
   'Clarkston''s neighborhood pub. Where refugees and locals share a pint.')
ON CONFLICT (track_id, venue_id) DO NOTHING;

-- ============================================================================
-- 3. ENRICH "Too Busy to Hate" — LGBTQ+
--    Track ID: b24458eb-9c41-46a6-8626-ea406b951393
-- ============================================================================

INSERT INTO explore_track_venues (track_id, venue_id, status, is_featured, editorial_blurb)
VALUES
  -- My Sister's Room already mapped (id 570)
  -- Piedmont Park already mapped (id 120)
  -- Core LGBTQ+ bars and clubs
  ('b24458eb-9c41-46a6-8626-ea406b951393', 569, 'approved', true,
   'Atlanta''s legendary leather and dance club on Cheshire Bridge. Three decades strong.'),
  ('b24458eb-9c41-46a6-8626-ea406b951393', 571, 'approved', true,
   'East Atlanta''s queer dive bar. Drag shows, karaoke, and the best patio in EAV.'),
  ('b24458eb-9c41-46a6-8626-ea406b951393', 422, 'approved', true,
   'The Midtown mainstay. Blake''s patio has been the center of Atlanta''s LGBTQ+ nightlife since 1987.'),
  ('b24458eb-9c41-46a6-8626-ea406b951393', 639, 'approved', false,
   'Midtown sports bar and neighborhood hangout for the bear community.'),
  ('b24458eb-9c41-46a6-8626-ea406b951393', 939, 'approved', false,
   'Sleek Midtown lounge. Craft cocktails and a rooftop with a skyline view.'),
  ('b24458eb-9c41-46a6-8626-ea406b951393', 441, 'approved', false,
   'Chill neighborhood bar on Ponce. Pool tables, darts, and drag bingo.'),
  ('b24458eb-9c41-46a6-8626-ea406b951393', 443, 'approved', false,
   'Buckhead''s multi-level LGBTQ+ dance club. Theme nights and go-go dancers.'),
  ('b24458eb-9c41-46a6-8626-ea406b951393', 574, 'approved', false,
   'No-frills Midtown neighborhood bar. Cash only, strong pours.'),
  -- Pride orgs
  ('b24458eb-9c41-46a6-8626-ea406b951393', 419, 'approved', false,
   'Organizers of the Atlanta Pride Festival, one of the largest in the Southeast.'),
  ('b24458eb-9c41-46a6-8626-ea406b951393', 1104, 'approved', false,
   'Southern Fried Queer Pride celebrates QTPOC art, music, and community.')
ON CONFLICT (track_id, venue_id) DO NOTHING;

-- ============================================================================
-- 4. ENRICH "The Midnight Train" — Weird/Quirky
--    Track ID: 4209a846-2fd7-4b1e-8a2d-ad14dc638ec2
-- ============================================================================

INSERT INTO explore_track_venues (track_id, venue_id, status, is_featured, editorial_blurb)
VALUES
  -- Clermont Lounge already mapped (id 825)
  -- Oakland Cemetery already mapped (id 135)
  ('4209a846-2fd7-4b1e-8a2d-ad14dc638ec2', 2354, 'approved', true,
   'L5P''s emporium of the bizarre. Vintage oddities, punk gear, and things you didn''t know you needed.'),
  ('4209a846-2fd7-4b1e-8a2d-ad14dc638ec2', 1096, 'approved', true,
   'Doraville''s cabinet of curiosities. Taxidermy, medical antiques, and the genuinely unsettling.'),
  ('4209a846-2fd7-4b1e-8a2d-ad14dc638ec2', 1687, 'approved', true,
   'Church-themed bar with outsider art floor to ceiling. The Church Lady serves communion wine.'),
  ('4209a846-2fd7-4b1e-8a2d-ad14dc638ec2', 1708, 'approved', true,
   'One of the last drive-in theaters in America. Double features under the stars since 1949.'),
  ('4209a846-2fd7-4b1e-8a2d-ad14dc638ec2', 256, 'approved', false,
   'Board game bar meets craft beer. Hundreds of games, LAN parties, and trivia nights.'),
  ('4209a846-2fd7-4b1e-8a2d-ad14dc638ec2', 257, 'approved', false,
   'Retro arcade bar downtown. Classic cabinets, craft cocktails, and a DJ booth.'),
  ('4209a846-2fd7-4b1e-8a2d-ad14dc638ec2', 264, 'approved', false,
   'West Midtown''s bowling-meets-bocce playground. Duckpin lanes and a rooftop.'),
  ('4209a846-2fd7-4b1e-8a2d-ad14dc638ec2', 1184, 'approved', false,
   'The skull-faced bar of Little Five Points. Burgers the size of your head.'),
  ('4209a846-2fd7-4b1e-8a2d-ad14dc638ec2', 726, 'approved', false,
   'MODA — Museum of Design Atlanta. Rotating exhibits on architecture, fashion, and the built world.'),
  ('4209a846-2fd7-4b1e-8a2d-ad14dc638ec2', 1142, 'approved', false,
   'Brewpub in a Victorian mansion. Craft beer brewed in the basement, served on the porch.'),
  ('4209a846-2fd7-4b1e-8a2d-ad14dc638ec2', 337, 'approved', false,
   'L5P''s indie record shop. Vinyl, zines, and the pulse of Atlanta''s underground music scene.')
ON CONFLICT (track_id, venue_id) DO NOTHING;

-- ============================================================================
-- 5. FIX DUPLICATE/MISSING IMAGE VENUE REFERENCES
-- ============================================================================

-- National Center for Civil and Human Rights: remove entries with id 402 (no image),
-- keep/add entries with id 557 (has image)
DELETE FROM explore_track_venues WHERE venue_id = 402;

-- The Varsity: remove entries with id 3185 (no image), keep id 1181 (has image)
DELETE FROM explore_track_venues WHERE venue_id = 3185;

-- ============================================================================
-- 6. ADD KEY MISSING VENUES TO EXISTING TRACKS
-- ============================================================================

-- Welcome to Atlanta: add Center for Civil and Human Rights (557, has image)
INSERT INTO explore_track_venues (track_id, venue_id, status, is_featured, editorial_blurb)
VALUES ('ea637b45-175e-4cfc-8939-ffabc4794f3d', 557, 'approved', true,
  'The story of the global human rights movement, from Atlanta''s civil rights legacy to today.')
ON CONFLICT (track_id, venue_id) DO NOTHING;

-- Keep Moving Forward: replace Orpheus with Wrecking Bar Brewpub (1142)
INSERT INTO explore_track_venues (track_id, venue_id, status, is_featured, editorial_blurb)
VALUES ('069ab40d-88db-441e-a0e1-bb21d83678a4', 1142, 'approved', false,
  'Victorian mansion turned brewpub, steps from the BeltLine Eastside Trail.')
ON CONFLICT (track_id, venue_id) DO NOTHING;

-- Keep Swinging: remove Angel Stadium (done above), ensure Truist Park (103) stays
-- No action needed — Truist Park should already be mapped

-- Life's Like a Movie: add Starlight Drive-In (1708)
INSERT INTO explore_track_venues (track_id, venue_id, status, is_featured, editorial_blurb)
VALUES ('c74fe2af-37a6-447c-97e8-7b71b7d18c13', 1708, 'approved', false,
  'Double features under the stars. One of America''s last drive-in theaters.')
ON CONFLICT (track_id, venue_id) DO NOTHING;
