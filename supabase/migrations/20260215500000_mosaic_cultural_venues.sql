-- Add cultural venues to "A Beautiful Mosaic" (Global Atlanta) track
-- The track was restaurant-heavy. Adding markets, cultural centers, and
-- community orgs to better represent Atlanta's international diversity.

DO $$
DECLARE
  v_track_id UUID := '773457ae-e687-410d-a0d1-caaad0dcc570'; -- a-beautiful-mosaic
BEGIN
  -- First, push existing restaurant sort_orders down to make room
  UPDATE explore_track_venues
  SET sort_order = sort_order + 10
  WHERE track_id = v_track_id;

  -- Add cultural venues with featured status and priority sort order
  -- Markets & plazas
  INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
  VALUES
    (v_track_id, 2623, 1, TRUE, 'approved',
     'Buford Highway''s indoor mercado. Quinceañera dresses, taquerias, jewelers, and a weekend energy that feels like Mexico City.'),
    (v_track_id, 2430, 2, FALSE, 'approved',
     'The Latin American strip mall that doubles as a community living room. Pupuserias, money transfers, and weekend concerts.'),
    (v_track_id, 352, 4, FALSE, 'approved',
     'Atlanta''s oldest public market. West African grocers next to Southern produce stands since 1924.')
  ON CONFLICT (track_id, venue_id) DO UPDATE SET
    sort_order = EXCLUDED.sort_order,
    is_featured = EXCLUDED.is_featured,
    editorial_blurb = EXCLUDED.editorial_blurb;

  -- Cultural & community centers
  INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
  VALUES
    (v_track_id, 756, 5, FALSE, 'approved',
     'The backbone of Atlanta''s Latino community since 1972. ESL classes, citizenship workshops, and cultural festivals.'),
    (v_track_id, 3931, 6, FALSE, 'approved',
     'Resettling refugees in Atlanta since 1979. Their community events connect Clarkston''s 60+ nationalities.'),
    (v_track_id, 979, 7, FALSE, 'approved',
     'A Moorish-revival landmark turned event space. The architecture alone is a trip around the Mediterranean.'),
    (v_track_id, 1972, 8, FALSE, 'approved',
     'West Midtown arts hub celebrating Black and diasporic culture through exhibitions and community workshops.'),
    (v_track_id, 985, 9, FALSE, 'approved',
     'The spiritual home of the civil rights movement. MLK''s pulpit, now a living monument to global justice.')
  ON CONFLICT (track_id, venue_id) DO UPDATE SET
    sort_order = EXCLUDED.sort_order,
    editorial_blurb = EXCLUDED.editorial_blurb;

  -- International neighborhood gems
  INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
  VALUES
    (v_track_id, 1804, 10, FALSE, 'approved',
     'Chamblee''s Chinatown anchor. Groceries, herbs, and a food court that transports you to Guangzhou.'),
    (v_track_id, 1722, 11, FALSE, 'approved',
     'Korean jjimjilbang in Duluth. Hot rooms, cold plunge, and a food court — a full Seoul experience.'),
    (v_track_id, 1334, 12, FALSE, 'approved',
     'Gwinnett''s community art center. Classes and exhibitions that spotlight the county''s global population.'),
    (v_track_id, 649, 13, FALSE, 'approved',
     'Georgia State''s Clarkston campus gallery. Student and community art from the most diverse square mile in America.')
  ON CONFLICT (track_id, venue_id) DO UPDATE SET
    sort_order = EXCLUDED.sort_order,
    editorial_blurb = EXCLUDED.editorial_blurb;

  -- Fix venue types for better categorization
  UPDATE venues SET venue_type = 'international_market' WHERE id = 2623 AND venue_type != 'international_market';
  UPDATE venues SET venue_type = 'international_market' WHERE id = 2430 AND venue_type != 'international_market';
  UPDATE venues SET venue_type = 'international_market' WHERE id = 1205 AND venue_type != 'international_market';
  UPDATE venues SET venue_type = 'cultural_center' WHERE id = 979 AND venue_type NOT LIKE '%cultural%';
  UPDATE venues SET neighborhood = 'Buford Highway' WHERE id = 2623 AND (neighborhood IS NULL OR neighborhood = '');

  -- Update Plaza Fiesta to featured on the track (it should be the banner image)
  -- Also feature Buford Highway Farmers Market which is already in the track
  UPDATE explore_track_venues SET is_featured = TRUE, sort_order = 3
  WHERE track_id = v_track_id AND venue_id = 1205;

END $$;
