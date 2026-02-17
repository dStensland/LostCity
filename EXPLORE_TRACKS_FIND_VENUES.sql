-- EXPLORE TRACKS - FIND MISSING VENUES FOR SPARSE TRACKS
-- Date: 2026-02-14
-- Purpose: SQL queries to identify venues that should be added to underpopulated tracks

-- ============================================================================
-- TRACK: A Beautiful Mosaic (International/Cultural)
-- Current: 1 venue | Target: 15-20 venues
-- ============================================================================

-- Find Buford Highway corridor restaurants/markets
SELECT 
  v.id,
  v.name,
  v.neighborhood,
  v.address,
  v.venue_type,
  v.image_url,
  COUNT(e.id) as upcoming_events
FROM venues v
LEFT JOIN events e ON e.venue_id = v.id AND e.start_date >= CURRENT_DATE
WHERE (
  v.neighborhood IN ('Doraville', 'Clarkston', 'Duluth', 'Chamblee', 'Norcross', 'Brookhaven', 'Buford Highway')
  OR v.address ILIKE '%Buford%Highway%'
  OR v.address ILIKE '%Buford%Hwy%'
)
AND v.venue_type IN ('restaurant', 'food_hall', 'farmers_market', 'community_center', 'cultural_center', 'market', 'venue')
AND v.name != 'Buford Highway Farmers Market'
AND v.id NOT IN (
  SELECT venue_id FROM explore_track_venues 
  WHERE track_id = (SELECT id FROM explore_tracks WHERE slug = 'a-beautiful-mosaic')
)
GROUP BY v.id, v.name, v.neighborhood, v.address, v.venue_type, v.image_url
ORDER BY upcoming_events DESC, v.neighborhood, v.name
LIMIT 30;

-- Find international restaurants by name keywords
SELECT 
  v.id,
  v.name,
  v.neighborhood,
  v.venue_type,
  v.image_url,
  COUNT(e.id) as upcoming_events
FROM venues v
LEFT JOIN events e ON e.venue_id = v.id AND e.start_date >= CURRENT_DATE
WHERE v.venue_type IN ('restaurant', 'food_hall', 'market')
AND (
  -- Korean
  v.name ILIKE '%seoul%' OR v.name ILIKE '%korea%' OR v.name ILIKE '%bbq%' OR 
  v.name ILIKE '%tofu%' OR v.name ILIKE '%kimchi%' OR
  -- Vietnamese  
  v.name ILIKE '%pho%' OR v.name ILIKE '%banh mi%' OR v.name ILIKE '%saigon%' OR
  -- Chinese
  v.name ILIKE '%szechuan%' OR v.name ILIKE '%hunan%' OR v.name ILIKE '%dim sum%' OR 
  v.name ILIKE '%peking%' OR v.name ILIKE '%shanghai%' OR v.name ILIKE '%wok%' OR
  -- Latin
  v.name ILIKE '%taqueria%' OR v.name ILIKE '%pupuseria%' OR v.name ILIKE '%arepa%' OR
  v.name ILIKE '%empanada%' OR v.name ILIKE '%latino%' OR v.name ILIKE '%mexicana%' OR
  -- Ethiopian
  v.name ILIKE '%ethiopia%' OR v.name ILIKE '%abyssinia%' OR
  -- Indian
  v.name ILIKE '%curry%' OR v.name ILIKE '%masala%' OR v.name ILIKE '%tandoor%' OR 
  v.name ILIKE '%chaat%' OR v.name ILIKE '%biryani%' OR
  -- Middle Eastern
  v.name ILIKE '%kabob%' OR v.name ILIKE '%shawarma%' OR v.name ILIKE '%falafel%' OR 
  v.name ILIKE '%halal%' OR v.name ILIKE '%mediterranean%'
)
AND v.name != 'Buford Highway Farmers Market'
AND v.id NOT IN (
  SELECT venue_id FROM explore_track_venues 
  WHERE track_id = (SELECT id FROM explore_tracks WHERE slug = 'a-beautiful-mosaic')
)
GROUP BY v.id, v.name, v.neighborhood, v.venue_type, v.image_url
ORDER BY upcoming_events DESC, v.name
LIMIT 30;

-- ============================================================================
-- TRACK: Too Busy to Hate (LGBTQ+)
-- Current: 2 venues | Target: 10-15 venues
-- ============================================================================

-- Find LGBTQ+ bars and nightclubs by name
SELECT 
  v.id,
  v.name,
  v.neighborhood,
  v.venue_type,
  v.image_url,
  v.website_url,
  COUNT(e.id) as upcoming_events
FROM venues v
LEFT JOIN events e ON e.venue_id = v.id AND e.start_date >= CURRENT_DATE
WHERE v.venue_type IN ('bar', 'nightclub', 'lounge', 'theater', 'community_center')
AND (
  v.name ILIKE '%blake%' OR 
  v.name ILIKE '%mary%' OR 
  v.name ILIKE '%swinging%' OR
  v.name ILIKE '%jungle%' OR 
  v.name ILIKE '%heretic%' OR 
  v.name ILIKE '%pride%' OR 
  v.name ILIKE '%friends%' OR
  v.name ILIKE '%burkhart%' OR 
  v.name ILIKE '%rooster%' OR
  v.name ILIKE '%eagle%' OR
  v.name ILIKE '%woof%' OR
  v.name ILIKE '%felix%' OR
  v.name ILIKE '%ten%atlanta%' OR
  v.name ILIKE '%lgbtq%' OR
  v.name ILIKE '%queer%'
)
AND v.name NOT IN ('My Sister''s Room', 'Piedmont Park')
AND v.id NOT IN (
  SELECT venue_id FROM explore_track_venues 
  WHERE track_id = (SELECT id FROM explore_tracks WHERE slug = 'too-busy-to-hate')
)
GROUP BY v.id, v.name, v.neighborhood, v.venue_type, v.image_url, v.website_url
ORDER BY upcoming_events DESC, v.neighborhood, v.name
LIMIT 20;

-- Find venues that host drag events
SELECT DISTINCT
  v.id,
  v.name,
  v.neighborhood,
  v.venue_type,
  v.image_url,
  COUNT(DISTINCT e.id) as drag_event_count
FROM venues v
JOIN events e ON e.venue_id = v.id
WHERE e.start_date >= CURRENT_DATE
AND (
  e.title ILIKE '%drag%' OR 
  e.title ILIKE '%pride%' OR
  e.title ILIKE '%queer%' OR
  e.title ILIKE '%lgbtq%' OR
  e.description ILIKE '%drag show%' OR
  e.subcategory = 'drag'
)
AND v.name NOT IN ('My Sister''s Room', 'Piedmont Park')
AND v.id NOT IN (
  SELECT venue_id FROM explore_track_venues 
  WHERE track_id = (SELECT id FROM explore_tracks WHERE slug = 'too-busy-to-hate')
)
GROUP BY v.id, v.name, v.neighborhood, v.venue_type, v.image_url
ORDER BY drag_event_count DESC, v.name
LIMIT 20;

-- ============================================================================
-- TRACK: The Midnight Train (Weird/Quirky)
-- Current: 2 venues | Target: 12-15 venues
-- ============================================================================

-- Find quirky venues by type and name
SELECT 
  v.id,
  v.name,
  v.neighborhood,
  v.venue_type,
  v.image_url,
  v.website_url,
  COUNT(e.id) as upcoming_events
FROM venues v
LEFT JOIN events e ON e.venue_id = v.id AND e.start_date >= CURRENT_DATE
WHERE (
  v.venue_type IN ('arcade', 'lounge', 'escape_room', 'game_bar', 'bowling_alley', 'oddity_shop')
  OR v.name ILIKE '%escape%'
  OR v.name ILIKE '%mystery%'
  OR v.name ILIKE '%immersive%'
  OR v.name ILIKE '%747%'
  OR v.name ILIKE '%joystick%'
  OR v.name ILIKE '%painted duck%'
  OR v.name ILIKE '%ormsby%'
  OR v.name ILIKE '%church%'
  OR v.name ILIKE '%louisa%'
  OR v.name ILIKE '%vortex%'
  OR v.name ILIKE '%crypt%'
  OR v.name ILIKE '%oddities%'
  OR v.name ILIKE '%battle%brew%'
  OR v.name ILIKE '%skyline%park%'
  OR v.name ILIKE '%delta%flight%'
  OR v.description ILIKE '%weird%'
  OR v.description ILIKE '%strange%'
  OR v.description ILIKE '%quirky%'
)
AND v.name NOT IN ('Clermont Lounge', 'Oakland Cemetery')
AND v.id NOT IN (
  SELECT venue_id FROM explore_track_venues 
  WHERE track_id = (SELECT id FROM explore_tracks WHERE slug = 'the-midnight-train')
)
GROUP BY v.id, v.name, v.neighborhood, v.venue_type, v.image_url, v.website_url
ORDER BY upcoming_events DESC, v.name
LIMIT 25;

-- Find venues with quirky/immersive events
SELECT DISTINCT
  v.id,
  v.name,
  v.neighborhood,
  v.venue_type,
  v.image_url,
  COUNT(DISTINCT e.id) as weird_event_count
FROM venues v
JOIN events e ON e.venue_id = v.id
WHERE e.start_date >= CURRENT_DATE
AND (
  e.title ILIKE '%escape%' OR
  e.title ILIKE '%mystery%' OR
  e.title ILIKE '%immersive%' OR
  e.title ILIKE '%experience%' OR
  e.title ILIKE '%weird%' OR
  e.title ILIKE '%strange%' OR
  e.description ILIKE '%immersive%' OR
  e.description ILIKE '%interactive%'
)
AND v.name NOT IN ('Clermont Lounge', 'Oakland Cemetery')
AND v.id NOT IN (
  SELECT venue_id FROM explore_track_venues 
  WHERE track_id = (SELECT id FROM explore_tracks WHERE slug = 'the-midnight-train')
)
GROUP BY v.id, v.name, v.neighborhood, v.venue_type, v.image_url
ORDER BY weird_event_count DESC, v.name
LIMIT 20;

-- ============================================================================
-- BONUS: Find BeltLine venues for "Keep Moving Forward" track
-- Current: 5 venues (after removing Orpheus) | Target: 10-12 venues
-- ============================================================================

SELECT 
  v.id,
  v.name,
  v.neighborhood,
  v.venue_type,
  v.image_url,
  COUNT(e.id) as upcoming_events
FROM venues v
LEFT JOIN events e ON e.venue_id = v.id AND e.start_date >= CURRENT_DATE
WHERE (
  v.neighborhood IN ('Old Fourth Ward', 'Inman Park', 'Piedmont Heights', 'West End', 'Reynoldstown')
  OR v.address ILIKE '%beltline%'
  OR v.description ILIKE '%beltline%'
  OR v.name ILIKE '%beltline%'
)
AND v.venue_type IN ('brewery', 'bar', 'restaurant', 'food_hall', 'park', 'gallery', 'market')
AND v.name NOT IN ('Orpheus Brewing', 'Historic Fourth Ward Park', 'Krog Street Market', 
                   'New Realm Brewing', 'Ponce City Market')
AND v.id NOT IN (
  SELECT venue_id FROM explore_track_venues 
  WHERE track_id = (SELECT id FROM explore_tracks WHERE slug = 'keep-moving-forward')
)
GROUP BY v.id, v.name, v.neighborhood, v.venue_type, v.image_url
ORDER BY upcoming_events DESC, v.name
LIMIT 20;

-- ============================================================================
-- END OF VENUE DISCOVERY QUERIES
-- ============================================================================
