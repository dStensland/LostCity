-- ============================================================================
-- Explore Tracks Curation Overhaul
-- Cuts 15 → 12 tracks, purges auto-fills, rebuilds hip-hop & street art
-- with hand-picked venues. Every venue earns its spot.
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: DEACTIVATE KILLED TRACKS
-- ============================================================================

UPDATE explore_tracks SET is_active = false
WHERE slug IN (
  'tomorrow-is-another-day',   -- 149 museums, no narrative
  'the-devil-went-down-to-georgia', -- just breweries
  'the-main-event'             -- confused identity
);

-- ============================================================================
-- PART 2: UPDATE TRACK METADATA
-- ============================================================================

-- Fix typo
UPDATE explore_tracks
SET name = 'Life''s Like a Movie'
WHERE slug = 'lifes-like-a-movie';

-- Sharpen descriptions — every one should make you want to click
UPDATE explore_tracks SET description =
  'The big hits. Aquarium, World of Coca-Cola, Fox Theatre, Piedmont Park — Atlanta''s greatest hits album.'
WHERE slug = 'welcome-to-atlanta';

UPDATE explore_tracks SET description =
  'Walk where history was made. Sweet Auburn, the King Center, Ebenezer Baptist, and the stories that shaped a nation.'
WHERE slug = 'good-trouble';

UPDATE explore_tracks SET description =
  'From the Dungeon Family''s basement to the strip clubs that broke records — studios, stages, and the spots where Atlanta built the sound that changed music.'
WHERE slug = 'the-south-got-something-to-say';

UPDATE explore_tracks SET description =
  '22 miles of trail connecting neighborhoods, murals, breweries, and food halls. Atlanta''s backbone.'
WHERE slug = 'keep-moving-forward';

UPDATE explore_tracks SET description =
  'Staplehouse, Busy Bee, Buford Highway — James Beard legends, soul food institutions, and the world tour on one road.'
WHERE slug = 'the-itis';

UPDATE explore_tracks SET description =
  'Secret waterfalls, skyline hikes, swimming holes, and green spaces hidden inside a major metro.'
WHERE slug = 'city-in-a-forest';

UPDATE explore_tracks SET description =
  'Krog Tunnel graffiti, BeltLine murals, the Goat Farm''s 300 studios, and the galleries where Atlanta artists make their mark.'
WHERE slug = 'hard-in-da-paint';

UPDATE explore_tracks SET description =
  'Buford Highway''s world tour. Ethiopian coffee ceremonies, Korean BBQ, Vietnamese pho, and the global communities that make Atlanta international.'
WHERE slug = 'a-beautiful-mosaic';

UPDATE explore_tracks SET description =
  'Midtown, Pride, drag, ballroom culture, and the spaces that make Atlanta a queer capital of the South.'
WHERE slug = 'too-busy-to-hate';

UPDATE explore_tracks SET description =
  'Clermont Lounge, Doll''s Head Trail, a sealed time capsule, and the delightfully strange side of Atlanta.'
WHERE slug = 'the-midnight-train';

UPDATE explore_tracks SET description =
  'Mercedes-Benz, Truist Park, Atlanta United, and the tailgate spots where Atlanta bleeds red and black.'
WHERE slug = 'keep-swinging';

UPDATE explore_tracks SET description =
  'Puppetry Arts, Fernbank dinosaurs, LEGOLAND, Zoo Atlanta, and family adventures that make kids'' eyes go wide.'
WHERE slug = 'lifes-like-a-movie';

-- ============================================================================
-- PART 3: REORDER (close the gaps from killed tracks)
-- ============================================================================

UPDATE explore_tracks SET sort_order = 1  WHERE slug = 'welcome-to-atlanta';
UPDATE explore_tracks SET sort_order = 2  WHERE slug = 'good-trouble';
UPDATE explore_tracks SET sort_order = 3  WHERE slug = 'the-south-got-something-to-say';
UPDATE explore_tracks SET sort_order = 4  WHERE slug = 'keep-moving-forward';
UPDATE explore_tracks SET sort_order = 5  WHERE slug = 'the-itis';
UPDATE explore_tracks SET sort_order = 6  WHERE slug = 'city-in-a-forest';
UPDATE explore_tracks SET sort_order = 7  WHERE slug = 'hard-in-da-paint';
UPDATE explore_tracks SET sort_order = 8  WHERE slug = 'a-beautiful-mosaic';
UPDATE explore_tracks SET sort_order = 9  WHERE slug = 'too-busy-to-hate';
UPDATE explore_tracks SET sort_order = 10 WHERE slug = 'the-midnight-train';
UPDATE explore_tracks SET sort_order = 11 WHERE slug = 'keep-swinging';
UPDATE explore_tracks SET sort_order = 12 WHERE slug = 'lifes-like-a-movie';

-- ============================================================================
-- PART 4: FULL PURGE OF TRACKS BEING REBUILT
-- These tracks had 70-85 auto-filled venues. Starting from zero.
-- ============================================================================

DELETE FROM explore_track_venues
WHERE track_id IN (
  SELECT id FROM explore_tracks WHERE slug IN (
    'the-south-got-something-to-say',
    'hard-in-da-paint',
    'city-in-a-forest',
    'keep-swinging'
  )
);

-- Also clean up venue mappings for deactivated tracks
DELETE FROM explore_track_venues
WHERE track_id IN (
  SELECT id FROM explore_tracks WHERE slug IN (
    'tomorrow-is-another-day',
    'the-devil-went-down-to-georgia'
    -- keep the-main-event mappings intact (Pullman Yards etc. may be reused)
  )
);

-- ============================================================================
-- PART 5: REBUILD "The South Got Something to Say" — HIP-HOP HERITAGE
-- No more generic music_venue auto-fill. Every venue has hip-hop DNA.
-- ============================================================================

DO $$
DECLARE
  v_track_id UUID;
  v_vid INT;
BEGIN
  SELECT id INTO v_track_id FROM explore_tracks WHERE slug = 'the-south-got-something-to-say';
  IF v_track_id IS NULL THEN RETURN; END IF;

  -- 1. Magic City (826) — THE A&R strip club
  INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
  VALUES (v_track_id, 826, 1, TRUE, 'approved',
    'Where Southern hip-hop careers were made on the dance floor. If the dancers moved to your track, you had a hit.')
  ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 1, is_featured = TRUE, editorial_blurb = EXCLUDED.editorial_blurb;

  -- 2. The Tabernacle — where trap legends performed
  SELECT id INTO v_vid FROM venues WHERE slug = 'the-tabernacle' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, 2, TRUE, 'approved',
      'Former church turned concert cathedral. Jeezy, Gucci, T.I. all brought trap to this stage.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 2, is_featured = TRUE, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 3. Criminal Records — championed local hip-hop since 1991
  SELECT id INTO v_vid FROM venues WHERE slug = 'criminal-records' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, 3, TRUE, 'approved',
      'Little Five Points since 1991. Local hip-hop found shelf space here before the majors called. Founded by the guy who started Record Store Day.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 3, is_featured = TRUE, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 4. Lenox Square (537) — where Andre met Big Boi
  INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
  VALUES (v_track_id, 537, 4, TRUE, 'approved',
    'Where Andre 3000 met Big Boi. Where T.I. hustled his first mixtapes in the parking lot. Buckhead''s hip-hop origin story.')
  ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 4, is_featured = TRUE, editorial_blurb = EXCLUDED.editorial_blurb;

  -- 5. The Masquerade — iconic 3-room venue
  SELECT id INTO v_vid FROM venues WHERE slug = 'the-masquerade' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, 5, FALSE, 'approved',
      'Three rooms at Underground Atlanta. Everyone from Fugazi to Future. The Heaven room''s balcony is where you want to be.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 5, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 6. Paschal's (3207) — where power brokers eat
  INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
  VALUES (v_track_id, 3207, 6, FALSE, 'approved',
    'Where MLK strategized and today''s power brokers eat. Fried chicken that fueled a movement, still fueling the culture.')
  ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 6, editorial_blurb = EXCLUDED.editorial_blurb;

  -- 7. Fox Theatre (119) — hosted OutKast, Lil Wayne
  INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
  VALUES (v_track_id, 119, 7, FALSE, 'approved',
    'The Fabulous Fox hosted OutKast and Lil Wayne on its Midtown stage. The 1929 Moorish ceiling is worth the ticket alone.')
  ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 7, editorial_blurb = EXCLUDED.editorial_blurb;

  -- 8-15: Heritage venues that may or may not be in the DB yet
  -- Each uses a name lookup and gracefully skips if not found

  -- Patchwerk Recording Studios
  SELECT id INTO v_vid FROM venues WHERE name ILIKE '%patchwerk%' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, 8, TRUE, 'approved',
      'Where OutKast recorded Stankonia. Where TLC cut CrazySexyCool. The walls have heard every Atlanta hit you know.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 8, is_featured = TRUE, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- Wax N Facts
  SELECT id INTO v_vid FROM venues WHERE name ILIKE '%wax%fact%' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, 9, FALSE, 'approved',
      'Deep bins of hip-hop vinyl in Little Five Points since 1976. Start at the 25-cent crate.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 9, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- Apache XLR / Apache Cafe
  SELECT id INTO v_vid FROM venues WHERE name ILIKE '%apache%' AND name NOT ILIKE '%mountain%' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, 10, TRUE, 'approved',
      'The neo-soul and hip-hop pipeline since 2001. AWOL Open Mic every 3rd Tuesday. Where unsigned artists get signed.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 10, is_featured = TRUE, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- JB's Record Lounge
  SELECT id INTO v_vid FROM venues WHERE name ILIKE '%jb%record%' OR name ILIKE '%record lounge%' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, 11, FALSE, 'approved',
      '13,000 pieces of soul and hip-hop on Oak Street. Vinyl parties and the deep cuts you won''t find streaming.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 11, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- Walter's Clothing
  SELECT id INTO v_vid FROM venues WHERE name ILIKE '%walter%clothing%' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, 12, FALSE, 'approved',
      'Downtown shop that defied Jim Crow and dressed OutKast, Jeezy, and Gucci. In Jermaine Dupri''s "Welcome to Atlanta" video.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 12, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- Stankonia Studios
  SELECT id INTO v_vid FROM venues WHERE name ILIKE '%stankonia%' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, 13, FALSE, 'approved',
      'Named after OutKast''s 4th album. Owned by Andre 3000 and Big Boi. Ludacris, T.I., and Janelle Monae recorded here.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 13, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- Trap Music Museum
  SELECT id INTO v_vid FROM venues WHERE name ILIKE '%trap%museum%' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, 14, TRUE, 'approved',
      'T.I.''s museum dedicated to the genre Atlanta invented. Immersive rooms, graffiti walls, and the story of trap.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 14, is_featured = TRUE, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- Vinyl (at Center Stage)
  SELECT id INTO v_vid FROM venues WHERE slug = 'vinyl-atlanta' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, 15, FALSE, 'approved',
      'Record store meets bar in Midtown. Buy a crate, drink a beer, catch a DJ set in the 300-cap room.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 15, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

END $$;

-- ============================================================================
-- PART 6: REBUILD "Hard in Da Paint" — STREET ART & LOCAL ART
-- No more 82 auto-filled galleries. Paint pun = actual paint.
-- ============================================================================

DO $$
DECLARE
  v_track_id UUID;
  v_vid INT;
BEGIN
  SELECT id INTO v_track_id FROM explore_tracks WHERE slug = 'hard-in-da-paint';
  IF v_track_id IS NULL THEN RETURN; END IF;

  -- 1. Krog Street Tunnel — THE graffiti landmark
  SELECT id INTO v_vid FROM venues WHERE slug = 'krog-street-tunnel' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, 1, TRUE, 'approved',
      'Atlanta''s graffiti mecca. The walls change weekly. Bring a camera and watch for trains.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 1, is_featured = TRUE, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 2. Goat Farm Arts Center (2076) — 300+ artist studios
  INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
  VALUES (v_track_id, 2076, 2, TRUE, 'approved',
    '19th-century cotton mill with 300+ artist studios, immersive events, and actual goats on the grounds.')
  ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 2, is_featured = TRUE, editorial_blurb = EXCLUDED.editorial_blurb;

  -- 3. Atlanta Contemporary — free, local-focused
  SELECT id INTO v_vid FROM venues WHERE slug = 'atlanta-contemporary' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, 3, TRUE, 'approved',
      'Always free. Contemporary art focused on emerging and Atlanta-based artists. The courtyard alone is worth the stop.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 3, is_featured = TRUE, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 4. Pullman Yards (931) — immersive art experiences
  INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
  VALUES (v_track_id, 931, 4, TRUE, 'approved',
    'Abandoned rail yard reborn as Atlanta''s most immersive art space. Light installations, interactive exhibits, and events that defy description.')
  ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 4, is_featured = TRUE, editorial_blurb = EXCLUDED.editorial_blurb;

  -- 5. High Museum of Art — the icon anchor
  SELECT id INTO v_vid FROM venues WHERE slug = 'high-museum-of-art' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, 5, TRUE, 'approved',
      'Richard Meier''s white porcelain landmark. Free second Sundays. The permanent collection goes deep on Southern self-taught art.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 5, is_featured = TRUE, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 6. Hammonds House Museum — African American art
  SELECT id INTO v_vid FROM venues WHERE slug = 'hammonds-house-museum' OR name ILIKE '%hammonds house%' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, 6, FALSE, 'approved',
      'African American art in a Victorian house in West End. Romare Bearden to contemporary Atlanta painters.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 6, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 7. MODA — Museum of Design Atlanta (726)
  INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
  VALUES (v_track_id, 726, 7, FALSE, 'approved',
    'Only museum in the Southeast dedicated to design. Architecture, fashion, and the built world in rotating exhibits.')
  ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 7, editorial_blurb = EXCLUDED.editorial_blurb;

  -- 8. Paris on Ponce — eclectic art + antiques
  SELECT id INTO v_vid FROM venues WHERE slug = 'paris-on-ponce' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, 8, FALSE, 'approved',
      'Three floors of curiosities, vintage finds, and local artist work. Part antique mall, part gallery, all Atlanta.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 8, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 9. Eyedrum — experimental art + music
  SELECT id INTO v_vid FROM venues WHERE name ILIKE '%eyedrum%' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, 9, FALSE, 'approved',
      'Experimental art and music gallery. Noise shows, video installations, and the fringe of Atlanta''s creative scene.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 9, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 10. The Bakery — experimental performance/art space
  SELECT id INTO v_vid FROM venues WHERE name ILIKE 'the bakery' AND city ILIKE '%atlanta%' LIMIT 1;
  IF v_vid IS NULL THEN
    SELECT id INTO v_vid FROM venues WHERE name ILIKE '%the bakery%' AND venue_type IN ('music_venue', 'gallery', 'art_space') LIMIT 1;
  END IF;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, 10, FALSE, 'approved',
      'Experimental art and performance space. If it''s weird, wonderful, and pushing boundaries, it''s probably here.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 10, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 11. Whitespace Gallery — contemporary local art
  SELECT id INTO v_vid FROM venues WHERE slug = 'whitespace-gallery' OR name ILIKE '%whitespace%gallery%' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, 11, FALSE, 'approved',
      'Inman Park contemporary gallery. Curated shows from Atlanta and Southeast artists. Saturday openings are the move.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 11, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 12. Dad's Garage Theatre (99) — creative arts in a converted church
  INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
  VALUES (v_track_id, 99, 12, FALSE, 'approved',
    'Improv and experimental theater in a converted church. The performers voice half the characters on Adult Swim.')
  ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 12, editorial_blurb = EXCLUDED.editorial_blurb;

END $$;

-- ============================================================================
-- PART 7: REBUILD "City in a Forest" — CURATED OUTDOORS (was 85 venues)
-- ============================================================================

DO $$
DECLARE
  v_track_id UUID;
  v_vid INT;
BEGIN
  SELECT id INTO v_track_id FROM explore_tracks WHERE slug = 'city-in-a-forest';
  IF v_track_id IS NULL THEN RETURN; END IF;

  -- Icons
  SELECT id INTO v_vid FROM venues WHERE slug = 'piedmont-park' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, 1, TRUE, 'approved',
      'Atlanta''s Central Park. 189 acres, a lake, the skyline behind the trees. Weekend farmers market and free concerts.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 1, is_featured = TRUE, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  SELECT id INTO v_vid FROM venues WHERE slug = 'atlanta-botanical-garden' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, 2, TRUE, 'approved',
      'Canopy walk above the treetops, orchid house, and seasonal light shows that draw the whole city.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 2, is_featured = TRUE, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- Westside Park / Bellwood Quarry (307)
  INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
  VALUES (v_track_id, 307, 3, TRUE, 'approved',
    '280 acres around a flooded granite quarry holding 2.4 billion gallons. Atlanta''s biggest park. Walking Dead filmed here.')
  ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 3, is_featured = TRUE, editorial_blurb = EXCLUDED.editorial_blurb;

  SELECT id INTO v_vid FROM venues WHERE slug = 'sweetwater-creek-state-park' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, 4, TRUE, 'approved',
      'Civil War mill ruins along a rushing creek. The red trail to the falls is one of the best hikes in metro Atlanta.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 4, is_featured = TRUE, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  SELECT id INTO v_vid FROM venues WHERE slug = 'chattahoochee-river-national-recreation-area' OR name ILIKE '%chattahoochee%river%recreation%' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, 5, TRUE, 'approved',
      'Tubing, kayaking, and riverside trails 20 minutes from downtown. Cochran Shoals is the local favorite.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 5, is_featured = TRUE, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- Hidden gems
  -- Doll's Head Trail (315)
  INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
  VALUES (v_track_id, 315, 6, FALSE, 'approved',
    'Found-object sculptures in a surreal wetland park. The trailhead art is made entirely from things pulled out of the woods.')
  ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 6, editorial_blurb = EXCLUDED.editorial_blurb;

  SELECT id INTO v_vid FROM venues WHERE slug = 'stone-mountain-park' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, 7, FALSE, 'approved',
      'The hike up the back of the mountain is a rite of passage. Sunrise at the summit beats everything.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 7, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  SELECT id INTO v_vid FROM venues WHERE slug = 'fernbank-forest' OR name ILIKE '%fernbank forest%' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, 8, FALSE, 'approved',
      '65 acres of old-growth forest inside the city limits. Feels like you left Atlanta entirely.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 8, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  SELECT id INTO v_vid FROM venues WHERE slug = 'historic-fourth-ward-park' OR name ILIKE '%fourth ward park%' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, 9, FALSE, 'approved',
      'BeltLine''s front porch. Splash pad in summer, stormwater wetlands, and Ponce City Market across the street.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 9, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  SELECT id INTO v_vid FROM venues WHERE slug = 'grant-park' OR (name = 'Grant Park' AND city ILIKE '%atlanta%') LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, 10, FALSE, 'approved',
      'Victorian neighborhood park with the zoo next door. Summer Shade Festival, farmers market, and quiet morning runs.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 10, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  SELECT id INTO v_vid FROM venues WHERE slug = 'chastain-park' OR name ILIKE 'chastain park' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, 11, FALSE, 'approved',
      'Buckhead''s 268-acre retreat. The amphitheater has wine-and-cheese picnic concerts under the trees.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 11, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

END $$;

-- ============================================================================
-- PART 8: REBUILD "Keep Swinging" — SPORTS & GAME DAY (was 66 venues)
-- ============================================================================

DO $$
DECLARE
  v_track_id UUID;
  v_vid INT;
BEGIN
  SELECT id INTO v_track_id FROM explore_tracks WHERE slug = 'keep-swinging';
  IF v_track_id IS NULL THEN RETURN; END IF;

  -- The stadiums
  SELECT id INTO v_vid FROM venues WHERE slug = 'mercedes-benz-stadium' OR name ILIKE 'mercedes-benz stadium' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, 1, TRUE, 'approved',
      'The spaceship that opens its roof. 70,000 fans, $2 hot dogs, and an atmosphere unlike any stadium on earth.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 1, is_featured = TRUE, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  SELECT id INTO v_vid FROM venues WHERE slug = 'state-farm-arena' OR name ILIKE 'state farm arena' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, 2, TRUE, 'approved',
      '21,000 seats of pure energy. Hawks basketball and the biggest concerts in the Southeast.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 2, is_featured = TRUE, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  SELECT id INTO v_vid FROM venues WHERE slug = 'truist-park' OR name ILIKE 'truist park' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, 3, TRUE, 'approved',
      'More than a ballpark. The Battery district has restaurants, concerts, and year-round events even when the Braves are away.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 3, is_featured = TRUE, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  SELECT id INTO v_vid FROM venues WHERE slug = 'bobby-dodd-stadium' OR name ILIKE 'bobby dodd%' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, 4, FALSE, 'approved',
      'Georgia Tech football with the Midtown skyline as the backdrop. The oldest on-campus stadium in the SEC.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 4, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  SELECT id INTO v_vid FROM venues WHERE slug = 'atlanta-motor-speedway' OR name ILIKE 'atlanta motor speedway' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, 5, FALSE, 'approved',
      'NASCAR in Hampton. The track was recently reconfigured — tighter turns, higher speeds, louder crowds.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 5, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- Sports bars with Atlanta DNA
  -- Park Tavern (640) — Official United pub
  INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
  VALUES (v_track_id, 640, 6, TRUE, 'approved',
    'Official Atlanta United pub partner. 25+ screens, a projection wall, and Piedmont Park views on the patio.')
  ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 6, is_featured = TRUE, editorial_blurb = EXCLUDED.editorial_blurb;

  -- STATS Brewpub (654) — Downtown near stadiums
  INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
  VALUES (v_track_id, 654, 7, FALSE, 'approved',
    'Steps from Mercedes-Benz Stadium. Good wings, cold brews, and the energy of game day downtown.')
  ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 7, editorial_blurb = EXCLUDED.editorial_blurb;

  -- Midway Pub (1147) — EAV neighborhood
  INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
  VALUES (v_track_id, 1147, 8, FALSE, 'approved',
    'EAV''s chill neighborhood sports bar. Pool tables, bar bites, and every game on every screen.')
  ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 8, editorial_blurb = EXCLUDED.editorial_blurb;

  -- The Beverly (715) — HBCU alumni haven
  INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
  VALUES (v_track_id, 715, 9, FALSE, 'approved',
    'Morehouse grad-owned neighborhood bar. Strong HBCU alumni community on game days. The vibes are unmatched.')
  ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = 9, editorial_blurb = EXCLUDED.editorial_blurb;

END $$;

COMMIT;
