-- Migration: Atlanta Downtown venue backfill
--
-- Seeds ~30 high-value Downtown Atlanta venues discovered from
-- atlantadowntown.com directories (dining + destinations) that are
-- NOT already in the system. Focused on event-capable venues,
-- notable destinations, and cultural landmarks.
--
-- Uses ON CONFLICT (slug) DO NOTHING for idempotency.
-- Source: Central Atlanta Progress (atlantadowntown.com) directories.

-- ============================================================
-- GALLERIES & ART SPACES
-- ============================================================

-- Atlanta Center for Photography — artist-run gallery on Edgewood
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('Atlanta Center for Photography', 'atlanta-center-for-photography', '546 Edgewood Ave SE', 'Old Fourth Ward', 'Atlanta', 'GA', '30312',
  33.7559, -84.3685, 'gallery', 'gallery', 'https://www.atlantaphotography.org',
  'Atlanta Center for Photography is an artist-run nonprofit gallery and resource center dedicated to the photographic arts. Exhibitions, workshops, and community events.', true)
ON CONFLICT (slug) DO NOTHING;

-- Besharat Contemporary — fine art gallery in Castleberry Hill
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('Besharat Contemporary', 'besharat-contemporary', '163 Peters St SW', 'Castleberry Hill', 'Atlanta', 'GA', '30313',
  33.7512, -84.4003, 'gallery', 'gallery', 'https://www.besharatcontemporary.com',
  'Besharat Contemporary is a fine art gallery in Castleberry Hill showcasing national and international contemporary artists. Features paintings, sculpture, and mixed media.', true)
ON CONFLICT (slug) DO NOTHING;

-- Future Gallery — art space in Underground Atlanta
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('Future Gallery', 'future-gallery', '50 Upper Alabama St', 'Downtown', 'Atlanta', 'GA', '30303',
  33.7516, -84.3906, 'gallery', 'gallery', NULL,
  'Art gallery space located in Underground Atlanta.', true)
ON CONFLICT (slug) DO NOTHING;

-- Gallery 72 — art gallery on Marietta Street
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('Gallery 72', 'gallery-72', '72 Marietta St NW', 'Downtown', 'Atlanta', 'GA', '30303',
  33.7548, -84.3916, 'gallery', 'gallery', NULL,
  'Art gallery located on Marietta Street in Downtown Atlanta.', true)
ON CONFLICT (slug) DO NOTHING;

-- Paige Harvey Art Studio — artist studio in Downtown
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('Paige Harvey Art Studio', 'paige-harvey-art-studio', '132 Cone St', 'Downtown', 'Atlanta', 'GA', '30303',
  33.7572, -84.3897, 'gallery', 'gallery', NULL,
  'Working art studio in Downtown Atlanta.', true)
ON CONFLICT (slug) DO NOTHING;

-- Ernest G. Welch School of Art + Design Gallery — GSU campus gallery
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('Ernest G. Welch School of Art + Design Gallery', 'welch-art-gallery-gsu', '10 Peachtree Center Ave', 'Downtown', 'Atlanta', 'GA', '30303',
  33.7545, -84.3864, 'gallery', 'gallery', 'https://art.gsu.edu/gallery/',
  'Georgia State University gallery featuring exhibitions by students, faculty, and visiting artists. Free and open to the public.', true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- ENTERTAINMENT & PERFORMANCE VENUES
-- ============================================================

-- Atlanta Magic Theater — magic shows on Marietta Street
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('Atlanta Magic Theater', 'atlanta-magic-theater', '267 Marietta St NW', 'Downtown', 'Atlanta', 'GA', '30313',
  33.7596, -84.3978, 'theater', 'theater', 'https://www.atlantamagictheatre.com',
  'Intimate magic show venue in Downtown Atlanta featuring live magic performances. Dinner and cocktail packages available.', true)
ON CONFLICT (slug) DO NOTHING;

-- Comedy Hype Labs — comedy venue on Walker Street
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('Comedy Hype Labs', 'comedy-hype-labs', '235 Walker St SW', 'Castleberry Hill', 'Atlanta', 'GA', '30313',
  33.7475, -84.3997, 'theater', 'comedy_club', 'https://www.comedyhypelabs.com',
  'Comedy performance space and lab in Castleberry Hill producing stand-up, improv, and sketch comedy shows.', true)
ON CONFLICT (slug) DO NOTHING;

-- The Culture Experience Atlanta — cultural center on Centennial Olympic Park Dr
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('The Culture Experience Atlanta', 'the-culture-experience-atlanta', '116 Centennial Olympic Park Drive', 'Downtown', 'Atlanta', 'GA', '30313',
  33.7602, -84.3944, 'museum', 'museum', NULL,
  'Cultural experience and exhibition space in Downtown Atlanta.', true)
ON CONFLICT (slug) DO NOTHING;

-- Station Soccer — soccer facility on Boulevard
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('Station Soccer', 'station-soccer', '130 Boulevard NE Suite 4', 'Old Fourth Ward', 'Atlanta', 'GA', '30312',
  33.7563, -84.3751, 'recreation', 'recreation', 'https://www.stationsoccer.org',
  'Community soccer facility under the MARTA King Memorial station. Pickup games, leagues, and community events.', true)
ON CONFLICT (slug) DO NOTHING;

-- Club Candy ATL — nightclub at Park Place
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('Club Candy ATL', 'club-candy-atl', '12 Park Place NE', 'Downtown', 'Atlanta', 'GA', '30303',
  33.7559, -84.3856, 'nightclub', 'nightclub', NULL,
  'Downtown Atlanta nightclub.', true)
ON CONFLICT (slug) DO NOTHING;

-- Peach Museum — museum in Underground Atlanta
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('Peach Museum', 'peach-museum', '50 Lower Alabama St SW', 'Downtown', 'Atlanta', 'GA', '30303',
  33.7516, -84.3907, 'museum', 'museum', NULL,
  'Museum experience in Underground Atlanta.', true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- NOTABLE RESTAURANTS & BARS (destination-worthy)
-- ============================================================

-- Paschal's — historic Southern restaurant
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('Paschal''s', 'paschals', '180 Northside Dr', 'Vine City', 'Atlanta', 'GA', '30313',
  33.7555, -84.4068, 'restaurant', 'restaurant', 'https://www.paschalsatlanta.com',
  'Historic Southern restaurant and civil rights landmark, originally opened in 1947. A gathering place during the civil rights movement, known for fried chicken and comfort food.', true)
ON CONFLICT (slug) DO NOTHING;

-- Noni's Bar & Deli — Italian deli and music venue on Edgewood
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('Noni''s Bar & Deli', 'nonis-bar-and-deli', '357 Edgewood Ave', 'Old Fourth Ward', 'Atlanta', 'GA', '30312',
  33.7559, -84.3727, 'bar', 'bar', NULL,
  'Italian deli by day, bar with live music and DJs by night on the Edgewood corridor. Known for late-night slices and eclectic programming.', true)
ON CONFLICT (slug) DO NOTHING;

-- BOCA — restaurant and bar in Summerhill
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('BOCA', 'boca-atlanta', '39 Georgia Ave SE', 'Summerhill', 'Atlanta', 'GA', '30312',
  33.7408, -84.3832, 'restaurant', 'restaurant', NULL,
  'Restaurant and bar in Summerhill, one of the anchor dining spots in the developing Georgia Avenue corridor.', true)
ON CONFLICT (slug) DO NOTHING;

-- Catch 12 — upscale seafood at 400 West Peachtree
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('Catch 12', 'catch-12', '400 West Peachtree St', 'Downtown', 'Atlanta', 'GA', '30308',
  33.7663, -84.3892, 'restaurant', 'restaurant', NULL,
  'Upscale seafood restaurant in Downtown Atlanta.', true)
ON CONFLICT (slug) DO NOTHING;

-- Brooklyn Tea — specialty tea shop
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('Brooklyn Tea', 'brooklyn-tea', '329 Nelson St SW', 'Castleberry Hill', 'Atlanta', 'GA', '30313',
  33.7499, -84.3986, 'cafe', 'cafe', 'https://www.brooklyntea.com',
  'Black-owned specialty tea shop in Castleberry Hill offering over 100 loose-leaf teas, tea lattes, and pastries.', true)
ON CONFLICT (slug) DO NOTHING;

-- Maepole — cafe and restaurant in Summerhill
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('Maepole', 'maepole', '72 Georgia Ave SE', 'Summerhill', 'Atlanta', 'GA', '30312',
  33.7406, -84.3828, 'restaurant', 'restaurant', 'https://www.maepole.com',
  'Farm-to-table cafe and restaurant on the Georgia Avenue corridor in Summerhill. Brunch, lunch, and dinner.', true)
ON CONFLICT (slug) DO NOTHING;

-- RT60 Rooftop Bar — rooftop at Hyatt Centric Centennial Park
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('RT60 Rooftop Bar', 'rt60-rooftop-bar', '89 Centennial Olympic Park Dr NW', 'Downtown', 'Atlanta', 'GA', '30313',
  33.7606, -84.3934, 'bar', 'bar', NULL,
  'Rooftop bar atop the Hyatt Centric hotel overlooking Centennial Olympic Park. Craft cocktails with skyline views.', true)
ON CONFLICT (slug) DO NOTHING;

-- Sidebar Atlanta — bar on Poplar Street
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('Sidebar Atlanta', 'sidebar-atlanta', '79 Poplar St', 'Downtown', 'Atlanta', 'GA', '30303',
  33.7555, -84.3895, 'bar', 'bar', NULL,
  'Neighborhood bar in Downtown Atlanta on Poplar Street.', true)
ON CONFLICT (slug) DO NOTHING;

-- Young Augustine's — restaurant/bar on Memorial Drive
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('Young Augustine''s', 'young-augustines', '327 Memorial Dr', 'Grant Park', 'Atlanta', 'GA', '30312',
  33.7417, -84.3720, 'restaurant', 'restaurant', NULL,
  'Restaurant and bar on Memorial Drive near Grant Park.', true)
ON CONFLICT (slug) DO NOTHING;

-- Stir House — cocktail bar on Broad Street
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('Stir House', 'stir-house', '61 Broad St NW', 'Downtown', 'Atlanta', 'GA', '30303',
  33.7548, -84.3924, 'bar', 'bar', NULL,
  'Cocktail bar on Broad Street in Downtown Atlanta.', true)
ON CONFLICT (slug) DO NOTHING;

-- Twin Smokers BBQ — BBQ in The Yard at Marietta Street
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('Twin Smokers BBQ', 'twin-smokers-bbq', '300 Marietta St NW', 'Downtown', 'Atlanta', 'GA', '30313',
  33.7597, -84.3964, 'restaurant', 'restaurant', NULL,
  'BBQ restaurant at 300 Marietta Street in Downtown Atlanta.', true)
ON CONFLICT (slug) DO NOTHING;

-- Social Table — restaurant/event space
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('Social Table', 'social-table', '285 Andrew Young International Blvd NW', 'Downtown', 'Atlanta', 'GA', '30313',
  33.7596, -84.3948, 'restaurant', 'restaurant', NULL,
  'Restaurant and gathering space in Downtown Atlanta near the convention district.', true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- PARKS & RECREATION
-- ============================================================

-- Fetch Park — off-leash dog park in Summerhill
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('Fetch Park', 'fetch-park', '520 Daniel St SE', 'Summerhill', 'Atlanta', 'GA', '30312',
  33.7393, -84.3785, 'park', 'park', 'https://www.fetchpark.com',
  'Atlanta''s first dog bar and off-leash dog park in Summerhill. Memberships include park access, bar and food service, grooming, and events.', true)
ON CONFLICT (slug) DO NOTHING;

-- Georgia Railroad Freight Depot — historic event venue
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('Georgia Railroad Freight Depot', 'georgia-railroad-freight-depot', '65 Martin Luther King Jr Dr', 'Downtown', 'Atlanta', 'GA', '30303',
  33.7527, -84.3879, 'event_space', 'event_space', NULL,
  'Historic 1869 railroad freight depot, the oldest building in Downtown Atlanta. Now a popular event and wedding venue.', true)
ON CONFLICT (slug) DO NOTHING;

-- Peters Street Station — creative venue in Castleberry Hill
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('Peters Street Station', 'peters-street-station', '333 Peters St SW', 'Castleberry Hill', 'Atlanta', 'GA', '30313',
  33.7488, -84.4008, 'event_space', 'event_space', NULL,
  'Creative event space in the Castleberry Hill arts district.', true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- Register inactive sources for venues that may have event calendars
-- ============================================================

INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
VALUES
  ('atlanta-center-for-photography', 'Atlanta Center for Photography', 'https://www.atlantaphotography.org', 'venue', 'weekly', false,
    (SELECT id FROM portals WHERE slug = 'atlanta'), 'none'),
  ('besharat-contemporary', 'Besharat Contemporary', 'https://www.besharatcontemporary.com', 'venue', 'monthly', false,
    (SELECT id FROM portals WHERE slug = 'atlanta'), 'none'),
  ('atlanta-magic-theater', 'Atlanta Magic Theater', 'https://www.atlantamagictheatre.com', 'venue', 'weekly', false,
    (SELECT id FROM portals WHERE slug = 'atlanta'), 'none'),
  ('comedy-hype-labs', 'Comedy Hype Labs', 'https://www.comedyhypelabs.com', 'venue', 'weekly', false,
    (SELECT id FROM portals WHERE slug = 'atlanta'), 'none'),
  ('station-soccer', 'Station Soccer', 'https://www.stationsoccer.org', 'venue', 'monthly', false,
    (SELECT id FROM portals WHERE slug = 'atlanta'), 'none'),
  ('nonis-bar-and-deli', 'Noni''s Bar & Deli', 'https://www.instagram.com/nonisatl', 'venue', 'monthly', false,
    (SELECT id FROM portals WHERE slug = 'atlanta'), 'none'),
  ('fetch-park', 'Fetch Park', 'https://www.fetchpark.com', 'venue', 'monthly', false,
    (SELECT id FROM portals WHERE slug = 'atlanta'), 'none'),
  ('paschals', 'Paschal''s', 'https://www.paschalsatlanta.com', 'venue', 'monthly', false,
    (SELECT id FROM portals WHERE slug = 'atlanta'), 'none')
ON CONFLICT (slug) DO NOTHING;
