-- ============================================================================
-- Explore Tracks: Quality Overhaul — Venue Enrichment
-- Adds missing venues to 5 tracks flagged by audit. Removes misfit venues.
-- Uses ILIKE venue lookups with ON CONFLICT upserts.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. BEAUTIFUL MOSAIC — add global food/culture venues, remove misfit
-- ============================================================================

DO $$
DECLARE
  v_track_id UUID;
  v_vid INT;
  v_next_sort INT;
BEGIN
  SELECT id INTO v_track_id FROM explore_tracks WHERE slug = 'a-beautiful-mosaic';
  IF v_track_id IS NULL THEN RETURN; END IF;

  -- Get next sort order
  SELECT COALESCE(MAX(sort_order), 0) + 1 INTO v_next_sort
  FROM explore_track_venues WHERE track_id = v_track_id;

  -- Remove Jimmy Carter Library (not "global culture")
  DELETE FROM explore_track_venues
  WHERE track_id = v_track_id
    AND venue_id IN (SELECT id FROM venues WHERE name ILIKE '%jimmy carter%library%');

  -- Buford Highway Farmers Market
  SELECT id INTO v_vid FROM venues WHERE name ILIKE '%buford highway%farmer%market%' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, v_next_sort, TRUE, 'approved',
      'A global grocery store the size of a football field. Korean, Mexican, Vietnamese, Ethiopian — every aisle is a different continent.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET is_featured = TRUE, editorial_blurb = EXCLUDED.editorial_blurb;
    v_next_sort := v_next_sort + 1;
  END IF;

  -- Nam Phuong
  SELECT id INTO v_vid FROM venues WHERE name ILIKE '%nam phuong%' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, v_next_sort, FALSE, 'approved',
      'Buford Highway Vietnamese institution. The pho is the benchmark everything else gets measured against.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
    v_next_sort := v_next_sort + 1;
  END IF;

  -- Pho Dai Loi #2
  SELECT id INTO v_vid FROM venues WHERE name ILIKE '%pho dai loi%' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, v_next_sort, FALSE, 'approved',
      'Cash only, no frills, the best pho on Buford Highway. The regulars know to order the #2 special.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
    v_next_sort := v_next_sort + 1;
  END IF;

  -- Desta Ethiopian Kitchen
  SELECT id INTO v_vid FROM venues WHERE name ILIKE '%desta%ethiopian%' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, v_next_sort, FALSE, 'approved',
      'Injera and wot done right in a cozy Westside spot. The vegetarian combo is a revelation.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
    v_next_sort := v_next_sort + 1;
  END IF;

  -- Bhojanic
  SELECT id INTO v_vid FROM venues WHERE name ILIKE '%bhojanic%' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, v_next_sort, FALSE, 'approved',
      'Indian comfort food at Krog Street Market. The thali plate is a crash course in Southern Indian cooking.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
    v_next_sort := v_next_sort + 1;
  END IF;

END $$;

-- ============================================================================
-- 2. LIFE'S LIKE A MOVIE — add family anchors if missing
-- ============================================================================

DO $$
DECLARE
  v_track_id UUID;
  v_vid INT;
  v_next_sort INT;
BEGIN
  SELECT id INTO v_track_id FROM explore_tracks WHERE slug = 'lifes-like-a-movie';
  IF v_track_id IS NULL THEN RETURN; END IF;

  SELECT COALESCE(MAX(sort_order), 0) + 1 INTO v_next_sort
  FROM explore_track_venues WHERE track_id = v_track_id;

  -- Starlight Drive-In
  SELECT id INTO v_vid FROM venues WHERE name ILIKE '%starlight%drive%in%' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, v_next_sort, TRUE, 'approved',
      'One of the last drive-in theaters in America. Double features under the stars on a massive screen.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET is_featured = TRUE, editorial_blurb = EXCLUDED.editorial_blurb;
    v_next_sort := v_next_sort + 1;
  END IF;

  -- Atlanta Botanical Garden
  SELECT id INTO v_vid FROM venues WHERE name ILIKE '%atlanta botanical garden%' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, v_next_sort, FALSE, 'approved',
      'Canopy walk, orchid house, and seasonal light shows. Kids love the children''s garden with splash pads and treehouses.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
    v_next_sort := v_next_sort + 1;
  END IF;

  -- Piedmont Park
  SELECT id INTO v_vid FROM venues WHERE slug = 'piedmont-park' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, v_next_sort, FALSE, 'approved',
      'Playgrounds, splash pads, a lake, and wide open lawns. The Saturday farmers market is perfect for family mornings.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
    v_next_sort := v_next_sort + 1;
  END IF;

  -- Fernbank Museum of Natural History
  SELECT id INTO v_vid FROM venues WHERE name ILIKE '%fernbank museum%' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, v_next_sort, FALSE, 'approved',
      'Dinosaurs, a planetarium, and hands-on science exhibits. Friday night adults-only events with cocktails and live music.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
    v_next_sort := v_next_sort + 1;
  END IF;

  -- LEGOLAND Discovery Center
  SELECT id INTO v_vid FROM venues WHERE name ILIKE '%legoland%' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, v_next_sort, FALSE, 'approved',
      'Mini Atlanta built in LEGO, rides, 4D cinema, and building workshops. Best for ages 3-10.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
    v_next_sort := v_next_sort + 1;
  END IF;

END $$;

-- ============================================================================
-- 3. KEEP MOVING FORWARD — Southside Trail gap
-- ============================================================================

DO $$
DECLARE
  v_track_id UUID;
  v_vid INT;
  v_next_sort INT;
BEGIN
  SELECT id INTO v_track_id FROM explore_tracks WHERE slug = 'keep-moving-forward';
  IF v_track_id IS NULL THEN RETURN; END IF;

  SELECT COALESCE(MAX(sort_order), 0) + 1 INTO v_next_sort
  FROM explore_track_venues WHERE track_id = v_track_id;

  -- Pittsburgh Yards
  SELECT id INTO v_vid FROM venues WHERE name ILIKE '%pittsburgh yard%' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, v_next_sort, FALSE, 'approved',
      'Workforce hub on the Southside Trail. Community events, a food hall in progress, and the neighborhood''s second act.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
    v_next_sort := v_next_sort + 1;
  END IF;

  -- Lee + White
  SELECT id INTO v_vid FROM venues WHERE name ILIKE '%lee%white%' OR name ILIKE '%lee + white%' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, v_next_sort, FALSE, 'approved',
      'Food hall, breweries, and shops in a converted warehouse right on the Westside BeltLine. Monday Night Brewing is the anchor.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
    v_next_sort := v_next_sort + 1;
  END IF;

  -- Monday Night Brewing Garage
  SELECT id INTO v_vid FROM venues WHERE name ILIKE '%monday night%garage%' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, v_next_sort, FALSE, 'approved',
      'BeltLine-adjacent taproom in a converted auto garage. Great sours, a huge patio, and dogs welcome.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
    v_next_sort := v_next_sort + 1;
  END IF;

END $$;

-- ============================================================================
-- 4. THE ITIS — local over chain
-- ============================================================================

DO $$
DECLARE
  v_track_id UUID;
  v_vid INT;
  v_next_sort INT;
BEGIN
  SELECT id INTO v_track_id FROM explore_tracks WHERE slug = 'the-itis';
  IF v_track_id IS NULL THEN RETURN; END IF;

  SELECT COALESCE(MAX(sort_order), 0) + 1 INTO v_next_sort
  FROM explore_track_venues WHERE track_id = v_track_id;

  -- Remove Hattie B's (Nashville chain)
  DELETE FROM explore_track_venues
  WHERE track_id = v_track_id
    AND venue_id IN (SELECT id FROM venues WHERE name ILIKE '%hattie b%');

  -- Bacchanalia
  SELECT id INTO v_vid FROM venues WHERE name ILIKE '%bacchanalia%' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, v_next_sort, TRUE, 'approved',
      'Atlanta''s fine dining crown jewel since 1999. Farm-to-table before it was a phrase. The tasting menu is worth every penny.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET is_featured = TRUE, editorial_blurb = EXCLUDED.editorial_blurb;
    v_next_sort := v_next_sort + 1;
  END IF;

  -- Busy Bee Cafe
  SELECT id INTO v_vid FROM venues WHERE name ILIKE '%busy bee%' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, v_next_sort, TRUE, 'approved',
      'Soul food since 1947. MLK ate here, Obama ate here, and the fried chicken still hasn''t changed.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET is_featured = TRUE, editorial_blurb = EXCLUDED.editorial_blurb;
    v_next_sort := v_next_sort + 1;
  END IF;

  -- Miller Union
  SELECT id INTO v_vid FROM venues WHERE name ILIKE '%miller union%' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, v_next_sort, FALSE, 'approved',
      'James Beard-nominated farm-to-table in a converted warehouse. The whole grilled fish and seasonal vegetables are legendary.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
    v_next_sort := v_next_sort + 1;
  END IF;

END $$;

-- ============================================================================
-- 5. SAY LESS — cocktail bar enrichment
-- ============================================================================

DO $$
DECLARE
  v_track_id UUID;
  v_vid INT;
  v_next_sort INT;
BEGIN
  SELECT id INTO v_track_id FROM explore_tracks WHERE slug = 'say-less';
  IF v_track_id IS NULL THEN RETURN; END IF;

  SELECT COALESCE(MAX(sort_order), 0) + 1 INTO v_next_sort
  FROM explore_track_venues WHERE track_id = v_track_id;

  -- Kimball House
  SELECT id INTO v_vid FROM venues WHERE name ILIKE '%kimball house%' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, v_next_sort, TRUE, 'approved',
      'Decatur''s oyster and cocktail temple in a converted train depot. The absinthe service is pure theater.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET is_featured = TRUE, editorial_blurb = EXCLUDED.editorial_blurb;
    v_next_sort := v_next_sort + 1;
  END IF;

  -- Ticonderoga Club
  SELECT id INTO v_vid FROM venues WHERE name ILIKE '%ticonderoga%' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, v_next_sort, FALSE, 'approved',
      'Inside Krog Street Market but feels like its own world. Classic cocktails, natural wine, and a neighborhood bar soul.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
    v_next_sort := v_next_sort + 1;
  END IF;

  -- Paper Plane
  SELECT id INTO v_vid FROM venues WHERE name ILIKE '%paper plane%' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, v_next_sort, FALSE, 'approved',
      'Decatur''s cocktail bar for people who care about the drink but not the scene. No reservations, no pretension.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
    v_next_sort := v_next_sort + 1;
  END IF;

END $$;

COMMIT;
