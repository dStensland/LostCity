-- Seed data: Add museums, convention centers, galleries, and games venues
-- Run this after the 003_spots_fields.sql migration

-- =====================================================
-- MUSEUMS
-- =====================================================
INSERT INTO venues (name, slug, address, neighborhood, city, state, spot_type, active)
VALUES
  ('High Museum of Art', 'high-museum-of-art', '1280 Peachtree St NE', 'Midtown', 'Atlanta', 'GA', 'museum', true),
  ('Georgia Aquarium', 'georgia-aquarium', '225 Baker St NW', 'Downtown', 'Atlanta', 'GA', 'museum', true),
  ('World of Coca-Cola', 'world-of-coca-cola', '121 Baker St NW', 'Downtown', 'Atlanta', 'GA', 'museum', true),
  ('Center for Civil and Human Rights', 'center-for-civil-and-human-rights', '100 Ivan Allen Jr Blvd NW', 'Downtown', 'Atlanta', 'GA', 'museum', true),
  ('Atlanta History Center', 'atlanta-history-center', '130 West Paces Ferry Rd NW', 'Buckhead', 'Atlanta', 'GA', 'museum', true),
  ('Fernbank Museum of Natural History', 'fernbank-museum', '767 Clifton Rd', 'Druid Hills', 'Atlanta', 'GA', 'museum', true),
  ('Delta Flight Museum', 'delta-flight-museum', '1060 Delta Blvd', 'Hapeville', 'Atlanta', 'GA', 'museum', true),
  ('College Football Hall of Fame', 'college-football-hall-of-fame', '250 Marietta St NW', 'Downtown', 'Atlanta', 'GA', 'museum', true),
  ('Childrens Museum of Atlanta', 'childrens-museum-atlanta', '275 Centennial Olympic Park Dr NW', 'Downtown', 'Atlanta', 'GA', 'museum', true),
  ('APEX Museum', 'apex-museum', '135 Auburn Ave NE', 'Sweet Auburn', 'Atlanta', 'GA', 'museum', true),
  ('Michael C. Carlos Museum', 'michael-c-carlos-museum', '571 S Kilgo Cir', 'Druid Hills', 'Atlanta', 'GA', 'museum', true),
  ('Hammonds House Museum', 'hammonds-house-museum', '503 Peeples St SW', 'West End', 'Atlanta', 'GA', 'museum', true),
  ('Museum of Design Atlanta', 'moda-atlanta', '1315 Peachtree St NE', 'Midtown', 'Atlanta', 'GA', 'museum', true),
  ('Jimmy Carter Presidential Library and Museum', 'carter-presidential-library', '441 John Lewis Freedom Pkwy NE', 'Poncey-Highland', 'Atlanta', 'GA', 'museum', true),
  ('Martin Luther King Jr. National Historical Park', 'mlk-national-historical-park', '450 Auburn Ave NE', 'Sweet Auburn', 'Atlanta', 'GA', 'museum', true),
  ('Atlanta Monetary Museum', 'atlanta-monetary-museum', '1000 Peachtree St NE', 'Midtown', 'Atlanta', 'GA', 'museum', true),
  ('Wren''s Nest House Museum', 'wrens-nest-museum', '1050 Ralph David Abernathy Blvd SW', 'West End', 'Atlanta', 'GA', 'museum', true),
  ('Margaret Mitchell House', 'margaret-mitchell-house', '979 Crescent Ave NE', 'Midtown', 'Atlanta', 'GA', 'museum', true),
  ('Fernbank Science Center', 'fernbank-science-center', '156 Heaton Park Dr NE', 'Druid Hills', 'Atlanta', 'GA', 'museum', true),
  ('National Infantry Museum', 'national-infantry-museum', '1775 Legacy Way', 'Columbus', 'Columbus', 'GA', 'museum', true)
ON CONFLICT (slug) DO UPDATE SET
  spot_type = EXCLUDED.spot_type,
  address = COALESCE(EXCLUDED.address, venues.address),
  neighborhood = COALESCE(EXCLUDED.neighborhood, venues.neighborhood),
  active = true;

-- =====================================================
-- CONVENTION CENTERS
-- =====================================================
INSERT INTO venues (name, slug, address, neighborhood, city, state, spot_type, active)
VALUES
  ('Georgia World Congress Center', 'georgia-world-congress-center', '285 Andrew Young International Blvd NW', 'Downtown', 'Atlanta', 'GA', 'convention_center', true),
  ('Atlanta Convention Center at AmericasMart', 'americasmart-convention-center', '240 Peachtree St NW', 'Downtown', 'Atlanta', 'GA', 'convention_center', true),
  ('Cobb Galleria Centre', 'cobb-galleria-centre', '2 Galleria Pkwy SE', 'Cumberland', 'Atlanta', 'GA', 'convention_center', true),
  ('Gas South Convention Center', 'gas-south-convention-center', '6400 Sugarloaf Pkwy', 'Duluth', 'Duluth', 'GA', 'convention_center', true),
  ('Georgia International Convention Center', 'georgia-international-convention-center', '2000 Convention Center Concourse', 'College Park', 'College Park', 'GA', 'convention_center', true),
  ('Infinite Energy Center Arena', 'infinite-energy-arena', '6400 Sugarloaf Pkwy', 'Duluth', 'Duluth', 'GA', 'convention_center', true)
ON CONFLICT (slug) DO UPDATE SET
  spot_type = EXCLUDED.spot_type,
  address = COALESCE(EXCLUDED.address, venues.address),
  neighborhood = COALESCE(EXCLUDED.neighborhood, venues.neighborhood),
  active = true;

-- =====================================================
-- GALLERIES (Art Galleries)
-- =====================================================
INSERT INTO venues (name, slug, address, neighborhood, city, state, spot_type, active)
VALUES
  ('Atlanta Contemporary', 'atlanta-contemporary', '535 Means St NW', 'Westside', 'Atlanta', 'GA', 'gallery', true),
  ('Whitespace Gallery', 'whitespace-gallery', '814 Edgewood Ave NE', 'Edgewood', 'Atlanta', 'GA', 'gallery', true),
  ('Kai Lin Art', 'kai-lin-art', '1402 N Highland Ave NE', 'Virginia-Highland', 'Atlanta', 'GA', 'gallery', true),
  ('Mason Fine Art', 'mason-fine-art', '415 Plasters Ave NE', 'Inman Park', 'Atlanta', 'GA', 'gallery', true),
  ('Sandler Hudson Gallery', 'sandler-hudson-gallery', '1009 Marietta St NW', 'Westside', 'Atlanta', 'GA', 'gallery', true),
  ('Marcia Wood Gallery', 'marcia-wood-gallery', '263 Walker St SW', 'Castleberry Hill', 'Atlanta', 'GA', 'gallery', true),
  ('Alan Avery Art Company', 'alan-avery-art', '315 E Paces Ferry Rd NE', 'Buckhead', 'Atlanta', 'GA', 'gallery', true),
  ('Tew Galleries', 'tew-galleries', '425 Peachtree Hills Ave NE', 'Peachtree Hills', 'Atlanta', 'GA', 'gallery', true),
  ('Poem 88', 'poem-88', '88 Forsyth St NW', 'Downtown', 'Atlanta', 'GA', 'gallery', true),
  ('Besharat Gallery', 'besharat-gallery', '1046 Howell Mill Rd NW', 'Westside', 'Atlanta', 'GA', 'gallery', true),
  ('Notch8 Gallery', 'notch8-gallery', '1046 Howell Mill Rd', 'Westside', 'Atlanta', 'GA', 'gallery', true),
  ('ZuCot Gallery', 'zucot-gallery', '100 Centennial Olympic Park Dr NW', 'Downtown', 'Atlanta', 'GA', 'gallery', true),
  ('Get This Gallery', 'get-this-gallery', '1043 Howell Mill Rd', 'Westside', 'Atlanta', 'GA', 'gallery', true),
  ('Dashboard Co-op', 'dashboard-co-op', '89 Broad St SW', 'Downtown', 'Atlanta', 'GA', 'gallery', true)
ON CONFLICT (slug) DO UPDATE SET
  spot_type = EXCLUDED.spot_type,
  address = COALESCE(EXCLUDED.address, venues.address),
  neighborhood = COALESCE(EXCLUDED.neighborhood, venues.neighborhood),
  active = true;

-- =====================================================
-- GAMES / ENTERTAINMENT VENUES
-- =====================================================
INSERT INTO venues (name, slug, address, neighborhood, city, state, spot_type, active)
VALUES
  ('Topgolf Midtown', 'topgolf-midtown', '1600 Ellsworth Industrial Blvd NW', 'Westside', 'Atlanta', 'GA', 'games', true),
  ('Topgolf Alpharetta', 'topgolf-alpharetta', '10900 Westside Pkwy', 'Alpharetta', 'Alpharetta', 'GA', 'games', true),
  ('Flight Club Atlanta', 'flight-club-atlanta', '675 Ponce de Leon Ave NE', 'Poncey-Highland', 'Atlanta', 'GA', 'games', true),
  ('Andretti Indoor Karting & Games Marietta', 'andretti-marietta', '1255 Roswell Rd', 'Marietta', 'Marietta', 'GA', 'games', true),
  ('Andretti Indoor Karting & Games Buford', 'andretti-buford', '2925 Buford Dr', 'Buford', 'Buford', 'GA', 'games', true),
  ('Main Event Alpharetta', 'main-event-alpharetta', '2300 Holcomb Bridge Rd', 'Alpharetta', 'Alpharetta', 'GA', 'games', true),
  ('Main Event Sandy Springs', 'main-event-sandy-springs', '5920 Roswell Rd', 'Sandy Springs', 'Sandy Springs', 'GA', 'games', true),
  ('Dave & Busters Marietta', 'dave-and-busters-marietta', '2215 D&B Dr', 'Marietta', 'Marietta', 'GA', 'games', true),
  ('Dave & Busters Lawrenceville', 'dave-and-busters-lawrenceville', '5000 Eagle Point Mall', 'Lawrenceville', 'Lawrenceville', 'GA', 'games', true),
  ('Battle & Brew', 'battle-and-brew', '5920 Roswell Rd NE', 'Sandy Springs', 'Sandy Springs', 'GA', 'games', true),
  ('Joystick Gamebar', 'joystick-gamebar', '427 Edgewood Ave SE', 'Edgewood', 'Atlanta', 'GA', 'games', true),
  ('Round1 North Point', 'round1-north-point', '1025 North Point Cir', 'Alpharetta', 'Alpharetta', 'GA', 'games', true),
  ('Round1 Perimeter', 'round1-perimeter', '4400 Ashford Dunwoody Rd', 'Dunwoody', 'Dunwoody', 'GA', 'games', true),
  ('Bowlero Atlanta', 'bowlero-atlanta', '2175 Savoy Dr', 'Chamblee', 'Chamblee', 'GA', 'games', true),
  ('Stars and Strikes Dacula', 'stars-and-strikes-dacula', '2400 Hamilton Creek Pkwy', 'Dacula', 'Dacula', 'GA', 'games', true),
  ('Stars and Strikes Cumming', 'stars-and-strikes-cumming', '2755 Market Place Blvd', 'Cumming', 'Cumming', 'GA', 'games', true),
  ('Painted Pin', 'painted-pin', '737 Miami Cir NE', 'Buckhead', 'Atlanta', 'GA', 'games', true),
  ('The Painted Duck', 'painted-duck', '976 Brady Ave NW', 'Westside', 'Atlanta', 'GA', 'games', true),
  ('Puttshack Atlanta', 'puttshack-atlanta', '3637 Peachtree Rd NE', 'Buckhead', 'Atlanta', 'GA', 'games', true),
  ('Monster Mini Golf Marietta', 'monster-mini-golf-marietta', '2550 Cobb Place Ln NW', 'Marietta', 'Marietta', 'GA', 'games', true),
  ('Breakout Games Atlanta', 'breakout-games-atlanta', '3330 Piedmont Rd NE', 'Buckhead', 'Atlanta', 'GA', 'games', true),
  ('Escape the Room Atlanta', 'escape-the-room-atlanta', '3330 Piedmont Rd NE', 'Buckhead', 'Atlanta', 'GA', 'games', true),
  ('Big Boss Arcade Bar', 'big-boss-arcade-bar', '327 Edgewood Ave SE', 'Edgewood', 'Atlanta', 'GA', 'games', true),
  ('Versus ATL', 'versus-atl', '1037 Monroe Dr NE', 'Midtown', 'Atlanta', 'GA', 'games', true)
ON CONFLICT (slug) DO UPDATE SET
  spot_type = EXCLUDED.spot_type,
  address = COALESCE(EXCLUDED.address, venues.address),
  neighborhood = COALESCE(EXCLUDED.neighborhood, venues.neighborhood),
  active = true;

-- =====================================================
-- Summary
-- =====================================================
-- Museums: ~20 venues
-- Convention Centers: ~6 venues
-- Galleries: ~14 venues
-- Games/Entertainment: ~24 venues
-- Total: ~64 new venues
