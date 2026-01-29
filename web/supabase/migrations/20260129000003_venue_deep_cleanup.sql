-- Migration: Deep Venue Cleanup
-- Fixes address-only venues, reclassifies event_spaces, removes invalid entries

-- ============================================================================
-- PART 1: Reclassify event_space venues to proper types
-- ============================================================================

-- Hotels
UPDATE venues SET venue_type = 'hotel'
WHERE venue_type = 'event_space' AND (
  name ILIKE '%marriott%' OR name ILIKE '%hotel%' OR name ILIKE '%hyatt%'
  OR name ILIKE '%hilton%' OR name ILIKE '%renaissance%' OR name ILIKE '%westin%'
  OR name ILIKE '%ritz%' OR name ILIKE '%meridien%' OR name ILIKE '%courtland%'
);

-- Theaters
UPDATE venues SET venue_type = 'theater'
WHERE venue_type = 'event_space' AND (
  name ILIKE '%theatre%' OR name ILIKE '%theater%' OR name ILIKE '%playhouse%'
  OR name ILIKE '%tara %' OR name ILIKE '%legacy theatre%' OR name ILIKE '%plaza theater%'
  OR name ILIKE '%dad''s garage%' OR name ILIKE '%black box%'
);

-- Galleries
UPDATE venues SET venue_type = 'gallery'
WHERE venue_type = 'event_space' AND (
  name ILIKE '%gallery%' OR name ILIKE '%fine art%' OR name ILIKE '%arts center%'
);

-- Convention centers
UPDATE venues SET venue_type = 'convention_center'
WHERE venue_type = 'event_space' AND (
  name ILIKE '%convention%' OR name ILIKE '%congress center%'
  OR name ILIKE '%americasmart%' OR name ILIKE '%galleria centre%'
  OR name ILIKE '%conference center%'
);

-- Studios
UPDATE venues SET venue_type = 'studio'
WHERE venue_type = 'event_space' AND (
  name ILIKE '%studio%' OR name ILIKE '%creative%' OR name ILIKE '%productions%'
);

-- Restaurants/Bars
UPDATE venues SET venue_type = 'restaurant'
WHERE venue_type = 'event_space' AND (
  name ILIKE '%restaurant%' OR name ILIKE '%fish market%'
  OR name ILIKE '%kitchen%' OR name ILIKE '%grill%' OR name ILIKE '%cooking school%'
);

UPDATE venues SET venue_type = 'bar'
WHERE venue_type = 'event_space' AND (
  name ILIKE '%lounge%' OR name ILIKE '%bar%' OR name ILIKE '%punch bowl%'
  OR name ILIKE '%libations%' OR name ILIKE '%spa%'
);

-- Churches
UPDATE venues SET venue_type = 'church'
WHERE venue_type = 'event_space' AND (
  name ILIKE '%church%' OR name ILIKE '%cathedral%' OR name ILIKE '%chapel%'
);

-- Recreation
UPDATE venues SET venue_type = 'recreation'
WHERE venue_type = 'event_space' AND (
  name ILIKE '%fowling%' OR name ILIKE '%fun center%' OR name ILIKE '%games%'
  OR name ILIKE '%activate%'
);

-- Music venues
UPDATE venues SET venue_type = 'music_venue'
WHERE venue_type = 'event_space' AND (
  name ILIKE '%concert hall%' OR name ILIKE '%recital hall%'
  OR name ILIKE '%reverb%' OR name ILIKE '%hertz stage%' OR name ILIKE '%backstage%'
);

-- Institutions
UPDATE venues SET venue_type = 'institution'
WHERE venue_type = 'event_space' AND (
  name ILIKE '%college%' OR name ILIKE '%university%' OR name ILIKE '%campus%'
  OR name ILIKE '%hall %' OR name ILIKE '% hall%' OR name ILIKE '%ymca%'
  OR name ILIKE '%city hall%' OR name ILIKE '%home depot%store support%'
);

-- Entertainment
UPDATE venues SET venue_type = 'entertainment'
WHERE venue_type = 'event_space' AND (
  name ILIKE '%battery%' OR name ILIKE '%underground%' OR name ILIKE '%pullman%'
  OR name ILIKE '%downtown%' OR name ILIKE '%dragon con%' OR name ILIKE '%expo%'
  OR name ILIKE '%gathering spot%' OR name ILIKE '%revel%' OR name ILIKE '%big top%'
);

-- Nightclubs
UPDATE venues SET venue_type = 'nightclub'
WHERE venue_type = 'event_space' AND (
  name = 'Bloom' OR name = 'Seven MidTown'
);

-- ============================================================================
-- PART 2: Fix address-only venues with real business names
-- ============================================================================

UPDATE venues SET name = 'Peters Street Station', venue_type = 'gallery'
WHERE name = '333 Peters St SW';

UPDATE venues SET name = '800 East Studios', venue_type = 'studio'
WHERE name = '800 E Ave NE';

UPDATE venues SET name = 'The Elliot at Armour Yards'
WHERE name = '159 Armour Dr NE';

UPDATE venues SET name = 'Armour Yards Event Space'
WHERE name = '199 Armour Dr NE';

UPDATE venues SET name = 'Atlantic Station', venue_type = 'entertainment'
WHERE name = '1380 Atlantic Dr NW';

-- ============================================================================
-- PART 3: Deactivate invalid/placeholder venues
-- ============================================================================

UPDATE venues SET active = false
WHERE name IN (
  'Private Residence',
  'Location provided after booking',
  'Various Locations',
  'East Atlanta Village',
  'Inman Park',
  'Auburn Avenue',
  'Downtown Atlanta',
  'Cherokee Ave. Overpass at I-20',
  'Windy Ridge Bridge at I-75',
  'Piedmont Luminaria Event',
  'Southern Fried Queer Pride',
  '1100 Crescent Ave NE'
);

-- Deactivate address-only venues without business names
UPDATE venues SET active = false
WHERE name ~ '^[0-9]+\s'
  AND venue_type = 'event_space'
  AND name NOT IN ('7 Stages', '404 Found ATL', '529 Bar');

-- Deactivate equipment rental (not a venue)
UPDATE venues SET active = false WHERE name ILIKE '%lightscape%';

-- ============================================================================
-- PART 4: Fix specific venue types
-- ============================================================================

UPDATE venues SET venue_type = 'theater' WHERE name = '7 Stages';
UPDATE venues SET venue_type = 'gallery' WHERE name = '404 Found ATL';
UPDATE venues SET venue_type = 'bar' WHERE name = '529 Bar';
UPDATE venues SET venue_type = 'theater' WHERE name = 'Dad''s Garage';
UPDATE venues SET venue_type = 'gallery' WHERE name = 'The Supermarket ATL';
UPDATE venues SET venue_type = 'music_venue' WHERE name = 'Backstage Atlanta';
UPDATE venues SET venue_type = 'coworking' WHERE name = 'Science Square Labs';
