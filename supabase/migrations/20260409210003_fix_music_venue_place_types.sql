-- Fix place_type for major Atlanta music venues incorrectly typed as 'venue'.
-- These are dedicated music/performance venues that should always appear in
-- the music tab regardless of event volume.

UPDATE places SET place_type = 'music_venue'
WHERE slug IN (
  'terminal-west',
  'variety-playhouse',
  'tabernacle',
  'buckhead-theatre',
  'center-stage',
  'the-masquerade',
  'eddies-attic',
  'aisle-5',
  'city-winery-atlanta',
  'vinyl',
  'the-earl',
  '529',
  'the-loft'
) AND place_type = 'venue';

-- Also fix Masquerade rooms (may have separate place records)
UPDATE places SET place_type = 'music_venue'
WHERE name ILIKE '%masquerade%'
  AND place_type = 'venue';
