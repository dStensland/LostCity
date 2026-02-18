-- ============================================================================
-- Create missing venues from Explore Tracks Editorial Audit
-- ============================================================================

BEGIN;

-- ============================================================================
-- Batch 1: Food, Music & Culture (Tracks 3, 5)
-- ============================================================================

INSERT INTO venues (name, slug, neighborhood, city, state, venue_type, spot_type, description, active)
VALUES
  ('JR Crickets', 'jr-crickets', 'Multiple Locations', 'Atlanta', 'GA', 'restaurant', 'restaurant', 'Atlanta wings chain known for lemon pepper wet', true),
  ('K&K Soul Food', 'kk-soul-food', 'West End', 'Atlanta', 'GA', 'restaurant', 'restaurant', 'Soul food institution in West End', true),
  ('The Royal Peacock', 'the-royal-peacock', 'Sweet Auburn', 'Atlanta', 'GA', 'music_venue', 'bar', 'Historic Sweet Auburn music venue', true),
  ('Killer Mike''s SWAG Shop', 'killer-mikes-swag-shop', NULL, 'Atlanta', 'GA', 'retail', 'shop', 'Killer Mike''s barbershop and cultural hub', true),
  ('Escobar Restaurant & Tapas', 'escobar-restaurant', NULL, 'Atlanta', 'GA', 'restaurant', 'restaurant', '2 Chainz restaurant', true),
  ('Crates ATL', 'crates-atl', NULL, 'Atlanta', 'GA', 'retail', 'shop', 'Vinyl record shop', true),
  ('Tree Sound Studios', 'tree-sound-studios', NULL, 'Atlanta', 'GA', 'studio', 'studio', 'Legendary Atlanta recording studio', true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- Batch 2: Art venues (Track 7)
-- ============================================================================

INSERT INTO venues (name, slug, neighborhood, city, state, venue_type, spot_type, description, active)
VALUES
  ('Day & Night Projects', 'day-and-night-projects', NULL, 'Atlanta', 'GA', 'gallery', 'gallery', 'Contemporary art gallery', true),
  ('Echo Contemporary', 'echo-contemporary', NULL, 'Atlanta', 'GA', 'gallery', 'gallery', 'Contemporary art gallery and Guardian Studios', true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- Batch 3: International (Track 8)
-- ============================================================================

INSERT INTO venues (name, slug, neighborhood, city, state, venue_type, spot_type, description, active)
VALUES
  ('Global Mall', 'global-mall', 'Norcross', 'Norcross', 'GA', 'retail', 'market', 'First and largest indoor South Asian retail center in the US, 100+ businesses', true),
  ('Teso Life', 'teso-life', 'Duluth', 'Duluth', 'GA', 'retail', 'shop', 'Japanese/Korean lifestyle store', true),
  ('Kinokuniya Bookstore', 'kinokuniya-bookstore', 'Johns Creek', 'Johns Creek', 'GA', 'retail', 'shop', 'Japanese bookstore, 2nd largest US location, manga, Ghibli, stationery', true),
  ('Two Fish Myanmar', 'two-fish-myanmar', 'Clarkston', 'Clarkston', 'GA', 'restaurant', 'restaurant', 'Burmese restaurant, refugee couple turned pandemic cooking into brick and mortar', true),
  ('Treat Your Feet Doraville', 'treat-your-feet-doraville', 'Doraville', 'Doraville', 'GA', 'spa', 'spa', 'Chinese foot reflexology spa', true),
  ('Hanshin Pocha', 'hanshin-pocha', 'Duluth', 'Duluth', 'GA', 'restaurant', 'bar', 'Korean street tent bar and noraebang on Mall Blvd', true),
  ('KuKu Ethiopian Coffee', 'kuku-ethiopian-coffee', 'Clarkston', 'Clarkston', 'GA', 'restaurant', 'cafe', 'Traditional Ethiopian coffee ceremony, beans roasted before your eyes', true),
  ('Panaderia Del Valle', 'panaderia-del-valle', 'Buford Highway', 'Doraville', 'GA', 'restaurant', 'bakery', 'Mexican bakery on Buford Highway', true),
  ('Refuge Coffee Co.', 'refuge-coffee-co', 'Clarkston', 'Clarkston', 'GA', 'restaurant', 'cafe', 'Converted gas station cafe employing refugees, weekly pop-ups', true),
  ('Al-Farooq Masjid', 'al-farooq-masjid', 'Midtown', 'Atlanta', 'GA', 'religious', 'landmark', 'Largest mosque in the Southeast, founded 1970', true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- Batch 4: LGBTQ+ (Track 9)
-- ============================================================================

INSERT INTO venues (name, slug, neighborhood, city, state, venue_type, spot_type, description, active)
VALUES
  ('Rainbow Crosswalks', 'rainbow-crosswalks', 'Midtown', 'Atlanta', 'GA', 'landmark', 'landmark', 'Rainbow crosswalks at 10th & Piedmont, updated 2024 with inclusive stripes', true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- Batch 5: Gaming & Nerd (Track 10)
-- ============================================================================

INSERT INTO venues (name, slug, neighborhood, city, state, venue_type, spot_type, description, active)
VALUES
  ('The Wasteland Gaming', 'the-wasteland-gaming', 'Duluth', 'Duluth', 'GA', 'gaming', 'shop', 'Competitive TCG hub, 150+ player capacity', true),
  ('Portal Pinball Arcade', 'portal-pinball-arcade', 'Acworth', 'Acworth', 'GA', 'arcade', 'bar', '60+ pinball machines free play, craft beer', true),
  ('Contender eSports', 'contender-esports', 'Dunwoody', 'Dunwoody', 'GA', 'gaming', 'arcade', 'PC/console gaming center with leagues and tournaments', true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- Batch 6: Sports (Track 11)
-- ============================================================================

INSERT INTO venues (name, slug, neighborhood, city, state, venue_type, spot_type, description, active)
VALUES
  ('Black Bear Tavern', 'black-bear-tavern', 'Buckhead', 'Atlanta', 'GA', 'bar', 'bar', 'Buckhead''s oldest bar, Chicago sports HQ, Vienna Beef dogs', true),
  ('Fellaship', 'fellaship', 'Castleberry Hill', 'Atlanta', 'GA', 'lounge', 'bar', 'Cam Newton''s athlete-owned cigar lounge near MBS', true),
  ('Hank Aaron Memorial', 'hank-aaron-memorial', 'Summerhill', 'Atlanta', 'GA', 'landmark', 'landmark', 'Site of HR #715, future stadium and museum opening 2027', true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- Batch 7: Speakeasies & Cocktail (Track 13)
-- ============================================================================

INSERT INTO venues (name, slug, neighborhood, city, state, venue_type, spot_type, description, active)
VALUES
  ('The James Room', 'the-james-room', 'Old Fourth Ward', 'Atlanta', 'GA', 'bar', 'bar', 'Coffee shop by day, walk through bookshelf doors into velvet-draped lounge at night', true),
  ('Eleanor''s', 'eleanors', 'Smyrna', 'Smyrna', 'GA', 'bar', 'bar', 'Speakeasy through a freezer door inside Muss & Turner''s', true),
  ('Edgar''s Proof & Provision', 'edgars-proof-and-provision', 'Midtown', 'Atlanta', 'GA', 'bar', 'bar', 'Underground Prohibition bourbon bar beneath the 1911 Georgian Terrace Hotel, 120+ whiskeys', true),
  ('The Subway Speakeasy', 'the-subway-speakeasy', 'Decatur', 'Decatur', 'GA', 'bar', 'bar', 'Bookcase wall inside Sprig restaurant, converted Subway sandwich shop', true),
  ('The Waiting Room', 'the-waiting-room', 'Midtown', 'Atlanta', 'GA', 'bar', 'bar', 'Cocktail bar above Bon Ton, 70s aesthetic, live jazz', true),
  ('La Cueva', 'la-cueva', 'Old Fourth Ward', 'Atlanta', 'GA', 'bar', 'bar', 'Cave-themed mezcal bar at Ponce City Market, entered through a barbershop', true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- Batch 8: Skyscrapers - Downtown (Track 16)
-- ============================================================================

INSERT INTO venues (name, slug, neighborhood, city, state, venue_type, spot_type, description, active)
VALUES
  ('Truist Plaza', 'truist-plaza', 'Downtown', 'Atlanta', 'GA', 'skyscraper', 'landmark', '871 ft, 60 stories (1992). Second-tallest in Atlanta. John Portman stepped glass pyramid crown.', true),
  ('Flatiron Building Atlanta', 'flatiron-building-atlanta', 'Downtown', 'Atlanta', 'GA', 'historic_building', 'landmark', 'Atlanta''s oldest standing skyscraper (1897). Completed five years before NYC''s Flatiron.', true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- Batch 9: Skyscrapers - Midtown (Track 16)
-- ============================================================================

INSERT INTO venues (name, slug, neighborhood, city, state, venue_type, spot_type, description, active)
VALUES
  ('1072 West Peachtree', '1072-west-peachtree', 'Midtown', 'Atlanta', 'GA', 'skyscraper', 'landmark', '749 ft, 60 stories (completing spring 2026). Tallest new tower in Atlanta in 33 years.', true),
  ('Promenade II', 'promenade-ii', 'Midtown', 'Atlanta', 'GA', 'skyscraper', 'landmark', '691 ft, 40 stories (1989). Set at 45-degree angle to the street. Ziggurat-like stepping crown.', true),
  ('Tower Square', 'tower-square', 'Midtown', 'Atlanta', 'GA', 'skyscraper', 'landmark', '677 ft, 47 stories (1982). Formerly AT&T Midtown Center / BellSouth.', true),
  ('1180 Peachtree', '1180-peachtree', 'Midtown', 'Atlanta', 'GA', 'skyscraper', 'landmark', '657 ft, 41 stories (2006). The Batman Building. Two elliptically-curved glass fins.', true),
  ('The Atlantic', 'the-atlantic', 'West Midtown', 'Atlanta', 'GA', 'skyscraper', 'landmark', '577 ft, 46 stories (2009). Art Deco-inspired tower, tallest purely residential building in Atlanta.', true),
  ('1100 Peachtree', '1100-peachtree', 'Midtown', 'Atlanta', 'GA', 'skyscraper', 'landmark', '428 ft, 28 stories (1990). Octagonal stair-stepped crown. Warm terra-cotta/brick facade.', true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- Batch 10: Skyscrapers - Buckhead (Track 16)
-- ============================================================================

INSERT INTO venues (name, slug, neighborhood, city, state, venue_type, spot_type, description, active)
VALUES
  ('3344 Peachtree', '3344-peachtree', 'Buckhead', 'Atlanta', 'GA', 'skyscraper', 'landmark', '665 ft, 50 stories (2008). Buckhead''s tallest. Sculptural overlapping curves.', true),
  ('Terminus 100', 'terminus-100', 'Buckhead', 'Atlanta', 'GA', 'skyscraper', 'landmark', '485 ft, 26 stories (2007). Heart of Buckhead''s business district.', true),
  ('The Paramount at Buckhead', 'the-paramount-at-buckhead', 'Buckhead', 'Atlanta', 'GA', 'skyscraper', 'landmark', '478 ft, 40 stories (2004). Luxury condo tower.', true),
  ('Ritz-Carlton Residences Buckhead', 'ritz-carlton-residences-buckhead', 'Buckhead', 'Atlanta', 'GA', 'skyscraper', 'landmark', '469 ft, 34 stories (2009). 126 luxury residences stacked above Class A office.', true),
  ('Buckhead Grand', 'buckhead-grand', 'Buckhead', 'Atlanta', 'GA', 'skyscraper', 'landmark', '451 ft, 38 stories (2004). Signature curved glass facade.', true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- Batch 11: Filming Locations (Track 18)
-- ============================================================================

INSERT INTO venues (name, slug, neighborhood, city, state, venue_type, spot_type, description, active)
VALUES
  ('Porsche Experience Center', 'porsche-experience-center', 'Hapeville', 'Hapeville', 'GA', 'attraction', 'attraction', 'Avengers HQ exterior. Test track and restaurant open to public.', true),
  ('Swan House', 'swan-house', 'Buckhead', 'Atlanta', 'GA', 'historic_building', 'landmark', 'President Snow''s mansion in Hunger Games. Located at Atlanta History Center.', true),
  ('Silver Skillet', 'silver-skillet', 'Midtown', 'Atlanta', 'GA', 'restaurant', 'restaurant', 'Operating since 1956. Featured in Ozark, Remember the Titans, The Founder.', true),
  ('Healey Building', 'healey-building', 'Downtown', 'Atlanta', 'GA', 'historic_building', 'landmark', 'Baby Driver filming location (Doc''s HQ). Neo-Gothic landmark (1914).', true),
  ('Wheat Street Towers', 'wheat-street-towers', 'Old Fourth Ward', 'Atlanta', 'GA', 'historic_building', 'landmark', 'Black Panther opening/closing scenes (Oakland). Historic Auburn Ave.', true),
  ('Odd Fellows Building', 'odd-fellows-building', 'Downtown', 'Atlanta', 'GA', 'historic_building', 'landmark', 'Baby Driver filming location (Baby''s apartment).', true),
  ('Senoia Walking Dead Town', 'senoia-walking-dead', 'Senoia', 'Senoia', 'GA', 'town', 'landmark', 'Main Street IS Woodbury. Alexandria set across the railroad tracks. Walking Dead Cafe, museum.', true),
  ('Jackson GA / Hawkins', 'jackson-ga-hawkins', 'Jackson', 'Jackson', 'GA', 'town', 'landmark', 'Town square IS Hawkins from Stranger Things. Murals and Hawkins Headquarters fan shop.', true),
  ('Covington GA / Mystic Falls', 'covington-ga-mystic-falls', 'Covington', 'Covington', 'GA', 'town', 'landmark', 'Vampire Diaries filming location. Town square, Gilbert house, guided tours.', true),
  ('JD''s on the Lake', 'jds-on-the-lake', NULL, 'Cartersville', 'GA', 'restaurant', 'restaurant', 'The actual Blue Cat Lodge set from Ozark, converted into a real restaurant on Lake Allatoona.', true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- Batch 12: Native Heritage (Track 20)
-- ============================================================================

INSERT INTO venues (name, slug, neighborhood, city, state, venue_type, spot_type, description, active)
VALUES
  ('Standing Peachtree Park', 'standing-peachtree-park', 'Buckhead', 'Atlanta', 'GA', 'park', 'park', 'Site of Pakanahuili, the Creek village that gave every Peachtree street its name. New kayak launch (Dec 2024).', true),
  ('Soapstone Ridge', 'soapstone-ridge', 'Southeast Atlanta', 'Atlanta', 'GA', 'historic_site', 'park', 'Most extensive Native American soapstone quarry sites in the Southeast. 3000-1000 BC. National Register.', true),
  ('Etowah Indian Mounds', 'etowah-indian-mounds', NULL, 'Cartersville', 'GA', 'historic_site', 'landmark', 'Most intact Mississippian site in the Southeast. 63-ft Great Temple Mound.', true),
  ('Ocmulgee Mounds', 'ocmulgee-mounds', NULL, 'Macon', 'GA', 'historic_site', 'landmark', '10,000 years of habitation. Only reconstructed Earth Lodge on the continent. On track to become Georgia''s first National Park.', true),
  ('New Echota', 'new-echota', NULL, 'Calhoun', 'GA', 'historic_site', 'landmark', 'Cherokee Nation capital (1825-removal). Site of the Cherokee Phoenix newspaper and the Treaty that triggered the Trail of Tears.', true),
  ('Funk Heritage Center', 'funk-heritage-center', NULL, 'Waleska', 'GA', 'museum', 'museum', 'Georgia''s official Frontier and Southeastern Indian Interpretive Center. NPS-certified Trail of Tears site.', true),
  ('Chief Vann House', 'chief-vann-house', NULL, 'Chatsworth', 'GA', 'historic_site', 'landmark', 'Showplace of the Cherokee Nation. 1804 brick mansion, floating staircase.', true),
  ('Track Rock Gap Petroglyphs', 'track-rock-gap', NULL, 'Blairsville', 'GA', 'historic_site', 'landmark', '100+ petroglyphs on soapstone boulders, 3,600+ years old.', true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- Batch 13: Georgia Tech Campus (Track 21)
-- ============================================================================

INSERT INTO venues (name, slug, neighborhood, city, state, venue_type, spot_type, description, active)
VALUES
  ('Tech Tower', 'tech-tower', 'Georgia Tech', 'Atlanta', 'GA', 'campus_landmark', 'landmark', 'The icon of Georgia Tech. Lighted TECH signs on four sides. National Register Historic District.', true),
  ('Kessler Campanile', 'kessler-campanile', 'Georgia Tech', 'Atlanta', 'GA', 'campus_landmark', 'landmark', '80-ft twisted stainless steel obelisk built for the 96 Olympics. 244 steel plates.', true),
  ('Brittain Dining Hall', 'brittain-dining-hall', 'Georgia Tech', 'Atlanta', 'GA', 'campus_landmark', 'landmark', '1928 neo-Jacobean great hall. Stained glass, corbeled busts of famous engineers.', true),
  ('McAuley Aquatic Center', 'mcauley-aquatic-center', 'Georgia Tech', 'Atlanta', 'GA', 'campus_landmark', 'landmark', '1996 Olympic swimming venue. GT was the only single university to serve as an Olympic Village.', true),
  ('The Kendeda Building', 'the-kendeda-building', 'Georgia Tech', 'Atlanta', 'GA', 'campus_landmark', 'landmark', 'Georgia''s first Living Building Challenge-certified structure. Mass timber, composting toilets, 225% energy from solar.', true),
  ('Seven Bridges Plaza', 'seven-bridges-plaza', 'Georgia Tech', 'Atlanta', 'GA', 'campus_landmark', 'landmark', 'Landscape replicating Euler''s Seven Bridges of Konigsberg problem.', true),
  ('Technology Square', 'technology-square', 'Midtown', 'Atlanta', 'GA', 'campus_landmark', 'landmark', '2M+ sqft innovation district. 35+ corporate innovation centers.', true),
  ('Coda Building', 'coda-building', 'Midtown', 'Atlanta', 'GA', 'campus_landmark', 'landmark', '$375M, 21 stories. World''s tallest spiral staircase (17 stories). Ground-floor food hall.', true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- Batch 14: Other missing venues
-- ============================================================================

INSERT INTO venues (name, slug, neighborhood, city, state, venue_type, spot_type, description, active)
VALUES
  ('WHIPLASH Comedy Club', 'whiplash-comedy-club', 'Old Fourth Ward', 'Atlanta', 'GA', 'comedy_club', 'bar', 'Opening summer 2026 at Ponce City Market. Two rooms, close-up magic, karaoke.', true),
  ('Big Bethel AME Church', 'big-bethel-ame-church', 'Sweet Auburn', 'Atlanta', 'GA', 'religious', 'landmark', 'Historic African Methodist Episcopal church on Auburn Avenue', true),
  ('Boulevard Crossing Park', 'boulevard-crossing-park', 'Boulevard Heights', 'Atlanta', 'GA', 'park', 'park', 'BeltLine Southside Trail park', true),
  ('Atlanta BeltLine Center', 'atlanta-beltline-center', NULL, 'Atlanta', 'GA', 'community_center', 'landmark', 'BeltLine visitor and community center', true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- Batch 15: Artefact venues (Track 17 - parent_venue_id to be set in reconciliation)
-- ============================================================================

INSERT INTO venues (name, slug, neighborhood, city, state, venue_type, spot_type, description, active)
VALUES
  ('Ramesses I Mummy', 'ramesses-i-mummy', 'Druid Hills', 'Atlanta', 'GA', 'artifact', 'landmark', 'An actual pharaoh at the Carlos Museum. Bounced around Canadian sideshows before Emory scholars identified him.', true),
  ('Bodmer-Hanna Papyri', 'bodmer-hanna-papyri', 'Midtown', 'Atlanta', 'GA', 'artifact', 'landmark', 'Oldest known Lord''s Prayer text (~175 AD) at Millennium Gate Museum. Rest went to the Vatican.', true),
  ('Rodin''s The Shade', 'rodins-the-shade', 'Midtown', 'Atlanta', 'GA', 'artifact', 'landmark', 'Bronze donated by France after 1962 Orly crash killed 106 Atlanta art patrons. At Woodruff Arts Center.', true),
  ('Lichtenstein''s House III', 'lichtensteins-house-iii', 'Midtown', 'Atlanta', 'GA', 'artifact', 'landmark', 'Pop Art optical illusion on High Museum lawn. One of his last works.', true),
  ('Crowley Mausoleum', 'crowley-mausoleum', 'Decatur', 'Decatur', 'GA', 'artifact', 'landmark', 'Family mausoleum preserved in a Walmart parking lot on Memorial Dr.', true),
  ('Monkey from Mars', 'monkey-from-mars', 'Decatur', 'Decatur', 'GA', 'artifact', 'landmark', '1953 hoax. Preserved rhesus monkey at GBI Crime Lab Museum. Three guys shaved it and claimed it fell from the sky.', true)
ON CONFLICT (slug) DO NOTHING;

COMMIT;
