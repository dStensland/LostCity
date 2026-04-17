-- ============================================================
-- MIGRATION: Exhibition Coverage — Venue Cleanup
-- ============================================================
-- Phase 0.2: Reclassify mistyped venues
-- Phase 3: Deactivate junk venues with no website/data
-- Part of the exhibition coverage expansion sprint.

-- ---------------------------------------------------------------
-- Phase 0.2: Reclassify mistyped venues
-- ---------------------------------------------------------------

-- LS Acting Studios: arts_center → studio (acting studio, not arts center)
UPDATE venues SET venue_type = 'studio', spot_type = 'studio'
WHERE id = 6 AND venue_type = 'arts_center';

-- Symphony Hall at Woodruff: gallery → music_venue (it's a symphony hall)
UPDATE venues SET venue_type = 'music_venue', spot_type = 'music_venue'
WHERE id = 1752 AND venue_type = 'gallery';

-- Atlanta Ink Tattoo: gallery → studio (tattoo shop)
UPDATE venues SET venue_type = 'studio', spot_type = 'studio'
WHERE id = 2426 AND venue_type = 'gallery';

-- Encore Film And Music Studio: gallery → studio
UPDATE venues SET venue_type = 'studio', spot_type = 'studio'
WHERE id = 64 AND venue_type = 'gallery';

-- Metropolitan Studios: gallery → studio
UPDATE venues SET venue_type = 'studio', spot_type = 'studio'
WHERE id = 42 AND venue_type = 'gallery';

-- ---------------------------------------------------------------
-- Phase 3: Deactivate junk museum/gallery venues
-- These have no website, no data, and no crawl path.
-- ---------------------------------------------------------------

-- Peach Museum: no website, no data
UPDATE venues SET active = false
WHERE id = 6536 AND active = true;

-- The Culture Experience Atlanta: no website, no data
UPDATE venues SET active = false
WHERE id = 6533 AND active = true;

-- Future Gallery: no website, no data
UPDATE venues SET active = false
WHERE id = 6527 AND active = true;

-- Gallery 72: no website, no data
UPDATE venues SET active = false
WHERE id = 6528 AND active = true;

-- Paige Harvey Art Studio: no website, no data
UPDATE venues SET active = false
WHERE id = 6529 AND active = true;

-- Porter Sanford III: actually Ballethnic's performing arts venue
UPDATE venues SET venue_type = 'performing_arts', spot_type = 'performing_arts'
WHERE id = 6516 AND venue_type IN ('gallery', 'museum', 'arts_center');
