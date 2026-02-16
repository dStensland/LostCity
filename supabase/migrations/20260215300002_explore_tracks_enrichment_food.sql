-- ============================================================================
-- Explore Tracks Enrichment: Food & Culture (Batch 2)
-- Research source: Eater Atlanta, James Beard Foundation, Michelin Guide,
-- Infatuation, Anthony Bourdain's "The Layover"
-- ============================================================================

-- ============================================================================
-- 1. THE ITIS (Food) — Track: 2b806016-83c0-4726-a4ff-c06c8217decc
-- ============================================================================

INSERT INTO explore_track_venues (track_id, venue_id, status, is_featured, editorial_blurb)
VALUES
  -- Twisted Soul Cookhouse & Pours (689) — James Beard nominated
  ('2b806016-83c0-4726-a4ff-c06c8217decc', 689, 'approved', true,
   'James Beard-nominated Chef Deborah VanTrece. Modern soul food that made the NY Times'' 25 Best.'),
  -- Northern China Eatery (1213) — Bourdain-approved, Buford Hwy
  ('2b806016-83c0-4726-a4ff-c06c8217decc', 1213, 'approved', false,
   'Hand-pulled dumplings on Buford Highway. Anthony Bourdain ate here on The Layover.'),
  -- Kamayan ATL (697) — Michelin recommended Filipino
  ('2b806016-83c0-4726-a4ff-c06c8217decc', 697, 'approved', false,
   'Michelin-recommended Filipino. Angus beef kaldereta and kamayan feasts on Buford Highway.'),
  -- Virgil's Gullah Kitchen & Bar (1255) — Gullah Geechee
  ('2b806016-83c0-4726-a4ff-c06c8217decc', 1255, 'approved', false,
   'Gullah Geechee soul food in College Park. Culture and community on every plate.')
ON CONFLICT (track_id, venue_id) DO NOTHING;

-- ============================================================================
-- 2. GOOD TROUBLE (Civil Rights) — Track: 86673311-92c8-4c0f-908f-3c4c54c1ec2c
--    Paschal's is a civil rights landmark
-- ============================================================================

INSERT INTO explore_track_venues (track_id, venue_id, status, is_featured, editorial_blurb)
VALUES
  -- Paschal's (3207) — MLK planned the Montgomery Bus Boycott here
  ('86673311-92c8-4c0f-908f-3c4c54c1ec2c', 3207, 'approved', true,
   'Where MLK planned the Montgomery Bus Boycott. The unofficial headquarters of the movement since 1947.')
ON CONFLICT (track_id, venue_id) DO NOTHING;

-- Also add Paschal's to The Itis for its food significance
INSERT INTO explore_track_venues (track_id, venue_id, status, is_featured, editorial_blurb)
VALUES
  ('2b806016-83c0-4726-a4ff-c06c8217decc', 3207, 'approved', false,
   'Fried chicken that fueled a movement. Open since 1947, the soul food here is history on a plate.')
ON CONFLICT (track_id, venue_id) DO NOTHING;

-- ============================================================================
-- 3. A BEAUTIFUL MOSAIC (International) — Track: 773457ae-e687-410d-a0d1-caaad0dcc570
-- ============================================================================

INSERT INTO explore_track_venues (track_id, venue_id, status, is_featured, editorial_blurb)
VALUES
  -- Honey Pig Korean BBQ (1296) — Duluth
  ('773457ae-e687-410d-a0d1-caaad0dcc570', 1296, 'approved', false,
   'Cauldron-lid Korean BBQ. The only one in Georgia. Unlimited banchan in Duluth.'),
  -- Bole Ethiopian (1260) — College Park
  ('773457ae-e687-410d-a0d1-caaad0dcc570', 1260, 'approved', false,
   'Strip mall gem in College Park. The sampler platter is a tour of Ethiopian flavors.'),
  -- Kamayan ATL (697) — Filipino on Buford Hwy
  ('773457ae-e687-410d-a0d1-caaad0dcc570', 697, 'approved', false,
   'Michelin-recommended Filipino. Kamayan feasts where everyone eats with their hands.'),
  -- Northern China Eatery (1213) — Doraville
  ('773457ae-e687-410d-a0d1-caaad0dcc570', 1213, 'approved', false,
   'Bourdain came here for the hand-pulled dumplings. Now two locations, still extraordinary.'),
  -- Virgil's Gullah Kitchen (1255)
  ('773457ae-e687-410d-a0d1-caaad0dcc570', 1255, 'approved', false,
   'Gullah Geechee cuisine meets queer community in College Park. Culture at every table.')
ON CONFLICT (track_id, venue_id) DO NOTHING;
