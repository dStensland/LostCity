-- ============================================================================
-- Artifacts Explore Track: "Resurgens" is architecture/skyline,
-- this is the curiosities/artifacts track
-- ============================================================================

-- ============================================================================
-- 1. Create the track
-- ============================================================================

INSERT INTO explore_tracks (slug, name, quote, quote_source, description, sort_order)
VALUES
  ('artefacts-of-the-lost-city',
   'Artefacts of the Lost City',
   'I came for the airport. I stayed for the two-headed calf.',
   'Every tourist who accidentally wandered into the State Capitol',
   'Giant chickens, sealed time capsules, haunted gravestones, and a 10,000-pound painting. Atlanta''s weirdest, most wonderful physical artifacts.',
   18)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  quote = EXCLUDED.quote,
  quote_source = EXCLUDED.quote_source,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

-- ============================================================================
-- 2. Map all artifact venues to the track
-- ============================================================================

DO $$
DECLARE
  v_track_id UUID;
  v_venue_id INT;
  v_sort INT := 0;
BEGIN
  SELECT id INTO v_track_id FROM explore_tracks WHERE slug = 'artefacts-of-the-lost-city';
  IF v_track_id IS NULL THEN
    RAISE NOTICE 'Track artefacts-of-the-lost-city not found, skipping';
    RETURN;
  END IF;

  -- 1. The Big Chicken (standalone icon)
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'the-big-chicken' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, TRUE, 'approved',
      '56-foot steel chicken. Pilots navigate by it. KFC rebuilt it after a storm decapitated it. This is Atlanta.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, is_featured = EXCLUDED.is_featured, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 2. Crypt of Civilization
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'crypt-of-civilization' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, TRUE, 'approved',
      'World''s first time capsule. Sealed 1940. Inside: a typewriter, a Budweiser, and a machine that teaches English. Opens year 8113.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, is_featured = EXCLUDED.is_featured, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 3. The Cyclorama
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'the-cyclorama' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, TRUE, 'approved',
      '10,000-pound oil painting, 358 feet around. Originally a Union victory — Atlanta re-spun it as Confederate. Restored in 2019.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, is_featured = EXCLUDED.is_featured, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 4. Two-Headed Calf & Moon Rocks
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'two-headed-calf-moon-rocks' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, TRUE, 'approved',
      'Taxidermied two-headed calf + Apollo moon rocks. Fourth floor of the State Capitol. Free. Returned by popular demand after removal.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, is_featured = EXCLUDED.is_featured, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 5. Doll's Head Trail
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'dolls-head-trail' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Folk art trail made entirely of river trash and doll heads. You can add to it — but only with debris found in the park.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 6. Autoeater
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'autoeater' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      '32,000 pounds of Carrara marble shaped like a worm eating a Fiat. Commentary on Atlanta''s car obsession, carved in Tuscany.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 7. Vortex Laughing Skull
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'vortex-laughing-skull' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      '20-foot psychedelic skull entrance. You literally walk through the gaping mouth to enter a bar. Zero subtlety since 1996.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 8. Coca-Cola Secret Recipe Vault
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'coca-cola-vault' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'The vault with the world''s most famous secret recipe. You can see the door but not the formula. Only two people know it at any time.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 9. Zero Mile Post
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'zero-mile-post' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'The rock that started Atlanta. Railroad terminus marker, circa 1850. Without this stone, the city would be a forest.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 10. The Great Fish
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'the-great-fish' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Guinness-certified world''s largest fish statue. 65 feet long, 50 tons, anchored 90 feet into the ground. It''s developed a patina like the Statue of Liberty.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 11. Noguchi Playscape
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'noguchi-playscape' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'The only Isamu Noguchi playground in the US. Sculpture you can climb on. Hidden in Piedmont Park near the Park Drive entrance.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 12. Bobby Jones' Grave
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'bobby-jones-grave' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Golf legend''s grave at Oakland Cemetery. Fans still leave golf balls on the headstone daily.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 13. Jack Smith Armchair Statue
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'jack-smith-armchair-statue' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Life-size granite man in an armchair, watching the Oakland Cemetery gates for eternity. One of the Southeast''s most distinctive gravestones.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 14. Pemberton Statue
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'pemberton-statue' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Bronze of the pharmacist who invented Coca-Cola. Standing proudly, holding a glass of Coke, near the World of Coca-Cola.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 15. Fountain of Rings
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'fountain-of-rings' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'World''s largest interactive fountain — 251 jets in Olympic ring formation. The bricks around it hold 430,000 engraved names.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 16. The Varsity Neon Sign
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'the-varsity-neon-sign' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Neon icon of the world''s largest drive-in. Visible from the interstate since 1928.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 17. The Storyteller (Stag-Man)
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'the-storyteller-stag-man' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Naked antlered man surrounded by rabbits. Bronze. Buckhead Library grounds. Nobody asked for it. Everybody loves it.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 18. Giant Hands of Dr. Sid
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'giant-hands-of-dr-sid' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      '18-foot bronze hands performing a chiropractic adjustment on an invisible giant. Complete with replica championship rings.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 19. Phoenix Rising
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'phoenix-rising-sculpture' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'A woman lifted by a phoenix from flames. Atlanta''s rebirth after Sherman, cast in bronze and installed in Woodruff Park.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 20. Sope Creek Paper Mill Ruins
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'sope-creek-paper-mill-ruins' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Multi-story stone ruins of a Civil War paper mill. Looks like a medieval castle rising from the forest. 3-mile hike to reach it.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 21. Millennium Gate
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'millennium-gate' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      '100-foot Roman triumphal arch. Was meant for D.C. — they said no, Atlanta said yes and spent $20 million building it.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 22. Whittier Mill Tower
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'whittier-mill-tower' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Last surviving tower of an 1896 cotton mill on the Chattahoochee. The rest was demolished — this brick ghost remains.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 23. World Athletes Monument
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'world-athletes-monument' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Prince Charles''s Olympic gift to Atlanta. 55-foot monument that became a spontaneous Princess Diana memorial in 1997.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 24. Folk Art Park
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'folk-art-park' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Howard Finster visionary art floating above 16 lanes of highway. Built for the Olympics, forgotten by most, loved by the few who know.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 25. Hoo-Hoo Monument
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'hoo-hoo-monument' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Monument from the Concatenated Order of Hoo-Hoo — a lumber fraternity founded in 1892. The name alone justifies a visit.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 26. Ramblin' Wreck (new)
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'ramblin-wreck' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      '1930 Ford Model A that leads Georgia Tech onto the field. Stolen multiple times by rival schools. Guarded 24/7 during rivalry weeks.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 27. Willie B Statue (new)
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'willie-b-statue' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Bronze memorial to a gorilla who watched TV alone for 27 years, then became Atlanta''s most famous animal. His death made national news.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 28. 54 Columns (Sol LeWitt)
  SELECT id INTO v_venue_id FROM venues WHERE slug = '54-columns' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      '54 concrete columns by Sol LeWitt mirroring Atlanta''s skyline. Art in America''s top public art of 2000. Renovated into a pocket park in 2024.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 29. Sideways the Dog's Grave
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'sideways-the-dogs-grave' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Georgia Tech''s crooked dog. Thrown from a car, walked at a permanent tilt, became the campus mascot. Her headstone is set at an angle too.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 30. Lord Dooley Statue
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'lord-dooley-statue' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      '$80K bronze skeleton descending from the sky. Emory''s "Lord of Misrule" since 1899. The living Dooley can cancel classes with a squirt gun.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 31. Anti-Gravity Monument
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'anti-gravity-monument' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'A pink tombstone on a wooded hill at Emory, urging the defeat of gravity. Donated by a millionaire whose sister and grandson drowned.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 32. Fiddlin' John Carson's Grave
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'fiddlin-john-carsons-grave' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'The man who made the first hit country record in 1923. His headstone shows him fiddling with his foot on an outline of Georgia.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 33. Hank Aaron Home Run Wall
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'hank-aaron-home-run-wall' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, TRUE, 'approved',
      'The actual wall section HR #715 cleared on April 8, 1974. The swing that broke Ruth''s record, despite death threats and hate mail.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, is_featured = EXCLUDED.is_featured, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 34. Kermit the Frog Chaplin Statue
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'kermit-chaplin-statue' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, TRUE, 'approved',
      '12-foot Kermit dressed as Charlie Chaplin. Stood at Jim Henson Studios for 25 years. The Henson family chose Atlanta because Kermit opened this place in 1978.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, is_featured = EXCLUDED.is_featured, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 35. The Spirit of Delta
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'spirit-of-delta' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, TRUE, 'approved',
      'A Boeing 767 bought by 7,000 employees for their own airline. Flew 70,697 hours. Towed across two public roads to reach the museum.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, is_featured = EXCLUDED.is_featured, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 36. One-Person Jail Cell
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'one-person-jail-cell' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Last surviving 1890s police lockup box. Phone-booth-sized. Room for one prisoner, standing. When empty, cops stored their hats inside.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 37. Adalanta Desert Plaque
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'adalanta-desert-plaque' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'A plaque honoring the history of a parallel universe where Atlanta is a desert. Part of a global art project with markers in 30+ countries.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 38. Elvis Shrine Vault
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'elvis-shrine-vault' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Bank vault turned Elvis shrine. Original vault door intact. Safety deposit boxes full of memorabilia. Punk shows upstairs, The King rests below.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 39. 1895 Exposition Steps
  SELECT id INTO v_venue_id FROM venues WHERE slug = '1895-exposition-steps' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Last physical remnant of the 1895 World''s Fair that put Atlanta on the map. Booker T. Washington spoke here. Now hidden in Piedmont Park.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 40. 2 Chainz's Pink Chevy
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'pink-trap-house-chevy' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'The pink Chevy from 2 Chainz''s Pink Trap House. Fans kept jumping on it. Now inside T.I.''s Trap Music Museum with a firm "do not stand on the car" rule.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 41. The Confessional Photobooth
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'confessional-photobooth' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'A real church confessional turned photobooth at Sister Louisa''s. Choir robes, organ karaoke, and satirical religious art complete the scene.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 42. Fulton Bag Mill Smokestacks
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'fulton-bag-mill-smokestacks' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, FALSE, 'approved',
      'Twin 1881 smokestacks still standing over Cabbagetown. Built on ashes Sherman left behind. The "Stacks" that named the neighborhood.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  -- 43. Owl Rock
  SELECT id INTO v_venue_id FROM venues WHERE slug = 'owl-rock' LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    v_sort := v_sort + 1;
    INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
    VALUES (v_track_id, v_venue_id, v_sort, TRUE, 'approved',
      '16th-century Creek nation carving on an 8-foot boulder. Hidden in a church cemetery. 300 years older than Atlanta itself.')
    ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, is_featured = EXCLUDED.is_featured, editorial_blurb = EXCLUDED.editorial_blurb;
  END IF;

  RAISE NOTICE 'Artefacts of the Lost City: mapped % venues', v_sort;
END $$;
