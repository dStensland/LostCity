-- ============================================================================
-- Track Description Cleanup + Y'allywood Rename
-- 1. Remove venue names from descriptions (venues change, vibes don't)
-- 2. Rename "Lights, Camera, Atlanta" → "Y'allywood"
-- 3. Fix sort orders for better banner images
-- ============================================================================

-- ============================================================================
-- PART 1: Rename track
-- ============================================================================

UPDATE explore_tracks
SET name = 'Y''allywood',
    slug = 'yallywood'
WHERE slug = 'lights-camera-atlanta';

-- ============================================================================
-- PART 2: Rewrite descriptions — category/vibe only, no venue names
-- ============================================================================

UPDATE explore_tracks SET description =
  'The big hits. Iconic landmarks, world-class attractions, and everything that makes a first trip unforgettable.'
WHERE slug = 'welcome-to-atlanta';

UPDATE explore_tracks SET description =
  'Walk where history was made. Sacred landmarks, powerful museums, and the stories that shaped a nation.'
WHERE slug = 'good-trouble';

UPDATE explore_tracks SET description =
  'Studios, stages, and the strip clubs that broke records. Where Atlanta built the sound that changed music forever.'
WHERE slug = 'the-south-got-something-to-say';

UPDATE explore_tracks SET description =
  '22 miles of trail connecting neighborhoods, murals, breweries, and food halls. The city''s backbone.'
WHERE slug = 'keep-moving-forward';

UPDATE explore_tracks SET description =
  'James Beard legends, soul food institutions, and the world tour on one road. Every neighborhood has a table worth sitting at.'
WHERE slug = 'the-itis';

UPDATE explore_tracks SET description =
  'Secret waterfalls, skyline hikes, Civil War ruins in the woods, and green spaces hidden inside a major metro.'
WHERE slug = 'city-in-a-forest';

UPDATE explore_tracks SET description =
  'Graffiti tunnels, artist compounds, free galleries, and the studios where Atlanta''s creative scene lives and works.'
WHERE slug = 'hard-in-da-paint';

UPDATE explore_tracks SET description =
  'A world tour without leaving the city. Ethiopian coffee ceremonies, Korean spa culture, Latin markets, and the global communities that make Atlanta international.'
WHERE slug = 'a-beautiful-mosaic';

UPDATE explore_tracks SET description =
  'Pride, drag, ballroom culture, and the spaces that make Atlanta a queer capital of the South.'
WHERE slug = 'too-busy-to-hate';

UPDATE explore_tracks SET description =
  'Underground nightclubs, Civil War ruins, a Tibetan monastery in the suburbs, and the delightfully strange side of Atlanta that most locals don''t even know.'
WHERE slug = 'the-midnight-train';

UPDATE explore_tracks SET description =
  'Pro stadiums, college rivalries, neighborhood sports bars, and the tailgate spots where Atlanta bleeds red and black.'
WHERE slug = 'keep-swinging';

UPDATE explore_tracks SET description =
  'Puppet shows, dinosaur halls, splash pads, and family adventures that make kids'' eyes go wide.'
WHERE slug = 'lifes-like-a-movie';

UPDATE explore_tracks SET description =
  'Hidden cocktail bars behind phone booths, unmarked doors, and password-only entrances. Atlanta''s secret drinking scene.'
WHERE slug = 'say-less';

UPDATE explore_tracks SET description =
  'Improv stages, indie theaters, film history, and the performance venues that earned Atlanta its Hollywood South nickname.'
WHERE slug = 'yallywood';

UPDATE explore_tracks SET description =
  'Homecoming energy, historic campuses, Black-owned institutions, and the culture that radiates from the AUC into every corner of the city.'
WHERE slug = 'spelhouse-spirit';

-- ============================================================================
-- PART 3: Fix "The South Got Something to Say" venue sort order
-- Put Trap Music Museum first for a stronger banner image
-- ============================================================================

DO $$
DECLARE
  v_track_id UUID;
  v_vid INT;
BEGIN
  SELECT id INTO v_track_id FROM explore_tracks WHERE slug = 'the-south-got-something-to-say';
  IF v_track_id IS NULL THEN RETURN; END IF;

  -- Move Trap Music Museum to sort_order 1
  SELECT id INTO v_vid FROM venues WHERE name ILIKE '%trap%museum%' LIMIT 1;
  IF v_vid IS NOT NULL THEN
    UPDATE explore_track_venues SET sort_order = 1, is_featured = TRUE
    WHERE track_id = v_track_id AND venue_id = v_vid;
  END IF;

  -- Bump Magic City to 2
  UPDATE explore_track_venues SET sort_order = 2
  WHERE track_id = v_track_id AND venue_id = 826;
END $$;
