-- Fix music venue classifications that keep getting overwritten by crawlers.
-- These are all well-known Atlanta music destinations that should always
-- appear in the music venue directory regardless of what crawlers infer.
--
-- Previous migrations (20260401000006, 20260401000011) set these correctly
-- but crawlers overwrote them. The companion crawler fix in db/places.py
-- prevents future regressions by protecting curated place_type values.

BEGIN;

-- Venues from original migration that reverted to 'venue'
UPDATE places SET place_type = 'music_venue'
WHERE slug IN (
  'terminal-west',
  'variety-playhouse',
  'tabernacle',
  'buckhead-theatre',
  'center-stage',
  'eddies-attic',
  'aisle-5',
  'city-winery-atlanta',
  'vinyl',
  'the-loft',
  'the-eastern',
  'coca-cola-roxy'
) AND place_type IN ('venue', 'bar');

-- The Earl — established music venue despite being a bar
UPDATE places SET place_type = 'music_venue'
WHERE slug = 'the-earl' AND place_type = 'bar';

-- Masquerade rooms — sub-venues of The Masquerade
UPDATE places SET place_type = 'music_venue'
WHERE slug IN (
  'the-masquerade-purgatory',
  'the-masquerade-hell',
  'the-masquerade-heaven'
) AND place_type = 'venue';

-- Additional established Atlanta music venues not in original migration
UPDATE places SET place_type = 'music_venue'
WHERE slug IN (
  'northside-tavern',       -- legendary blues bar
  'smiths-olde-bar',        -- established music venue with multiple stages
  'star-community-bar'      -- punk/indie music venue
) AND place_type = 'bar';

COMMIT;
