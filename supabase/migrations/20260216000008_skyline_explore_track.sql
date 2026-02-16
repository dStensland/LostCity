-- Two Explore Tracks: Skyscrapers + Rooftop Views
-- Depends on 20260216000007 (skyscraper venue inserts)

-- ============================================================
-- TRACK 1: RESURGENS — What's That Building?
-- ============================================================

INSERT INTO explore_tracks (slug, name, quote, quote_source, description, sort_order, is_active)
SELECT 'resurgens', 'Resurgens',
  'From the ashes, this city always rises',
  'Atlanta city motto — Latin for rising again',
  'A field guide to Atlanta''s skyline. Gold-leaf spires, pink granite stair-steps, glass atriums, and the tallest tower in the Southeast — every building you''ve ever pointed at and wondered about.',
  16, true
WHERE NOT EXISTS (SELECT 1 FROM explore_tracks WHERE slug = 'resurgens');

-- Bank of America Plaza (FEATURED)
INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, sort_order, is_featured, status)
SELECT t.id, v.id,
  'The tallest building in the Southeast at 1,023 feet. The 23-karat gold spire glows orange against the night sky — built in just 14 months in 1992.',
  1, true, 'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'resurgens' AND v.slug = 'bank-of-america-plaza'
AND NOT EXISTS (SELECT 1 FROM explore_track_venues etv WHERE etv.track_id = t.id AND etv.venue_id = v.id);

-- Marriott Marquis (FEATURED)
INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, sort_order, is_featured, status)
SELECT t.id, v.id,
  'John Portman''s 47-story atrium — the world''s largest hotel atrium when it opened. The "Pregnant Building." Look straight up from the lobby floor.',
  2, true, 'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'resurgens' AND v.slug = 'atlanta-marriott-marquis'
AND NOT EXISTS (SELECT 1 FROM explore_track_venues etv WHERE etv.track_id = t.id AND etv.venue_id = v.id);

-- Fox Theatre (FEATURED)
INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, sort_order, is_featured, status)
SELECT t.id, v.id,
  'The 1929 Moorish masterpiece Atlanta fought to save from demolition. Starlit ceiling, minarets, and Egyptian ballroom — the most beautiful interior in the city.',
  3, true, 'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'resurgens' AND v.slug = 'fox-theatre-atlanta'
AND NOT EXISTS (SELECT 1 FROM explore_track_venues etv WHERE etv.track_id = t.id AND etv.venue_id = v.id);

-- Westin Peachtree Plaza (FEATURED)
INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, sort_order, is_featured, status)
SELECT t.id, v.id,
  'Portman''s 73-story glass cylinder was the world''s tallest hotel when it opened in 1976. 5,600 panes of reflective glass. The signature glass elevators are an experience in themselves.',
  4, true, 'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'resurgens' AND v.slug = 'westin-peachtree-plaza'
AND NOT EXISTS (SELECT 1 FROM explore_track_venues etv WHERE etv.track_id = t.id AND etv.venue_id = v.id);

-- One Atlantic Center (IBM Tower)
INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, sort_order, is_featured, status)
SELECT t.id, v.id,
  'Philip Johnson''s 50-story Gothic postmodern spire — the same architect behind New York''s AT&T Building. The copper crown references medieval cathedrals.',
  5, false, 'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'resurgens' AND v.slug = 'one-atlantic-center'
AND NOT EXISTS (SELECT 1 FROM explore_track_venues etv WHERE etv.track_id = t.id AND etv.venue_id = v.id);

-- Georgia-Pacific Tower
INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, sort_order, is_featured, status)
SELECT t.id, v.id,
  'The 52-story pink granite monolith. Stair-stepped setbacks in Texas granite that shifts from salmon to copper depending on the light.',
  6, false, 'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'resurgens' AND v.slug = 'georgia-pacific-tower'
AND NOT EXISTS (SELECT 1 FROM explore_track_venues etv WHERE etv.track_id = t.id AND etv.venue_id = v.id);

-- 191 Peachtree Tower
INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, sort_order, is_featured, status)
SELECT t.id, v.id,
  'The twin-pronged Gothic crown that frames open sky between its spires. Another Philip Johnson collaboration — his fingerprints are all over the Atlanta skyline.',
  7, false, 'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'resurgens' AND v.slug = '191-peachtree-tower'
AND NOT EXISTS (SELECT 1 FROM explore_track_venues etv WHERE etv.track_id = t.id AND etv.venue_id = v.id);

-- King and Queen Towers
INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, sort_order, is_featured, status)
SELECT t.id, v.id,
  'The crown-topped twin towers that define the Perimeter skyline. The crowns change colors for holidays — red for Christmas, rainbow for Pride.',
  8, false, 'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'resurgens' AND v.slug = 'king-and-queen-towers'
AND NOT EXISTS (SELECT 1 FROM explore_track_venues etv WHERE etv.track_id = t.id AND etv.venue_id = v.id);

-- Hyatt Regency Atlanta
INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, sort_order, is_featured, status)
SELECT t.id, v.id,
  'The 1967 hotel that invented the modern atrium. Every atrium hotel in the world copies Portman''s 22-story interior courtyard with glass elevators.',
  9, false, 'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'resurgens' AND v.slug = 'hyatt-regency-atlanta'
AND NOT EXISTS (SELECT 1 FROM explore_track_venues etv WHERE etv.track_id = t.id AND etv.venue_id = v.id);

-- Flatiron Building
INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, sort_order, is_featured, status)
SELECT t.id, v.id,
  'Atlanta''s oldest standing skyscraper, completed in 1897 — five years before New York''s more famous Flatiron. The narrow wedge at Peachtree and Broad.',
  10, false, 'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'resurgens' AND v.slug = 'flatiron'
AND NOT EXISTS (SELECT 1 FROM explore_track_venues etv WHERE etv.track_id = t.id AND etv.venue_id = v.id);

-- Candler Hotel
INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, sort_order, is_featured, status)
SELECT t.id, v.id,
  'Asa Candler bought the Coca-Cola formula for $2,300 and built this 1906 Beaux-Arts tower to show for it. Georgia marble lobby and bronze elevator doors are originals.',
  11, false, 'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'resurgens' AND v.slug = 'candler-hotel'
AND NOT EXISTS (SELECT 1 FROM explore_track_venues etv WHERE etv.track_id = t.id AND etv.venue_id = v.id);

-- Healey Building (Vick at Healey)
INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, sort_order, is_featured, status)
SELECT t.id, v.id,
  'A 1914 Neo-Gothic skyscraper with gargoyles, terra-cotta arches, and a vaulted lobby that survived a century of downtown neglect. Now there''s a stage inside.',
  12, false, 'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'resurgens' AND v.slug = 'the-vick-at-healey'
AND NOT EXISTS (SELECT 1 FROM explore_track_venues etv WHERE etv.track_id = t.id AND etv.venue_id = v.id);

-- Rhodes Hall
INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, sort_order, is_featured, status)
SELECT t.id, v.id,
  'The last surviving mansion on Peachtree Street. A 1904 Romanesque castle with nine rare Civil War stained glass windows. Every other mansion fell to developers.',
  13, false, 'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'resurgens' AND v.slug = 'rhodes-hall'
AND NOT EXISTS (SELECT 1 FROM explore_track_venues etv WHERE etv.track_id = t.id AND etv.venue_id = v.id);

-- Rialto Center
INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, sort_order, is_featured, status)
SELECT t.id, v.id,
  'A 1916 vaudeville theater restored by Georgia State. Original terra-cotta facade and a 1,000-pound crystal chandelier found dismantled in the basement during renovation.',
  14, false, 'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'resurgens' AND v.slug = 'rialto-center'
AND NOT EXISTS (SELECT 1 FROM explore_track_venues etv WHERE etv.track_id = t.id AND etv.venue_id = v.id);

-- ============================================================
-- TRACK 2: ROOFTOP & SKYLINE VIEWS
-- ============================================================

INSERT INTO explore_tracks (slug, name, quote, quote_source, description, sort_order, is_active)
SELECT 'up-on-the-roof', 'Up on the Roof',
  'Way up on the roof, all my cares just drift right into space',
  'The Drifters, 1962',
  'Every rooftop bar, skyline viewpoint, and elevated perspective worth the elevator ride. The best spots to watch Atlanta light up at night.',
  17, true
WHERE NOT EXISTS (SELECT 1 FROM explore_tracks WHERE slug = 'up-on-the-roof');

-- Sun Dial Restaurant (FEATURED)
INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, sort_order, is_featured, status)
SELECT t.id, v.id,
  'The revolving restaurant at the top of the Westin. 73 floors up, the full city rotates past your table over the course of an hour. The bar and restaurant rotate independently.',
  1, true, 'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'up-on-the-roof' AND v.slug = 'sun-dial-restaurant'
AND NOT EXISTS (SELECT 1 FROM explore_track_venues etv WHERE etv.track_id = t.id AND etv.venue_id = v.id);

-- Jackson Street Bridge (FEATURED)
INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, sort_order, is_featured, status)
SELECT t.id, v.id,
  'The Walking Dead opening shot. The most photographed skyline view in Atlanta. Fans still recreate Rick Grimes'' ride into the abandoned city daily. Best at sunrise.',
  2, true, 'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'up-on-the-roof' AND v.slug = 'jackson-street-bridge'
AND NOT EXISTS (SELECT 1 FROM explore_track_venues etv WHERE etv.track_id = t.id AND etv.venue_id = v.id);

-- 9 Mile Station (FEATURED)
INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, sort_order, is_featured, status)
SELECT t.id, v.id,
  'The PCM rooftop bar with 270-degree views from the old Sears warehouse. Best vantage point for watching the skyline light up at dusk, drink in hand.',
  3, true, 'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'up-on-the-roof' AND v.slug = '9-mile-station'
AND NOT EXISTS (SELECT 1 FROM explore_track_venues etv WHERE etv.track_id = t.id AND etv.venue_id = v.id);

-- Polaris (FEATURED)
INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, sort_order, is_featured, status)
SELECT t.id, v.id,
  'Atlanta''s original rotating lounge since 1967 atop the Hyatt Regency. 90-minute rotation. The bar that started the revolving trend before Sun Dial existed.',
  4, true, 'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'up-on-the-roof' AND v.slug = 'polaris'
AND NOT EXISTS (SELECT 1 FROM explore_track_venues etv WHERE etv.track_id = t.id AND etv.venue_id = v.id);

-- Glenn Hotel
INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, sort_order, is_featured, status)
SELECT t.id, v.id,
  'The 10th-floor terrace puts you eye-level with the Flatiron Building''s wedge, with Bank of America Plaza towering behind it. Sunset turns the glass facades gold.',
  5, false, 'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'up-on-the-roof' AND v.slug = 'glenn-hotel'
AND NOT EXISTS (SELECT 1 FROM explore_track_venues etv WHERE etv.track_id = t.id AND etv.venue_id = v.id);

-- Six Feet Under
INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, sort_order, is_featured, status)
SELECT t.id, v.id,
  'Rooftop patio overlooking Oakland Cemetery with the downtown skyline rising behind Victorian tombstones. 1850s gravestones against 2020s glass — peak Atlanta.',
  6, false, 'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'up-on-the-roof' AND v.slug = 'six-feet-under'
AND NOT EXISTS (SELECT 1 FROM explore_track_venues etv WHERE etv.track_id = t.id AND etv.venue_id = v.id);

-- Georgian Terrace
INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, sort_order, is_featured, status)
SELECT t.id, v.id,
  'The north-facing patio frames the Fox Theatre marquee in the foreground with the Midtown skyline behind. The same view the Gone With the Wind premiere guests had in 1939.',
  7, false, 'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'up-on-the-roof' AND v.slug = 'georgian-terrace-hotel'
AND NOT EXISTS (SELECT 1 FROM explore_track_venues etv WHERE etv.track_id = t.id AND etv.venue_id = v.id);

-- Scofflaw Brewing
INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, sort_order, is_featured, status)
SELECT t.id, v.id,
  'Open-air rooftop on Huff Road facing east toward downtown across warehouses and train yards. Atlanta mid-transformation — half past, half future, beer in hand.',
  8, false, 'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'up-on-the-roof' AND v.slug = 'scofflaw-brewing'
AND NOT EXISTS (SELECT 1 FROM explore_track_venues etv WHERE etv.track_id = t.id AND etv.venue_id = v.id);

-- Canoe (river distance view)
INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, sort_order, is_featured, status)
SELECT t.id, v.id,
  'From the riverside patio, downtown appears as a distant cluster across miles of tree canopy. Best at twilight when the skyline glows orange against purple sky.',
  9, false, 'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'up-on-the-roof' AND v.slug = 'canoe-vinings'
AND NOT EXISTS (SELECT 1 FROM explore_track_venues etv WHERE etv.track_id = t.id AND etv.venue_id = v.id);

-- Bobby Dodd Stadium (skyline behind the end zone)
INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, sort_order, is_featured, status)
SELECT t.id, v.id,
  'One of the only college stadiums where a major city skyline is part of the backdrop. The east stands frame Downtown and Midtown beyond the north end zone.',
  10, false, 'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'up-on-the-roof' AND v.slug = 'bobby-dodd-stadium'
AND NOT EXISTS (SELECT 1 FROM explore_track_venues etv WHERE etv.track_id = t.id AND etv.venue_id = v.id);

-- New Realm Brewing (BeltLine rooftop)
INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, sort_order, is_featured, status)
SELECT t.id, v.id,
  'Three-story brewery right on the BeltLine Eastside Trail. The rooftop deck overlooks the BeltLine below with the Midtown skyline rising behind it.',
  11, false, 'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'up-on-the-roof' AND v.slug = 'new-realm-brewing'
AND NOT EXISTS (SELECT 1 FROM explore_track_venues etv WHERE etv.track_id = t.id AND etv.venue_id = v.id);

-- Ponce City Market (the building itself as a viewpoint)
INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, sort_order, is_featured, status)
SELECT t.id, v.id,
  'The 9th-floor open-air deck with panoramic Midtown skyline views, plus a rooftop amusement park. Free to visit the observation level.',
  12, false, 'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'up-on-the-roof' AND v.slug = 'ponce-city-market'
AND NOT EXISTS (SELECT 1 FROM explore_track_venues etv WHERE etv.track_id = t.id AND etv.venue_id = v.id);

-- Rooftop at Hotel Clermont
INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, sort_order, is_featured, status)
SELECT t.id, v.id,
  'The rooftop above Poncey-Highland''s legendary Clermont Lounge. One of the most Instagrammed rooftops in Atlanta — the Midtown skyline rises directly across the treetops.',
  13, false, 'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'up-on-the-roof' AND v.slug = 'rooftop-hotel-clermont'
AND NOT EXISTS (SELECT 1 FROM explore_track_venues etv WHERE etv.track_id = t.id AND etv.venue_id = v.id);

-- High Note Rooftop Bar
INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, sort_order, is_featured, status)
SELECT t.id, v.id,
  'Atop the AC Hotel in Midtown. Eye-level with the towers on Peachtree — close enough to feel the scale. Fire pits and cocktails with no cover charge.',
  14, false, 'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'up-on-the-roof' AND v.slug = 'high-note-rooftop-bar'
AND NOT EXISTS (SELECT 1 FROM explore_track_venues etv WHERE etv.track_id = t.id AND etv.venue_id = v.id);

-- Drawbar (Bellyard Hotel)
INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, sort_order, is_featured, status)
SELECT t.id, v.id,
  'The Bellyard Hotel''s rooftop in West Midtown. Industrial skyline views, Coca-Cola-braised short ribs, and handcrafted cocktails. The west-facing sunset is the draw.',
  15, false, 'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'up-on-the-roof' AND v.slug = 'drawbar'
AND NOT EXISTS (SELECT 1 FROM explore_track_venues etv WHERE etv.track_id = t.id AND etv.venue_id = v.id);

-- Moonlight at FORTH
INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, sort_order, is_featured, status)
SELECT t.id, v.id,
  'FORTH Hotel''s rooftop lounge in Old Fourth Ward. BeltLine views toward Midtown. The kind of place where the sunset and the cocktail menu compete for your attention.',
  16, false, 'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'up-on-the-roof' AND v.slug = 'moonlight-forth'
AND NOT EXISTS (SELECT 1 FROM explore_track_venues etv WHERE etv.track_id = t.id AND etv.venue_id = v.id);

-- 12 Cocktail Bar (PCM roof)
INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, sort_order, is_featured, status)
SELECT t.id, v.id,
  'The intimate cocktail bar on PCM''s roof level, separate from 9 Mile Station. Smaller, moodier, better drinks. Same Midtown skyline, different vibe entirely.',
  17, false, 'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'up-on-the-roof' AND v.slug = '12-cocktail-bar'
AND NOT EXISTS (SELECT 1 FROM explore_track_venues etv WHERE etv.track_id = t.id AND etv.venue_id = v.id);

-- Whiskey Blue (W Atlanta Buckhead)
INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, sort_order, is_featured, status)
SELECT t.id, v.id,
  'The W Hotel''s elevated lounge in Buckhead. Buckhead skyline views, upscale crowd, and a whiskey list deep enough to justify the name.',
  18, false, 'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'up-on-the-roof' AND v.slug = 'whiskey-blue'
AND NOT EXISTS (SELECT 1 FROM explore_track_venues etv WHERE etv.track_id = t.id AND etv.venue_id = v.id);

-- No Mas! Cantina
INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, sort_order, is_featured, status)
SELECT t.id, v.id,
  'Castleberry Hill''s hidden Mexican cantina with a rooftop patio facing downtown. Margaritas and the skyline from a neighborhood most tourists never find.',
  19, false, 'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'up-on-the-roof' AND v.slug = 'no-mas-cantina'
AND NOT EXISTS (SELECT 1 FROM explore_track_venues etv WHERE etv.track_id = t.id AND etv.venue_id = v.id);

-- Gypsy Kitchen (Buckhead)
INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, sort_order, is_featured, status)
SELECT t.id, v.id,
  'Two rooftop patios in Buckhead serving Spanish tapas with Moroccan and Indian accents. The Peachtree Road skyline view is the backdrop for eclectic small plates.',
  20, false, 'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'up-on-the-roof' AND v.slug = 'gypsy-kitchen'
AND NOT EXISTS (SELECT 1 FROM explore_track_venues etv WHERE etv.track_id = t.id AND etv.venue_id = v.id);

-- Monday Night Garage
INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, sort_order, is_featured, status)
SELECT t.id, v.id,
  'Monday Night''s Pittsburgh taproom in a converted garage. The rooftop deck overlooks the emerging Pittsburgh neighborhood with downtown in the distance — beer and gentrification in real time.',
  21, false, 'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'up-on-the-roof' AND v.slug = 'monday-night-garage'
AND NOT EXISTS (SELECT 1 FROM explore_track_venues etv WHERE etv.track_id = t.id AND etv.venue_id = v.id);

-- Stone Mountain Park (the summit)
INSERT INTO explore_track_venues (track_id, venue_id, editorial_blurb, sort_order, is_featured, status)
SELECT t.id, v.id,
  'The 1,686-foot summit — the highest viewpoint in metro Atlanta. On clear days the downtown skyline is a distant cluster 16 miles west across an ocean of trees. Hike or take the Skyride.',
  22, false, 'approved'
FROM explore_tracks t, venues v
WHERE t.slug = 'up-on-the-roof' AND v.slug = 'stone-mountain-park'
AND NOT EXISTS (SELECT 1 FROM explore_track_venues etv WHERE etv.track_id = t.id AND etv.venue_id = v.id);
