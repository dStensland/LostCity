-- ============================================================================
-- Explore Tracks Enrichment Migration
-- Adds iconic venues identified via Atlas Obscura, Eater, Thrillist,
-- Discover Atlanta, and other curated source research.
-- Focuses on sparse tracks and high-value missing venues.
-- ============================================================================

-- ============================================================================
-- 1. THE ITIS (Food/Drink) — Track: 2b806016-83c0-4726-a4ff-c06c8217decc
--    Currently 10 venues. Adding James Beard winners, Michelin picks,
--    and culture-defining restaurants.
-- ============================================================================

INSERT INTO explore_track_venues (track_id, venue_id, status, is_featured, editorial_blurb)
VALUES
  -- Staplehouse (674) — Michelin, O4W
  ('2b806016-83c0-4726-a4ff-c06c8217decc', 674, 'approved', true,
   'Bon Appetit''s #1 restaurant in America. Proceeds support the Giving Kitchen.'),
  -- BoccaLupo (676) — Michelin, Inman Park
  ('2b806016-83c0-4726-a4ff-c06c8217decc', 676, 'approved', true,
   'Handmade pasta in Inman Park. Chef Bruce Logue questions what Italian-American cooking can be.'),
  -- Miller Union (685) — James Beard, Westside
  ('2b806016-83c0-4726-a4ff-c06c8217decc', 685, 'approved', true,
   'James Beard Award-winning seasonal Southern cooking. Chef Satterfield''s farm-to-table flagship.'),
  -- Gunshow (671) — Kevin Gillespie, Glenwood Park
  ('2b806016-83c0-4726-a4ff-c06c8217decc', 671, 'approved', true,
   'Top Chef''s Kevin Gillespie. Chefs bring dishes to your table dim-sum style. Every night is different.'),
  -- Home Grown (1173) — Reynoldstown
  ('2b806016-83c0-4726-a4ff-c06c8217decc', 1173, 'approved', false,
   'Southern breakfast institution on Memorial Drive. Farm-to-table before it was a buzzword.'),
  -- Desta Ethiopian Kitchen (692)
  ('2b806016-83c0-4726-a4ff-c06c8217decc', 692, 'approved', false,
   'Two locations. Injera and doro wot that''s been anchoring Atlanta''s Ethiopian scene since 2006.'),
  -- Brick Store Pub (911) — Decatur
  ('2b806016-83c0-4726-a4ff-c06c8217decc', 911, 'approved', false,
   'Knighted by the Belgian Brewers Guild. 900+ vintages and a secret Belgian beer bar upstairs.'),
  -- Arepa Mia (2526) — Avondale Estates
  ('2b806016-83c0-4726-a4ff-c06c8217decc', 2526, 'approved', false,
   'Back-to-back Michelin Bib Gourmand. 100% gluten-free Venezuelan arepas from Georgia farms.')
ON CONFLICT (track_id, venue_id) DO NOTHING;

-- ============================================================================
-- 2. GOOD TROUBLE (Civil Rights) — Track: 86673311-92c8-4c0f-908f-3c4c54c1ec2c
--    Currently 6 venues. Adding major MLK sites and civil rights landmarks.
-- ============================================================================

INSERT INTO explore_track_venues (track_id, venue_id, status, is_featured, editorial_blurb)
VALUES
  -- The King Center (986) — currently only in Tomorrow Is Another Day
  ('86673311-92c8-4c0f-908f-3c4c54c1ec2c', 986, 'approved', true,
   'The final resting place of Dr. and Mrs. King. Established by Coretta Scott King in 1968.'),
  -- The Carter Center (1236)
  ('86673311-92c8-4c0f-908f-3c4c54c1ec2c', 1236, 'approved', false,
   'President Carter''s center for peace and human rights. A quiet place of reflection in O4W.')
ON CONFLICT (track_id, venue_id) DO NOTHING;

-- ============================================================================
-- 3. TOO BUSY TO HATE (LGBTQ+) — Track: b24458eb-9c41-46a6-8626-ea406b951393
--    Currently 12 venues. Adding the historic Atlanta Eagle and drag venues.
-- ============================================================================

INSERT INTO explore_track_venues (track_id, venue_id, status, is_featured, editorial_blurb)
VALUES
  -- Atlanta Eagle (572) — FIRST LGBTQ+ historic landmark in the Deep South
  ('b24458eb-9c41-46a6-8626-ea406b951393', 572, 'approved', true,
   'First LGBTQ+ venue designated a historic landmark in the Deep South. Where RuPaul got started.'),
  -- Lips Atlanta (575) — drag dining
  ('b24458eb-9c41-46a6-8626-ea406b951393', 575, 'approved', true,
   'Vegas-style drag shows five nights a week. Georgia''s top queens serve dinner and spectacle.'),
  -- Future Atlanta (573) — drag cabaret
  ('b24458eb-9c41-46a6-8626-ea406b951393', 573, 'approved', false,
   'Fantasy Girls Drag Cabaret hosted by Drag Race alum Phoenix. High-energy with international DJs.'),
  -- Lore (2065)
  ('b24458eb-9c41-46a6-8626-ea406b951393', 2065, 'approved', false,
   'The new kid on the block. Drag bingo, day parties, karaoke, and even BYO crafting night.')
ON CONFLICT (track_id, venue_id) DO NOTHING;

-- ============================================================================
-- 4. WELCOME TO ATLANTA — Track: ea637b45-175e-4cfc-8939-ffabc4794f3d
--    Currently 9 venues. Adding can't-miss landmarks.
-- ============================================================================

INSERT INTO explore_track_venues (track_id, venue_id, status, is_featured, editorial_blurb)
VALUES
  -- Fox Theatre (119) — iconic Atlanta landmark
  ('ea637b45-175e-4cfc-8939-ffabc4794f3d', 119, 'approved', true,
   'The Fabulous Fox. A 1929 Moorish movie palace that''s become Atlanta''s most beloved stage.'),
  -- The Carter Center (1236)
  ('ea637b45-175e-4cfc-8939-ffabc4794f3d', 1236, 'approved', false,
   'Founded by President Jimmy Carter. 35 acres of gardens and a museum on Copenhill.'),
  -- The King Center (986)
  ('ea637b45-175e-4cfc-8939-ffabc4794f3d', 986, 'approved', false,
   'Where the civil rights movement lives. The final resting place of Dr. King.')
ON CONFLICT (track_id, venue_id) DO NOTHING;

-- ============================================================================
-- 5. KEEP MOVING FORWARD (BeltLine) — Track: 069ab40d-88db-441e-a0e1-bb21d83678a4
--    Currently only 5 venues! The sparsest track. Adding BeltLine-adjacent spots.
-- ============================================================================

INSERT INTO explore_track_venues (track_id, venue_id, status, is_featured, editorial_blurb)
VALUES
  -- Chattahoochee Food Works (67) — West Midtown food hall
  ('069ab40d-88db-441e-a0e1-bb21d83678a4', 67, 'approved', false,
   'The Westside Trail''s food hall. 20+ vendors in a restored warehouse on the Chattahoochee.'),
  -- Home Grown (1173) — near Eastside Trail
  ('069ab40d-88db-441e-a0e1-bb21d83678a4', 1173, 'approved', false,
   'Just off the Eastside Trail in Reynoldstown. Southern breakfast done right since 2008.'),
  -- Staplehouse (674) — Edgewood/O4W near BeltLine
  ('069ab40d-88db-441e-a0e1-bb21d83678a4', 674, 'approved', false,
   'Steps from the Eastside Trail. O4W''s neighborhood gem that put Atlanta on the national food map.'),
  -- BoccaLupo (676) — Inman Park, right on BeltLine
  ('069ab40d-88db-441e-a0e1-bb21d83678a4', 676, 'approved', true,
   'Handmade pasta on Edgewood Ave, a few steps from the BeltLine''s Inman Park segment.'),
  -- Three Taverns Imaginarium (33) — Cabbagetown, near Eastside Trail
  ('069ab40d-88db-441e-a0e1-bb21d83678a4', 33, 'approved', false,
   'Three Taverns'' experimental brewery at Atlanta Dairies. Two blocks off the BeltLine.'),
  -- 529 (206) — EAV, near future Southeast Trail
  ('069ab40d-88db-441e-a0e1-bb21d83678a4', 206, 'approved', false,
   'EAV''s musician-owned indie venue. Punk, metal, and DJ nights six days a week.')
ON CONFLICT (track_id, venue_id) DO NOTHING;

-- ============================================================================
-- 6. LIFES LIKE A MOVIE (Film/Entertainment) — Track: c74fe2af-37a6-447c-97e8-7b71b7d18c13
--    Currently 7 venues. Adding theme parks and film landmarks.
-- ============================================================================

INSERT INTO explore_track_venues (track_id, venue_id, status, is_featured, editorial_blurb)
VALUES
  -- Six Flags Over Georgia (890)
  ('c74fe2af-37a6-447c-97e8-7b71b7d18c13', 890, 'approved', false,
   'The Southeast''s biggest theme park. 11 coasters and a rooftop water park since 1967.'),
  -- Fox Theatre (119) — 1929 movie palace
  ('c74fe2af-37a6-447c-97e8-7b71b7d18c13', 119, 'approved', true,
   'A 1929 Moorish movie palace with a ceiling of twinkling stars. Still screening films and hosting premieres.')
ON CONFLICT (track_id, venue_id) DO NOTHING;

-- ============================================================================
-- 7. THE DEVIL WENT DOWN TO GEORGIA (Beer) — Track: 4c034ef2-a865-466b-9735-2385606bc036
--    Currently 45 venues. Adding the world-class beer bar.
-- ============================================================================

INSERT INTO explore_track_venues (track_id, venue_id, status, is_featured, editorial_blurb)
VALUES
  -- Brick Store Pub (911)
  ('4c034ef2-a865-466b-9735-2385606bc036', 911, 'approved', true,
   'Knighted by the Belgian Brewers Guild. Secret upstairs Belgian bar with 120+ bottles and proper glassware.')
ON CONFLICT (track_id, venue_id) DO NOTHING;

-- ============================================================================
-- 8. HARD IN DA PAINT (Hip-Hop/Nightlife) — Track: 5601c078-2327-48fc-800f-87c03b1cc363
--    Currently 80 venues. Adding key missing venues.
-- ============================================================================

INSERT INTO explore_track_venues (track_id, venue_id, status, is_featured, editorial_blurb)
VALUES
  -- Fox Theatre (119) — has hosted countless hip-hop events
  ('5601c078-2327-48fc-800f-87c03b1cc363', 119, 'approved', false,
   'The Fabulous Fox has hosted everyone from OutKast to Lil Wayne on its legendary Midtown stage.')
ON CONFLICT (track_id, venue_id) DO NOTHING;

-- ============================================================================
-- 9. THE MIDNIGHT TRAIN (Quirky) — Track: 4209a846-2fd7-4b1e-8a2d-ad14dc638ec2
--    Currently 13 venues. Adding quirky food/drink.
-- ============================================================================

INSERT INTO explore_track_venues (track_id, venue_id, status, is_featured, editorial_blurb)
VALUES
  -- Brick Store Pub (911) — secret Belgian bar
  ('4209a846-2fd7-4b1e-8a2d-ad14dc638ec2', 911, 'approved', false,
   'Ask for the Belgian bar upstairs. Unmarked door, proper glassware, and 900 vintages of rare beer.'),
  -- Constitution Lakes / Doll's Head Trail (315)
  ('4209a846-2fd7-4b1e-8a2d-ad14dc638ec2', 315, 'approved', true,
   'Home of the Doll''s Head Trail. Found-object sculptures in a surreal wetland park.')
ON CONFLICT (track_id, venue_id) DO NOTHING;
