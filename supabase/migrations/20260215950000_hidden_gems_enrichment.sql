-- ============================================================================
-- Hidden Gems Enrichment
-- Adds genuinely obscure/surprising venues to relevant explore tracks.
-- Research sources: Atlas Obscura, local subculture blogs, metro exploration
-- ============================================================================

-- ============================================================================
-- PART 1: CREATE VENUE RECORDS FOR HIDDEN GEMS NOT YET IN DB
-- These are real places with real addresses. ON CONFLICT DO NOTHING
-- so re-runs are safe if the venue was added by a crawler in the meantime.
-- ============================================================================

-- Arabia Mountain — otherworldly monadnock landscape with vernal pools
INSERT INTO venues (name, slug, address, city, state, zip, lat, lng, neighborhood, venue_type, website)
VALUES (
  'Arabia Mountain',
  'arabia-mountain',
  '3787 Klondike Rd, Lithonia, GA 30038',
  'Atlanta', 'GA', '30038',
  33.6653, -84.1168,
  'Lithonia',
  'park',
  'https://arabiaalliance.org'
)
ON CONFLICT (slug) DO NOTHING;

-- Sope Creek Paper Mill Ruins — Civil War-era ruins hidden in the woods
INSERT INTO venues (name, slug, address, city, state, zip, lat, lng, neighborhood, venue_type, website)
VALUES (
  'Sope Creek Paper Mill Ruins',
  'sope-creek-paper-mill-ruins',
  '3495 Paper Mill Rd SE, Marietta, GA 30067',
  'Atlanta', 'GA', '30067',
  33.9477, -84.4394,
  'East Cobb',
  'park',
  'https://www.nps.gov/chat/planyourvisit/sope-creek.htm'
)
ON CONFLICT (slug) DO NOTHING;

-- Westview Cemetery — 582-acre Victorian cemetery with abbey ruins and famous graves
INSERT INTO venues (name, slug, address, city, state, zip, lat, lng, neighborhood, venue_type, website)
VALUES (
  'Westview Cemetery',
  'westview-cemetery',
  '1680 Westview Dr SW, Atlanta, GA 30310',
  'Atlanta', 'GA', '30310',
  33.7343, -84.4252,
  'West End',
  'park',
  'https://www.westviewcemetery.com'
)
ON CONFLICT (slug) DO NOTHING;

-- Drepung Loseling Monastery — Tibetan Buddhist monastery in suburban Atlanta
INSERT INTO venues (name, slug, address, city, state, zip, lat, lng, neighborhood, venue_type, website)
VALUES (
  'Drepung Loseling Monastery',
  'drepung-loseling-monastery',
  '1781 Dresden Dr NE, Atlanta, GA 30319',
  'Atlanta', 'GA', '30319',
  33.8488, -84.3252,
  'Brookhaven',
  'church',
  'https://www.drepung.org'
)
ON CONFLICT (slug) DO NOTHING;

-- Jeju Sauna — immersive Korean jjimjilbang spa complex
INSERT INTO venues (name, slug, address, city, state, zip, lat, lng, neighborhood, venue_type, website)
VALUES (
  'Jeju Sauna',
  'jeju-sauna',
  '3555 Gwinnett Pl Dr NW, Duluth, GA 30096',
  'Atlanta', 'GA', '30096',
  33.9612, -84.1485,
  'Duluth',
  'fitness_center',
  'https://www.jejusauna.com'
)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- PART 2: ENRICH "The Midnight Train" (Weird Spots for Freaks)
-- Adding genuinely surprising picks that most Atlantans don't know about
-- ============================================================================

DO $$
DECLARE
  v_track_id UUID;
  v_vid INT;
  v_sort INT := 20; -- start after existing venues
BEGIN
  SELECT id INTO v_track_id FROM explore_tracks WHERE slug = 'the-midnight-train';
  IF v_track_id IS NULL THEN RETURN; END IF;

  -- MJQ Concourse — underground bunker nightclub beneath a parking lot
  SELECT id INTO v_vid FROM venues WHERE name ILIKE '%MJQ%' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, v_sort, TRUE, 'approved',
      'Underground bunker nightclub beneath a parking lot. No sign, no dress code, no phone signal. Atlanta''s best-kept secret since the ''90s.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb, is_featured = TRUE;
  END IF;

  -- Oddities Museum — medical curiosities, shrunken heads, two-headed animals
  SELECT id INTO v_vid FROM venues WHERE name ILIKE '%Oddities Museum%' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, v_sort, TRUE, 'approved',
      'Medical curiosities, shrunken heads, and two-headed taxidermy. Part museum, part sideshow, part someone''s extremely specific collection.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb, is_featured = TRUE;
  END IF;

  -- Northside Tavern — 50-year-old blues dive with sawdust floors
  SELECT id INTO v_vid FROM venues WHERE name ILIKE '%Northside Tavern%' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, v_sort, FALSE, 'approved',
      'Blues dive since 1973. Sawdust on the floor, band in the corner, $5 cover. The real Atlanta, completely unchanged.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- Westview Cemetery — Victorian abbey ruins, Asa Candler buried here
  SELECT id INTO v_vid FROM venues WHERE slug = 'westview-cemetery' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, v_sort, TRUE, 'approved',
      '582-acre Victorian cemetery with crumbling abbey ruins, mausoleums you can walk inside, and the graves of Coca-Cola''s founder and Joel Chandler Harris.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb, is_featured = TRUE;
  END IF;

  -- Arabia Mountain — alien rock landscape
  SELECT id INTO v_vid FROM venues WHERE slug = 'arabia-mountain' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, v_sort, TRUE, 'approved',
      'A granite monadnock that looks like another planet. Shallow pools of diamorpha turn blood-red in spring. 25 minutes from downtown and nobody knows about it.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb, is_featured = TRUE;
  END IF;

  -- Sope Creek Paper Mill Ruins — Civil War ruins hidden in the woods
  SELECT id INTO v_vid FROM venues WHERE slug = 'sope-creek-paper-mill-ruins' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, v_sort, FALSE, 'approved',
      'Civil War-era paper mill ruins overgrown in the woods along Sope Creek. Union cavalry burned it in 1864. The stone walls and chimney stacks are still standing.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- Drepung Loseling Monastery — Tibetan Buddhist monastery in Brookhaven
  SELECT id INTO v_vid FROM venues WHERE slug = 'drepung-loseling-monastery' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, v_sort, TRUE, 'approved',
      'A real Tibetan Buddhist monastery in suburban Brookhaven. Sand mandala ceremonies, meditation classes, and monks in robes next to a Publix.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb, is_featured = TRUE;
  END IF;

END $$;

-- ============================================================================
-- PART 3: ENRICH "City in a Forest" (Great Outdoors)
-- Adding genuinely hidden outdoor spots
-- ============================================================================

DO $$
DECLARE
  v_track_id UUID;
  v_vid INT;
  v_sort INT := 20;
BEGIN
  SELECT id INTO v_track_id FROM explore_tracks WHERE slug = 'city-in-a-forest';
  IF v_track_id IS NULL THEN RETURN; END IF;

  -- Arabia Mountain
  SELECT id INTO v_vid FROM venues WHERE slug = 'arabia-mountain' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, v_sort, TRUE, 'approved',
      'Exposed granite monadnock with otherworldly rock pools and rare plants. The Mile Rock Trail feels like hiking on Mars.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb, is_featured = TRUE;
  END IF;

  -- Sope Creek Paper Mill Ruins
  SELECT id INTO v_vid FROM venues WHERE slug = 'sope-creek-paper-mill-ruins' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, v_sort, FALSE, 'approved',
      'Trails along Sope Creek past Civil War paper mill ruins. Easy hike, great creek access, and ruins you can explore up close.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- Westview Cemetery
  SELECT id INTO v_vid FROM venues WHERE slug = 'westview-cemetery' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, v_sort, FALSE, 'approved',
      'Atlanta''s largest cemetery doubles as a 582-acre arboretum with rolling hills, mature oaks, and the most peaceful walk in the city.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

END $$;

-- ============================================================================
-- PART 4: ENRICH "A Beautiful Mosaic" (Global Atlanta)
-- Adding hidden global culture spots
-- ============================================================================

DO $$
DECLARE
  v_track_id UUID;
  v_vid INT;
  v_sort INT := 20;
BEGIN
  SELECT id INTO v_track_id FROM explore_tracks WHERE slug = 'a-beautiful-mosaic';
  IF v_track_id IS NULL THEN RETURN; END IF;

  -- Drepung Loseling Monastery
  SELECT id INTO v_vid FROM venues WHERE slug = 'drepung-loseling-monastery' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, v_sort, TRUE, 'approved',
      'One of only a handful of Tibetan Buddhist monasteries in the US. Public meditation, cultural events, and an annual sand mandala ceremony.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb, is_featured = TRUE;
  END IF;

  -- Jeju Sauna — Korean spa culture
  SELECT id INTO v_vid FROM venues WHERE slug = 'jeju-sauna' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_vid, v_sort, FALSE, 'approved',
      'Full Korean jjimjilbang experience: jade rooms, salt rooms, sleeping halls, Korean food court. Open 24 hours. The Buford Highway corridor''s cultural anchor.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

END $$;

-- ============================================================================
-- PART 5: Update Midnight Train description to reflect new picks
-- ============================================================================

UPDATE explore_tracks SET description =
  'MJQ under the parking lot, a Tibetan monastery in the suburbs, Civil War ruins in the woods, and the delightfully strange side of Atlanta that most locals don''t even know.'
WHERE slug = 'the-midnight-train';
