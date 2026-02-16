-- ============================================================================
-- New Explore Tracks: Say Less, Lights Camera Atlanta, SpelHouse Spirit
-- ============================================================================
-- Adds 3 new curated tracks to the explore experience:
--   1. "Say Less" — Speakeasy & Cocktail Culture
--   2. "Lights, Camera, Atlanta" — Stage & Screen (performance + film)
--   3. "SpelHouse Spirit" — HBCU Culture & Black Excellence
--
-- Uses name-based lookups for venue IDs. Venues not yet in the DB are
-- gracefully skipped — they'll appear once crawlers add them.
-- ============================================================================

-- ============================================================================
-- 1. Create the three tracks
-- ============================================================================

INSERT INTO explore_tracks (slug, name, quote, quote_source, description, sort_order)
VALUES
  ('say-less',
   'Say Less',
   'You don''t find us. We find you.',
   'Every speakeasy doorman, ever',
   'Hidden doors, secret codes, and cocktails that belong in a museum. Atlanta''s speakeasy scene rewards the curious.',
   13),
  ('lights-camera-atlanta',
   'Lights, Camera, Atlanta',
   'Y''all don''t even know what you''re standing in front of.',
   'Every Atlanta tour guide',
   'From Dad''s Garage improv to Marvel soundstages, this city runs on performance. Theaters, comedy clubs, and the sets where Hollywood comes south.',
   14),
  ('spelhouse-spirit',
   'SpelHouse Spirit',
   'Excellence is not an act but a habit.',
   'The AUC tradition',
   'Morehouse. Spelman. Clark Atlanta. The AUC is the beating heart of Black higher education — and the culture around it is unmatched.',
   15)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  quote = EXCLUDED.quote,
  quote_source = EXCLUDED.quote_source,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

-- ============================================================================
-- 2. "Say Less" — Speakeasy & Cocktail Culture
-- ============================================================================

DO $$
DECLARE
  v_track_id UUID;
  v_venue_id INT;
  v_sort INT := 0;
BEGIN
  SELECT id INTO v_track_id FROM explore_tracks WHERE slug = 'say-less';
  IF v_track_id IS NULL THEN
    RAISE NOTICE 'Track say-less not found, skipping';
    RETURN;
  END IF;

  -- Red Phone Booth — the OG Atlanta speakeasy
  SELECT id INTO v_venue_id FROM venues WHERE name ILIKE '%red phone booth%' AND city ILIKE '%atlanta%' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, TRUE, 'approved',
      'Step inside a vintage phone booth, dial the daily code, and descend into Prohibition-era Atlanta. The cigar lounge alone is worth the trip.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, is_featured = EXCLUDED.is_featured, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- JoJo's Beloved
  SELECT id INTO v_venue_id FROM venues WHERE name ILIKE '%jojo%beloved%' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, TRUE, 'approved',
      'Disco ball dreams inside Politan Row. Vinyl nights, craft cocktails, and a ''70s fever dream that somehow works perfectly.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, is_featured = EXCLUDED.is_featured, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- Himitsu
  SELECT id INTO v_venue_id FROM venues WHERE name ILIKE '%himitsu%' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Behind Umi, through a door you might walk past twice. The most exclusive cocktail bar in Atlanta — and the hardest to find on purpose.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- The Bureau
  SELECT id INTO v_venue_id FROM venues WHERE name ILIKE '%the bureau%' AND city ILIKE '%atlanta%' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Film noir aesthetic meets craft cocktails. Murder mystery nights and classic cinema screenings in a bar that takes its theme seriously.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 12 Cocktail Bar
  SELECT id INTO v_venue_id FROM venues WHERE name ILIKE '%12 cocktail%' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Intimate rooftop cocktails at Ponce City Market. Jazz nights, inventive menus, and the kind of bartenders who remember your name.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- Moonlight
  SELECT id INTO v_venue_id FROM venues WHERE name ILIKE '%moonlight%' AND city ILIKE '%atlanta%' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Retro glamour, burlesque shows, and cocktails with main-character energy. Every night here feels like an event.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- Ranger Station
  SELECT id INTO v_venue_id FROM venues WHERE name ILIKE '%ranger station%' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Outdoors-themed cocktails in a space that feels like a very cool campsite. Seasonal menus and storytelling nights.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- Sebastian Pintxos Bar
  SELECT id INTO v_venue_id FROM venues WHERE name ILIKE '%sebastian%' AND city ILIKE '%atlanta%' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'A Basque-inspired hidden bar. Spanish wines, pintxos pairings, and the feeling that you''re somewhere very far from Peachtree Street.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- The James Room
  SELECT id INTO v_venue_id FROM venues WHERE name ILIKE '%james room%' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Coffee by day, cocktail lounge after dark. Hip-hop nights, reggaeton sessions, and a dual-identity space that pulls off both.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- Umi (as gateway to Himitsu)
  SELECT id INTO v_venue_id FROM venues WHERE name ILIKE 'umi%' AND city ILIKE '%atlanta%' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'World-class omakase — and the secret door to Himitsu is through here. Book dinner, then ask your server nicely.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- Bacchanalia (elevated cocktail program)
  SELECT id INTO v_venue_id FROM venues WHERE name ILIKE '%bacchanalia%' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Atlanta''s original fine dining temple. The cocktail program matches the Michelin ambitions — order the seasonal creation.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  RAISE NOTICE 'Say Less: mapped % venues', v_sort;
END $$;


-- ============================================================================
-- 3. "Lights, Camera, Atlanta" — Stage & Screen
-- ============================================================================

DO $$
DECLARE
  v_track_id UUID;
  v_venue_id INT;
  v_sort INT := 0;
BEGIN
  SELECT id INTO v_track_id FROM explore_tracks WHERE slug = 'lights-camera-atlanta';
  IF v_track_id IS NULL THEN
    RAISE NOTICE 'Track lights-camera-atlanta not found, skipping';
    RETURN;
  END IF;

  -- Dad's Garage Theatre (ID: 99)
  v_sort := v_sort + 1;
  INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
  VALUES (v_track_id, 99, v_sort, TRUE, 'approved',
    'Atlanta''s improv institution. The shows are unscripted, the beer is cheap, and half the audience ends up on stage. You will laugh until something hurts.')
  ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, is_featured = EXCLUDED.is_featured, editorial_blurb = EXCLUDED.editorial_blurb;

  -- Fox Theatre (ID: 119)
  v_sort := v_sort + 1;
  INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
  VALUES (v_track_id, 119, v_sort, TRUE, 'approved',
    'A Moorish-Egyptian palace from 1929 that almost got demolished. Now it''s where Broadway tours, ballet, and the Atlanta Film Festival call home.')
  ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, is_featured = EXCLUDED.is_featured, editorial_blurb = EXCLUDED.editorial_blurb;

  -- Plaza Theatre (ID: 197)
  v_sort := v_sort + 1;
  INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
  VALUES (v_track_id, 197, v_sort, TRUE, 'approved',
    'Atlanta''s oldest independent cinema. Rocky Horror on Saturday nights, indie premieres, and the kind of movie palace that streaming can''t replicate.')
  ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, is_featured = EXCLUDED.is_featured, editorial_blurb = EXCLUDED.editorial_blurb;

  -- Starlight Drive-In (ID: 1708)
  v_sort := v_sort + 1;
  INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
  VALUES (v_track_id, 1708, v_sort, TRUE, 'approved',
    'One of the last drive-in theaters in America. Double features, swap meets, and the skyline glowing behind the screen. Bring blankets.')
  ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, is_featured = EXCLUDED.is_featured, editorial_blurb = EXCLUDED.editorial_blurb;

  -- Punchline Comedy Club
  SELECT id INTO v_venue_id FROM venues WHERE name ILIKE '%punchline%' AND city ILIKE '%atlanta%' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Every comedian you love did time here. Intimate room, two-drink minimum, and the person on stage might be the next Kevin Hart.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- Alliance Theatre
  SELECT id INTO v_venue_id FROM venues WHERE name ILIKE '%alliance theatre%' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Tony Award-winning theater at the Woodruff Arts Center. World premieres that end up on Broadway — see them here first, for half the price.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 7 Stages
  SELECT id INTO v_venue_id FROM venues WHERE name ILIKE '%7 stages%' OR name ILIKE '%seven stages%' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Little Five Points'' experimental theater. The shows are weird, the neighborhood is weirder, and that''s exactly the point.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- Horizon Theatre
  SELECT id INTO v_venue_id FROM venues WHERE name ILIKE '%horizon theatre%' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Intimate new-play incubator in Little Five Points. Original works and regional premieres in a space where every seat feels front row.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- Theatrical Outfit
  SELECT id INTO v_venue_id FROM venues WHERE name ILIKE '%theatrical outfit%' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Downtown''s resident theater company. Social justice-driven programming that makes you think as hard as it makes you feel.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- Actor's Express
  SELECT id INTO v_venue_id FROM venues WHERE name ILIKE '%actor%express%' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Edgy, provocative theater in the King Plow Arts Center. The kind of shows that start conversations on the drive home.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- Aurora Theatre
  SELECT id INTO v_venue_id FROM venues WHERE name ILIKE '%aurora theatre%' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Lawrenceville''s cultural anchor. Professional theater, comedy series, and a building that proves great art doesn''t need an ITP zip code.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- New American Shakespeare Tavern
  SELECT id INTO v_venue_id FROM venues WHERE name ILIKE '%shakespeare tavern%' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Dinner theater meets the Bard. Order shepherd''s pie, grab a beer, and watch Shakespeare the way it was originally performed — with an audience that eats.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- Whole World Improv Theatre
  SELECT id INTO v_venue_id FROM venues WHERE name ILIKE '%whole world%' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Improv and sketch comedy in a no-pretense space. The shows are BYOB and the comedians are fearless.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- Center for Puppetry Arts (performance angle)
  SELECT id INTO v_venue_id FROM venues WHERE name ILIKE '%puppetry arts%' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'The world''s largest puppetry museum — and the live performances are genuinely captivating for all ages. Jim Henson would approve.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  RAISE NOTICE 'Lights Camera Atlanta: mapped % venues', v_sort;
END $$;


-- ============================================================================
-- 4. "SpelHouse Spirit" — HBCU Culture & Black Excellence
-- ============================================================================

DO $$
DECLARE
  v_track_id UUID;
  v_venue_id INT;
  v_sort INT := 0;
BEGIN
  SELECT id INTO v_track_id FROM explore_tracks WHERE slug = 'spelhouse-spirit';
  IF v_track_id IS NULL THEN
    RAISE NOTICE 'Track spelhouse-spirit not found, skipping';
    RETURN;
  END IF;

  -- Paschal's (ID: 3207) — the civil rights meeting place
  v_sort := v_sort + 1;
  INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
  VALUES (v_track_id, 3207, v_sort, TRUE, 'approved',
    'Where MLK, John Lewis, and the movement gathered over fried chicken and strategy. Still serving, still essential, still the soul of the West End.')
  ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, is_featured = EXCLUDED.is_featured, editorial_blurb = EXCLUDED.editorial_blurb;

  -- The Beverly (ID: 715) — near Morehouse
  v_sort := v_sort + 1;
  INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
  VALUES (v_track_id, 715, v_sort, FALSE, 'approved',
    'The neighborhood bar where Morehouse grads and West End locals trade stories. Live music, cold drinks, and community that feels like family.')
  ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;

  -- Morehouse College
  SELECT id INTO v_venue_id FROM venues WHERE name ILIKE '%morehouse college%' OR name ILIKE '%morehouse%' AND venue_type IN ('university', 'college') LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, TRUE, 'approved',
      'The house that MLK, Spike Lee, and Samuel L. Jackson built. Campus events, lectures, and a homecoming that shuts down the city.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, is_featured = EXCLUDED.is_featured, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- Spelman College
  SELECT id INTO v_venue_id FROM venues WHERE name ILIKE '%spelman%' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, TRUE, 'approved',
      'The #1 HBCU in the nation. The Museum of Fine Art here focuses on African diaspora women artists — and the step shows are legendary.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, is_featured = EXCLUDED.is_featured, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- Clark Atlanta University
  SELECT id INTO v_venue_id FROM venues WHERE name ILIKE '%clark atlanta%' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Art galleries, visiting lectures, and a campus that buzzes with creative energy. The CAU art collection alone is worth the visit.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- Hammonds House Museum
  SELECT id INTO v_venue_id FROM venues WHERE name ILIKE '%hammonds house%' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, TRUE, 'approved',
      'A Victorian mansion turned museum of African American and Haitian art. One of the West End''s treasures — intimate, powerful, and free on First Fridays.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, is_featured = EXCLUDED.is_featured, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- APEX Museum (African American Panoramic Experience)
  SELECT id INTO v_venue_id FROM venues WHERE name ILIKE '%apex museum%' OR name ILIKE '%african american panoramic%' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Sweet Auburn''s museum of the African American experience. The trolley replica and interactive exhibits make history feel alive, not dusty.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- Busy Bee Cafe
  SELECT id INTO v_venue_id FROM venues WHERE name ILIKE '%busy bee%' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Soul food since 1947. Obama ate here. Oprah ate here. The fried chicken is a religious experience and the mac and cheese is non-negotiable.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- Shrine of the Black Madonna
  SELECT id INTO v_venue_id FROM venues WHERE name ILIKE '%shrine%black madonna%' OR name ILIKE '%shrine cultural%' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Part bookstore, part cultural center, part Pan-African gathering space. The reading selection alone could fill a semester of cultural studies.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- National Center for Civil and Human Rights
  SELECT id INTO v_venue_id FROM venues WHERE name ILIKE '%civil and human rights%' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'The lunch counter simulation will change you. From the civil rights movement to global human rights — a museum that earns every minute of your time.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- Ebenezer Baptist Church / King Center area
  SELECT id INTO v_venue_id FROM venues WHERE name ILIKE '%ebenezer baptist%' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Where MLK preached and where the movement found its voice. Sunday services are open to all — bring your whole heart.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  RAISE NOTICE 'SpelHouse Spirit: mapped % venues', v_sort;
END $$;
