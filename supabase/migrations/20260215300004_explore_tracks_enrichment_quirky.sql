-- ============================================================================
-- Explore Tracks Enrichment: Quirky & Hidden Gems (Batch 4)
-- Research source: Atlas Obscura, Unexpected Atlanta, local blogs
-- ============================================================================

-- ============================================================================
-- 1. THE MIDNIGHT TRAIN (Quirky) — Track: 4209a846-2fd7-4b1e-8a2d-ad14dc638ec2
-- ============================================================================

INSERT INTO explore_track_venues (track_id, venue_id, status, is_featured, editorial_blurb)
VALUES
  -- The Goat Farm (2076) — 19th century cotton mill turned artist compound
  ('4209a846-2fd7-4b1e-8a2d-ad14dc638ec2', 2076, 'approved', true,
   '19th-century cotton mill turned artist compound. 300+ studios, immersive events, and actual goats.'),
  -- Plaza Theatre (197) — oldest indie theater since 1939
  ('4209a846-2fd7-4b1e-8a2d-ad14dc638ec2', 197, 'approved', true,
   'Atlanta''s oldest indie theater since 1939. Rocky Horror shadow casts and one of 4 VistaVision screens on Earth.'),
  -- Dad's Garage Theatre (99) — improv in a converted church
  ('4209a846-2fd7-4b1e-8a2d-ad14dc638ec2', 99, 'approved', false,
   'Improv comedy in a converted church. Alumni include Archer and Adult Swim voice actors.'),
  -- Westside Park / Bellwood Quarry (307)
  ('4209a846-2fd7-4b1e-8a2d-ad14dc638ec2', 307, 'approved', false,
   'Atlanta''s largest park around a century-old granite quarry. The Walking Dead filmed here.')
ON CONFLICT (track_id, venue_id) DO NOTHING;

-- ============================================================================
-- 2. CITY IN A FOREST (Parks) — Track: 1c53fa05-4f8c-46b7-a2e1-a0cfc8a056c8
--    Westside Park is a major urban park
-- ============================================================================

INSERT INTO explore_track_venues (track_id, venue_id, status, is_featured, editorial_blurb)
VALUES
  ('1c53fa05-4f8c-46b7-a2e1-a0cfc8a056c8', 307, 'approved', true,
   '280 acres around a flooded granite quarry holding 2.4 billion gallons of water. Atlanta''s biggest park.')
ON CONFLICT (track_id, venue_id) DO NOTHING;

-- ============================================================================
-- 3. LIFES LIKE A MOVIE (Film/Entertainment) — Track: c74fe2af-37a6-447c-97e8-7b71b7d18c13
-- ============================================================================

INSERT INTO explore_track_venues (track_id, venue_id, status, is_featured, editorial_blurb)
VALUES
  -- Plaza Theatre (197) — indie film landmark
  ('c74fe2af-37a6-447c-97e8-7b71b7d18c13', 197, 'approved', false,
   'Indie film since 1939. Midnight movies, cult classics, and Atlanta Film Festival screenings.'),
  -- Dad's Garage (99) — comedy/improv
  ('c74fe2af-37a6-447c-97e8-7b71b7d18c13', 99, 'approved', false,
   'Award-winning improv in O4W. The performers voice half the characters on Adult Swim.'),
  -- Westside Park (307) — Walking Dead filming location
  ('c74fe2af-37a6-447c-97e8-7b71b7d18c13', 307, 'approved', false,
   'Bellwood Quarry — The Walking Dead''s most iconic filming location. Now a 280-acre public park.')
ON CONFLICT (track_id, venue_id) DO NOTHING;

-- ============================================================================
-- 4. TOMORROW IS ANOTHER DAY (Culture/History) — Track: 1230e2dd-be8c-41ca-909d-ca6ba83f9b0d
--    Goat Farm is a major cultural institution
-- ============================================================================

INSERT INTO explore_track_venues (track_id, venue_id, status, is_featured, editorial_blurb)
VALUES
  ('1230e2dd-be8c-41ca-909d-ca6ba83f9b0d', 2076, 'approved', false,
   'A 19th-century cotton gin repurposed as Atlanta''s most eccentric creative campus. Art, theater, and goats.')
ON CONFLICT (track_id, venue_id) DO NOTHING;
