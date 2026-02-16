-- Add "The Main Event" explore track — Festivals & Live Events
-- Covers festival grounds, amphitheaters, arenas (concert angle), and convention centers

-- Create the track
INSERT INTO explore_tracks (slug, name, quote, quote_source, description, sort_order)
VALUES (
  'the-main-event',
  'The Main Event',
  'Bring everybody you know',
  'Every Atlanta event flyer, ever',
  'Dragon Con to Music Midtown, Shaky Knees to Jazz Fest — the stages, parks, and arenas where Atlanta goes big.',
  15
)
ON CONFLICT (slug) DO NOTHING;

-- Map venues to the track
DO $$
DECLARE
  v_track_id UUID;
BEGIN
  SELECT id INTO v_track_id FROM explore_tracks WHERE slug = 'the-main-event';

  IF v_track_id IS NULL THEN
    RAISE NOTICE 'Track not found, skipping venue mappings';
    RETURN;
  END IF;

  -- Festival grounds & parks
  INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
  VALUES
    (v_track_id, 305, 1, TRUE, 'approved',
     'Atlanta''s front yard. Jazz Fest, Music Midtown, Dogwood Festival — if it''s big and outdoors, it''s probably here.'),
    (v_track_id, 147, 2, TRUE, 'approved',
     'The Olympic rings still glow. Summer concerts, holiday festivals, and the downtown gathering spot since ''96.'),
    (v_track_id, 306, 3, FALSE, 'approved',
     'Summer Shade Festival territory. Victorian houses, the zoo next door, and neighborhood festivals that feel like block parties.'),
    (v_track_id, 931, 4, TRUE, 'approved',
     'An abandoned rail yard reborn as Atlanta''s most immersive event space. Art installations, festivals, and things you won''t believe are real.')
  ON CONFLICT (track_id, venue_id) DO UPDATE SET
    sort_order = EXCLUDED.sort_order,
    is_featured = EXCLUDED.is_featured,
    editorial_blurb = EXCLUDED.editorial_blurb;

  -- Concert halls & amphitheaters
  INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
  VALUES
    (v_track_id, 118, 5, TRUE, 'approved',
     'A former church turned concert cathedral. The balcony views and the sound are both divine.'),
    (v_track_id, 311, 6, FALSE, 'approved',
     'Wine, cheese, candles, live music under the stars. Atlanta''s most civilized way to see a show.'),
    (v_track_id, 140, 7, FALSE, 'approved',
     'The Battery''s indoor arena. Perfect sightlines, 3,600 capacity, and you''re steps from a dozen restaurants after.')
  ON CONFLICT (track_id, venue_id) DO UPDATE SET
    sort_order = EXCLUDED.sort_order,
    is_featured = EXCLUDED.is_featured,
    editorial_blurb = EXCLUDED.editorial_blurb;

  -- Arenas & stadiums (concert/festival angle, not sports)
  INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
  VALUES
    (v_track_id, 126, 8, FALSE, 'approved',
     '21,000 seats of pure energy. From Beyonce to WWE, the biggest acts on earth stop here.'),
    (v_track_id, 108, 9, FALSE, 'approved',
     'The spaceship that opens its roof. 70,000 fans, $2 hot dogs, and an atmosphere unlike any stadium on earth.'),
    (v_track_id, 116, 10, FALSE, 'approved',
     'Duluth''s entertainment anchor. Comedy tours, concerts, and family shows — the suburbs have game too.'),
    (v_track_id, 103, 11, FALSE, 'approved',
     'More than a ballpark. The Battery district around it hosts concerts, festivals, and year-round events.')
  ON CONFLICT (track_id, venue_id) DO UPDATE SET
    sort_order = EXCLUDED.sort_order,
    editorial_blurb = EXCLUDED.editorial_blurb;

  -- Convention center (Dragon Con!)
  INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
  VALUES
    (v_track_id, 90, 12, TRUE, 'approved',
     'Dragon Con''s lair. Five days, five buildings, 80,000 costumes. Also MomoCon, Anime Weekend Atlanta, and every convention you didn''t know you needed.')
  ON CONFLICT (track_id, venue_id) DO UPDATE SET
    sort_order = EXCLUDED.sort_order,
    is_featured = EXCLUDED.is_featured,
    editorial_blurb = EXCLUDED.editorial_blurb;

END $$;
