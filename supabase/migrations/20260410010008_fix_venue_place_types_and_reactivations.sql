-- Fix place_type errors on key venues that break discovery filtering.
-- Fix incorrectly inactive records for operating venues.
-- Merge Fox Theatre duplicates.
-- Clean Aurora Theatre HTML entity in name.

-- ============================================================
-- 1. Place type corrections (affects music/nightlife tab filtering)
-- ============================================================

-- Music venues currently typed as bar/theater/venue
UPDATE places SET place_type = 'music_venue'
WHERE slug IN (
  'buckhead-theatre',        -- major concert venue, not a theater company
  'smiths-olde-bar',         -- live music 5 nights/week
  'northside-tavern',        -- blues institution
  'lakewood-amphitheatre'    -- Cellairis Amphitheatre (rebranded)
) AND place_type IN ('bar', 'theater', 'venue');

-- Also catch slug variants
UPDATE places SET place_type = 'music_venue'
WHERE name ILIKE '%smith%olde%bar%' AND place_type = 'bar';

UPDATE places SET place_type = 'music_venue'
WHERE name ILIKE '%northside tavern%' AND place_type = 'bar';

-- District Atlanta → nightclub
UPDATE places SET place_type = 'nightclub'
WHERE slug = 'district-atlanta' AND place_type = 'venue';

-- Ormsby's → bar
UPDATE places SET place_type = 'bar'
WHERE slug = 'ormsbys' AND place_type = 'venue';

-- Swan Coach House Gallery → gallery
UPDATE places SET place_type = 'gallery'
WHERE name ILIKE '%swan coach house%' AND place_type = 'restaurant';

-- ============================================================
-- 2. Reactivate incorrectly inactive venues
-- ============================================================

-- Center Stage main room — active source writes events to it
UPDATE places SET is_active = true
WHERE slug = 'center-stage-atlanta' AND is_active = false;

-- Venkman's — operating OFW venue with live music + dining
UPDATE places SET is_active = true
WHERE slug = 'venkmans' AND is_active = false;

-- Silverspot Cinema at The Battery — open and operating
UPDATE places SET is_active = true
WHERE name ILIKE '%silverspot%' AND is_active = false;

-- ============================================================
-- 3. Fox Theatre duplicate cleanup
-- ============================================================

-- Fix type on the mistyped record
UPDATE places SET place_type = 'theater'
WHERE slug = 'the-fox-theatre' AND place_type = 'venue';

-- Migrate events from the-fox-theatre to fox-theatre-atlanta
UPDATE events SET place_id = (SELECT id FROM places WHERE slug = 'fox-theatre-atlanta' LIMIT 1)
WHERE place_id = (SELECT id FROM places WHERE slug = 'the-fox-theatre' LIMIT 1)
  AND (SELECT id FROM places WHERE slug = 'fox-theatre-atlanta' LIMIT 1) IS NOT NULL;

-- Deactivate the duplicate after event migration
UPDATE places SET is_active = false
WHERE slug = 'the-fox-theatre'
  AND EXISTS (SELECT 1 FROM places WHERE slug = 'fox-theatre-atlanta');

-- ============================================================
-- 4. Aurora Theatre name cleanup (HTML entity)
-- ============================================================

UPDATE places SET name = REPLACE(name, '&#8211;', '—')
WHERE name LIKE '%&#8211;%';
