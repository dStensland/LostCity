-- Seed explore_category on existing venues based on venue_type
-- This gives the Explore tab immediate content without manual curation

-- Museums & Galleries
UPDATE venues SET explore_category = 'museums_galleries'
WHERE venue_type IN ('museum', 'gallery')
  AND explore_category IS NULL;

-- Performing Arts (theaters, music venues, comedy clubs)
UPDATE venues SET explore_category = 'performing_arts'
WHERE venue_type IN ('theater', 'music_venue', 'comedy_club')
  AND explore_category IS NULL;

-- Parks & Outdoors
UPDATE venues SET explore_category = 'parks_outdoors'
WHERE venue_type IN ('park', 'garden', 'outdoor_venue')
  AND explore_category IS NULL;

-- Landmarks & Attractions (arenas, stadiums, amphitheaters, zoos, aquariums)
UPDATE venues SET explore_category = 'landmarks_attractions'
WHERE venue_type IN ('arena', 'stadium', 'amphitheater', 'zoo', 'aquarium')
  AND explore_category IS NULL;

-- Tours & Experiences (attractions, distilleries, breweries, wineries)
UPDATE venues SET explore_category = 'tours_experiences'
WHERE venue_type IN ('attraction', 'distillery', 'brewery', 'winery')
  AND explore_category IS NULL;

-- Food & Culture (food halls only — restaurants are too numerous for auto-seeding)
UPDATE venues SET explore_category = 'food_culture'
WHERE venue_type IN ('food_hall')
  AND explore_category IS NULL;

-- Hidden Gems
UPDATE venues SET explore_category = 'hidden_gems'
WHERE venue_type IN ('record_store', 'bookstore')
  AND explore_category IS NULL;

-- Feature well-known Atlanta landmarks with hero treatment + blurbs
UPDATE venues SET explore_featured = true, explore_blurb = 'The Southeast''s premier art museum, with a permanent collection spanning centuries and rotating world-class exhibitions.'
WHERE slug = 'high-museum-of-art' AND explore_featured IS NOT true;

UPDATE venues SET explore_featured = true, explore_blurb = 'A 30-acre living garden in the heart of Midtown. Seasonal exhibitions, canopy walks, and one of the best orchid collections in the country.'
WHERE slug = 'atlanta-botanical-garden' AND explore_featured IS NOT true;

UPDATE venues SET explore_featured = true, explore_blurb = 'Atlanta''s backyard. 200 acres of green space, trails, a lake, and the anchor of the BeltLine corridor.'
WHERE slug = 'piedmont-park' AND explore_featured IS NOT true;

UPDATE venues SET explore_featured = true, explore_blurb = 'A 1929 movie palace turned legendary performance venue. The Mighty Mo organ, the Egyptian ballroom, and the starlit ceiling are unforgettable.'
WHERE slug = 'fox-theatre' AND explore_featured IS NOT true;

UPDATE venues SET explore_featured = true, explore_blurb = 'Home of the Atlanta Hawks and host to the biggest concerts and events in the city.'
WHERE slug = 'state-farm-arena' AND explore_featured IS NOT true;

UPDATE venues SET explore_featured = true, explore_blurb = 'Home of the Falcons and Atlanta United. 71,000 seats, a retractable roof, and the world''s largest halo video board.'
WHERE slug = 'mercedes-benz-stadium' AND explore_featured IS NOT true;

UPDATE venues SET explore_featured = true, explore_blurb = 'A historic Sears building reborn as Atlanta''s most vibrant food hall, market, and rooftop destination on the BeltLine.'
WHERE slug = 'ponce-city-market' AND explore_featured IS NOT true;

UPDATE venues SET explore_featured = true, explore_blurb = 'An industrial food hall on the BeltLine Eastside Trail. Local restaurants, a craft bar, and one of the city''s best patios.'
WHERE slug = 'krog-street-market' AND explore_featured IS NOT true;

UPDATE venues SET explore_featured = true, explore_blurb = 'The only museum in the US dedicated to the art of puppetry. Beloved by families and Jim Henson fans alike.'
WHERE slug = 'center-for-puppetry-arts' AND explore_featured IS NOT true;

UPDATE venues SET explore_featured = true, explore_blurb = 'Natural history museum with dinosaur galleries, a walk-through forest, an IMAX theater, and a planetarium.'
WHERE slug = 'fernbank-museum' AND explore_featured IS NOT true;

UPDATE venues SET explore_featured = true, explore_blurb = 'A 33-acre history campus with the 1928 Swan House, Civil War exhibits, and the Kenan Research Center.'
WHERE slug = 'atlanta-history-center' AND explore_featured IS NOT true;

UPDATE venues SET explore_featured = true, explore_blurb = 'Walk where Dr. King was born, preached, and is laid to rest. A powerful and essential piece of American history.'
WHERE slug = 'martin-luther-king-jr-national-historical-park' AND explore_featured IS NOT true;

UPDATE venues SET explore_featured = true, explore_blurb = 'A hidden state park just minutes from downtown with creek-side trails, waterfall views, and Civil War ruins.'
WHERE slug = 'sweetwater-creek-state-park' AND explore_featured IS NOT true;

UPDATE venues SET explore_featured = true, explore_blurb = 'The heart of downtown Atlanta, built for the 1996 Olympics. Fountains, green space, and gateway to the city''s major attractions.'
WHERE slug = 'centennial-olympic-park' AND explore_featured IS NOT true;

UPDATE venues SET explore_featured = true, explore_blurb = 'The story of the world''s most famous beverage. Interactive exhibits, tasting rooms, and the secret vault.'
WHERE slug = 'world-of-coca-cola' AND explore_featured IS NOT true;

-- Additional featured performing arts venues
UPDATE venues SET explore_featured = true, explore_blurb = 'Atlanta''s Tony Award-winning theater company. Bold productions in the heart of Midtown''s arts district.'
WHERE slug = 'alliance-theatre' AND explore_featured IS NOT true;

UPDATE venues SET explore_featured = true, explore_blurb = 'The intimate home of improv, stand-up, and sketch comedy in Atlanta. Laughing Skull Lounge upstairs.'
WHERE slug = 'venkman-s' AND explore_featured IS NOT true;
