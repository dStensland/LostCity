-- Atlanta skyline landmarks: iconic buildings as venue entries + highlights
-- New landmark venues for buildings not already in DB
-- Highlights on existing venues for buildings that are already present

-- ============================================================
-- NEW LANDMARK VENUES
-- ============================================================

-- Bank of America Plaza
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Bank of America Plaza', 'bank-of-america-plaza', 'skyscraper', 'Atlanta', 'GA', 'Midtown',
  33.7611, -84.3868,
  'The tallest building in the Southeast at 1,023 feet. Completed in 1992 in just 14 months, its spire is covered in 23-karat gold leaf and glows orange against the night sky. The postmodern design channels the stepped form of Art Deco towers like the Chrysler Building.',
  'Tallest building in the Southeast. 23-karat gold spire.',
  true, 'landmarks_attractions'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'bank-of-america-plaza');

-- King and Queen Towers
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'King and Queen Towers', 'king-and-queen-towers', 'skyscraper', 'Atlanta', 'GA', 'Sandy Springs',
  33.9245, -84.3426,
  'The crown-topped Concourse Corporate Center towers are the most recognizable silhouette on the Perimeter skyline. The "King" (34 floors) and "Queen" (28 floors) change their crown lighting colors for holidays and major city events.',
  'Crown-topped twin towers with color-changing spires.',
  true, 'landmarks_attractions'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'king-and-queen-towers');

-- One Atlantic Center (IBM Tower)
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'One Atlantic Center', 'one-atlantic-center', 'skyscraper', 'Atlanta', 'GA', 'Midtown',
  33.7836, -84.3853,
  'Philip Johnson''s 50-story postmodern Gothic tower, completed in 1987. The pointed copper spire and setback crown echo medieval European cathedrals — the same architect who designed New York''s AT&T Building. Locals still call it the IBM Tower.',
  'Philip Johnson''s Gothic postmodern tower on West Peachtree.',
  true, 'landmarks_attractions'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'one-atlantic-center');

-- Georgia-Pacific Tower
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Georgia-Pacific Tower', 'georgia-pacific-tower', 'skyscraper', 'Atlanta', 'GA', 'Downtown',
  33.7589, -84.3878,
  'The 52-story pink granite monolith designed by Skidmore, Owings & Merrill. Completed in 1982, its stair-stepped exterior staggers down to street level using granite quarried from Marble Falls, Texas. The rosy hue shifts from salmon to copper depending on the light.',
  'Pink granite stair-stepped tower on Peachtree.',
  true, 'landmarks_attractions'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'georgia-pacific-tower');

-- 191 Peachtree Tower
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT '191 Peachtree Tower', '191-peachtree-tower', 'skyscraper', 'Atlanta', 'GA', 'Downtown',
  33.7614, -84.3862,
  'The 50-story tower completed in 1991, recognizable by its distinctive two-pronged Gothic crown that frames the sky. The polished granite and glass lobby features a 70-foot atrium. Designed by John Burgee with Philip Johnson.',
  'Gothic twin-pronged crown visible across the skyline.',
  true, 'landmarks_attractions'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = '191-peachtree-tower');

-- Rhodes Hall
INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
SELECT 'Rhodes Hall', 'rhodes-hall', 'landmark', 'Atlanta', 'GA', 'Midtown',
  33.7923, -84.3856,
  'The last surviving residential mansion on Peachtree Street, built in 1904 for furniture magnate Amos Giles Rhodes. This Romanesque Revival castle features nine rare painted stained glass windows depicting the rise and fall of the Confederacy — some of the only narrative Civil War stained glass in existence.',
  'Last mansion on Peachtree. 1904 Romanesque Revival castle.',
  true, 'landmarks_attractions'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'rhodes-hall');

-- ============================================================
-- HIGHLIGHTS: NEW LANDMARK VENUES
-- ============================================================

-- Bank of America Plaza
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', '23-Karat Gold Leaf Spire',
  'The open-lattice pyramid crown is covered in 23-karat gold leaf — 96% pure gold. High-pressure sodium lamps light it from within, producing the signature orange glow visible from 20+ miles on clear nights.',
  0
FROM venues v WHERE v.slug = 'bank-of-america-plaza'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = '23-Karat Gold Leaf Spire');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Built in 14 Months Flat',
  'Completed in 1992 at 1,023 feet — one of the fastest construction schedules for any building over 1,000 feet in history. Originally NationsBank Plaza, it remains the tallest building in any U.S. state capital.',
  1
FROM venues v WHERE v.slug = 'bank-of-america-plaza'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Built in 14 Months Flat');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'viewpoint', '55th Floor Panoramic Views',
  'The recently renovated 55th floor features a tenant lounge with floor-to-ceiling windows and 360-degree views. The lobby at street level was redesigned with Italian marble, Venetian plaster, and a rotating art gallery.',
  2
FROM venues v WHERE v.slug = 'bank-of-america-plaza'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = '55th Floor Panoramic Views');

-- King and Queen Towers
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'hidden_feature', 'Color-Changing Crown Lights',
  'The illuminated crowns change colors for holidays and events — red and green for Christmas, pink for breast cancer awareness, rainbow for Pride. Most commuters on I-285 see the crowns daily without knowing the colors are intentional.',
  0
FROM venues v WHERE v.slug = 'king-and-queen-towers'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Color-Changing Crown Lights');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'photo_spot', 'Perimeter''s Most Iconic Silhouette',
  'Best photographed from the Ravinia Drive overpass at dusk when the crowns illuminate against the fading sky. The towers have appeared in dozens of films as shorthand for "corporate Atlanta."',
  1
FROM venues v WHERE v.slug = 'king-and-queen-towers'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Perimeter''s Most Iconic Silhouette');

-- One Atlantic Center
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'Philip Johnson''s Gothic Spire',
  'The same architect who designed New York''s AT&T Building (now 550 Madison) brought his postmodern Gothic sensibility to Atlanta. The copper-clad spire and stepped crown reference medieval cathedrals reinterpreted in glass and steel.',
  0
FROM venues v WHERE v.slug = 'one-atlantic-center'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Philip Johnson''s Gothic Spire');

-- Georgia-Pacific Tower
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'Pink Granite Stair-Steps',
  'The 52-story exterior uses pink granite quarried from Marble Falls, Texas. The staggered setbacks create a terraced silhouette that shifts from salmon to copper depending on the angle of sunlight. Designed by Skidmore, Owings & Merrill.',
  0
FROM venues v WHERE v.slug = 'georgia-pacific-tower'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Pink Granite Stair-Steps');

-- 191 Peachtree Tower
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'Gothic Twin-Pronged Crown',
  'The two-pronged crown frames open sky between the spires — a John Burgee and Philip Johnson collaboration completed in 1991. At street level, a 70-foot granite-and-glass atrium connects to an underground retail concourse.',
  0
FROM venues v WHERE v.slug = '191-peachtree-tower'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Gothic Twin-Pronged Crown');

-- Rhodes Hall
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'art', 'Civil War Stained Glass Windows',
  'Nine rare painted stained glass windows by Von Gerichten Art Glass depict the rise and fall of the Confederacy in vivid narrative panels. Among the only surviving narrative Civil War stained glass in the United States.',
  0
FROM venues v WHERE v.slug = 'rhodes-hall'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Civil War Stained Glass Windows');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Last Mansion on Peachtree Street',
  'When Amos Rhodes built this Romanesque Revival castle in 1904, Peachtree was lined with mansions. Every other one was demolished for commercial development. Rhodes Hall survives because the Georgia Trust for Historic Preservation made it their headquarters.',
  1
FROM venues v WHERE v.slug = 'rhodes-hall'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Last Mansion on Peachtree Street');

-- ============================================================
-- HIGHLIGHTS: EXISTING BUILDINGS ALREADY IN DB
-- ============================================================

-- Flatiron Building (exists as restaurant and bar)
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Atlanta''s Oldest Skyscraper (1897)',
  'Completed five years before New York City''s more famous Flatiron. Bradford Gilbert''s 11-story English Renaissance design at the narrow intersection of Peachtree and Broad is Atlanta''s oldest standing skyscraper. National Register of Historic Places since 1977.',
  0
FROM venues v WHERE v.slug = 'flatiron'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Atlanta''s Oldest Skyscraper (1897)');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Atlanta''s Oldest Skyscraper (1897)',
  'Completed five years before New York City''s more famous Flatiron. Bradford Gilbert''s 11-story English Renaissance design at the narrow intersection of Peachtree and Broad is Atlanta''s oldest standing skyscraper. National Register of Historic Places since 1977.',
  0
FROM venues v WHERE v.slug = 'the-flatiron'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Atlanta''s Oldest Skyscraper (1897)');

-- Candler Hotel (the original Candler Building)
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Coca-Cola Founder''s 1906 Tower',
  'Asa Griggs Candler — the man who bought the Coca-Cola formula for $2,300 — built this 17-story Beaux-Arts tower as Atlanta''s first steel-frame skyscraper. The ornate marble lobby with bronze fixtures was designed to project Coca-Cola''s newfound wealth.',
  0
FROM venues v WHERE v.slug = 'candler-hotel'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Coca-Cola Founder''s 1906 Tower');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'Georgia Marble Grand Lobby',
  'The lobby preserves original Georgia marble walls, hand-painted terra-cotta ceilings, and bronze elevator doors from 1906. The Hilton conversion kept every original architectural detail — the marble alone would be irreplaceable today.',
  1
FROM venues v WHERE v.slug = 'candler-hotel'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Georgia Marble Grand Lobby');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'Coca-Cola Founder''s 1906 Tower',
  'Asa Griggs Candler — the man who bought the Coca-Cola formula for $2,300 — built this 17-story Beaux-Arts tower as Atlanta''s first steel-frame skyscraper. The ornate marble lobby with bronze fixtures was designed to project Coca-Cola''s newfound wealth.',
  0
FROM venues v WHERE v.slug = 'the-candler-hotel-atlanta-curio-collection-by-hilton'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'Coca-Cola Founder''s 1906 Tower');

-- The Vick at Healey (Healey Building)
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', '1914 Neo-Gothic Skyscraper',
  'The Healey Building is one of Atlanta''s most ornate early skyscrapers — 16 stories of Gothic terra-cotta detailing, gargoyles, and pointed arches. The lobby features vaulted ceilings and decorative tilework that survived a century of downtown neglect.',
  0
FROM venues v WHERE v.slug = 'the-vick-at-healey'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = '1914 Neo-Gothic Skyscraper');

-- Atlanta Marriott Marquis
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'architecture', 'John Portman''s 47-Story Atrium',
  'Portman designed the building around a soaring 47-story interior atrium — the world''s largest hotel atrium when it opened in 1985. Glass elevators ride the walls while a sculptural fabric mobile twists through the void.',
  0
FROM venues v WHERE v.slug = 'atlanta-marriott-marquis'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'John Portman''s 47-Story Atrium');

INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'photo_spot', 'The "Pregnant Building" From Below',
  'The bulging base earned it the nickname "Pregnant Building." Stand in the lobby looking straight up through 47 floors of curving balconies converging to a distant skylight — the vertigo photo is an Atlanta architectural rite of passage.',
  1
FROM venues v WHERE v.slug = 'atlanta-marriott-marquis'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'The "Pregnant Building" From Below');

-- Hyatt Regency Atlanta (Portman first atrium hotel)
INSERT INTO venue_highlights (venue_id, highlight_type, title, description, sort_order)
SELECT v.id, 'history', 'The Hotel That Changed Hotels',
  'John Portman''s 1967 Hyatt Regency introduced the first modern hotel atrium — the 22-story interior courtyard with glass elevators that revolutionized hospitality architecture worldwide. Every atrium hotel since copies this building.',
  0
FROM venues v WHERE v.slug = 'hyatt-regency-atlanta'
AND NOT EXISTS (SELECT 1 FROM venue_highlights vh WHERE vh.venue_id = v.id AND vh.title = 'The Hotel That Changed Hotels');

-- ============================================================
-- ENRICH NEW SKYSCRAPER VENUES WITH WEBSITE + INSTAGRAM
-- ============================================================

UPDATE venues SET website = 'https://www.bankofamericaplaza.com/' WHERE slug = 'bank-of-america-plaza' AND website IS NULL;
UPDATE venues SET website = 'https://www.rhodeshall.org/', instagram = 'rhodeshall' WHERE slug = 'rhodes-hall' AND website IS NULL;
