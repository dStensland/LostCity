-- ============================================
-- MIGRATION 112: Chain Cinemas
-- ============================================
-- Add is_chain column to venues table so chain cinemas (AMC, Regal, etc.)
-- are searchable and appear on maps but are excluded from the curated feed.
-- Independent cinemas (Plaza, Tara, Landmark Midtown) remain featured.

-- ============================================
-- STEP 1: Add is_chain column to venues
-- ============================================

ALTER TABLE venues ADD COLUMN IF NOT EXISTS is_chain BOOLEAN DEFAULT FALSE;

-- Partial index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_venues_is_chain ON venues(is_chain) WHERE is_chain = TRUE;

-- ============================================
-- STEP 2: Mark existing Landmark Midtown as chain
-- ============================================

UPDATE venues SET is_chain = TRUE WHERE slug = 'landmark-midtown-art-cinema';

-- ============================================
-- STEP 3: Insert chain venue records
-- ============================================

-- AMC Theatres (6 locations)
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, venue_type, website, lat, lng, is_chain)
VALUES
  ('AMC Phipps Plaza 14', 'amc-phipps-plaza', '3500 Peachtree Rd NE', 'Buckhead', 'Atlanta', 'GA', '30326', 'cinema', 'https://www.amctheatres.com/movie-theatres/atlanta/amc-phipps-plaza-14', 33.8522, -84.3628, TRUE),
  ('AMC North DeKalb 16', 'amc-north-dekalb', '2042 Lawrenceville Hwy', 'North DeKalb', 'Decatur', 'GA', '30033', 'cinema', 'https://www.amctheatres.com/movie-theatres/atlanta/amc-north-dekalb-16', 33.8086, -84.2806, TRUE),
  ('AMC Southlake Pavilion 24', 'amc-southlake-pavilion', '7065 Mount Zion Blvd', 'Morrow', 'Morrow', 'GA', '30260', 'cinema', 'https://www.amctheatres.com/movie-theatres/atlanta/amc-southlake-pavilion-24', 33.5833, -84.3513, TRUE),
  ('AMC Sugarloaf Mills 18', 'amc-sugarloaf-mills', '5900 Sugarloaf Pkwy', 'Lawrenceville', 'Lawrenceville', 'GA', '30043', 'cinema', 'https://www.amctheatres.com/movie-theatres/atlanta/amc-sugarloaf-mills-18', 34.0025, -84.0488, TRUE),
  ('AMC Camp Creek 14', 'amc-camp-creek', '3760 Princeton Lakes Pkwy', 'Camp Creek', 'Atlanta', 'GA', '30331', 'cinema', 'https://www.amctheatres.com/movie-theatres/atlanta/amc-camp-creek-14', 33.6555, -84.5148, TRUE),
  ('AMC Mansell Crossing 14', 'amc-mansell-crossing', '7730 North Point Pkwy', 'Alpharetta', 'Alpharetta', 'GA', '30022', 'cinema', 'https://www.amctheatres.com/movie-theatres/atlanta/amc-mansell-crossing-14', 34.0536, -84.2806, TRUE)
ON CONFLICT (slug) DO UPDATE SET is_chain = TRUE;

-- Regal Cinemas (4 locations)
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, venue_type, website, lat, lng, is_chain)
VALUES
  ('Regal Atlantic Station', 'regal-atlantic-station', '261 19th St NW', 'Atlantic Station', 'Atlanta', 'GA', '30363', 'cinema', 'https://www.regmovies.com/theatres/regal-atlantic-station', 33.7919, -84.3955, TRUE),
  ('Regal Perimeter Pointe', 'regal-perimeter-pointe', '1155 Mt Vernon Hwy NE', 'Dunwoody', 'Atlanta', 'GA', '30338', 'cinema', 'https://www.regmovies.com/theatres/regal-perimeter-pointe', 33.9280, -84.3410, TRUE),
  ('Regal Mall of Georgia', 'regal-mall-of-georgia', '3333 Buford Dr', 'Buford', 'Buford', 'GA', '30519', 'cinema', 'https://www.regmovies.com/theatres/regal-mall-of-georgia', 34.0655, -83.9899, TRUE),
  ('Regal Hollywood Stadium 24', 'regal-hollywood-24', '3265 Northeast Expy NE', 'Chamblee', 'Chamblee', 'GA', '30341', 'cinema', 'https://www.regmovies.com/theatres/regal-hollywood-stadium-24-and-rpx--chamblee', 33.8865, -84.2938, TRUE)
ON CONFLICT (slug) DO UPDATE SET is_chain = TRUE;

-- Cinemark (2 locations)
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, venue_type, website, lat, lng, is_chain)
VALUES
  ('Cinemark Tinseltown Duluth', 'cinemark-tinseltown-duluth', '2925 Buford Hwy', 'Duluth', 'Duluth', 'GA', '30096', 'cinema', 'https://www.cinemark.com/theatres/ga-duluth/cinemark-tinseltown-usa-and-imax', 34.0009, -84.1422, TRUE),
  ('Cinemark Movies 10 Kennesaw', 'cinemark-movies-10-kennesaw', '2795 Town Center Dr NW', 'Kennesaw', 'Kennesaw', 'GA', '30144', 'cinema', 'https://www.cinemark.com/theatres/ga-kennesaw/cinemark-movies-10', 34.0138, -84.6137, TRUE)
ON CONFLICT (slug) DO UPDATE SET is_chain = TRUE;

-- Studio Movie Grill (1 location)
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, venue_type, website, lat, lng, is_chain)
VALUES
  ('Studio Movie Grill Holcomb Bridge', 'studio-movie-grill-holcomb-bridge', '2880 Holcomb Bridge Rd', 'Roswell', 'Roswell', 'GA', '30076', 'cinema', 'https://www.studiomoviegrill.com/location/holcomb-bridge', 34.0181, -84.3225, TRUE)
ON CONFLICT (slug) DO UPDATE SET is_chain = TRUE;

-- Silverspot Cinema (1 location)
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, venue_type, website, lat, lng, is_chain)
VALUES
  ('Silverspot Cinema at The Battery', 'silverspot-cinema-battery', '1 Ballpark Center, Suite 810', 'The Battery', 'Atlanta', 'GA', '30339', 'cinema', 'https://silverspot.net/location/battery-atlanta', 33.8907, -84.4678, TRUE)
ON CONFLICT (slug) DO UPDATE SET is_chain = TRUE;

-- NCG Cinemas (1 location)
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, venue_type, website, lat, lng, is_chain)
VALUES
  ('NCG Acworth Cinema', 'ncg-acworth', '4432 Cinema Dr', 'Acworth', 'Acworth', 'GA', '30101', 'cinema', 'https://www.ncgmovies.com/acworth', 34.0649, -84.6671, TRUE)
ON CONFLICT (slug) DO UPDATE SET is_chain = TRUE;

-- ============================================
-- STEP 4: Insert source records (one per chain)
-- ============================================

INSERT INTO sources (slug, name, source_type, url, is_active)
VALUES
  ('amc-atlanta', 'AMC Theatres Atlanta', 'crawler', 'https://www.amctheatres.com', TRUE),
  ('regal-atlanta', 'Regal Cinemas Atlanta', 'crawler', 'https://www.regmovies.com', TRUE),
  ('cinemark-atlanta', 'Cinemark Atlanta', 'crawler', 'https://www.cinemark.com', TRUE),
  ('studio-movie-grill-atlanta', 'Studio Movie Grill Atlanta', 'crawler', 'https://www.studiomoviegrill.com', TRUE),
  ('silverspot-cinema-atlanta', 'Silverspot Cinema Atlanta', 'crawler', 'https://silverspot.net', TRUE),
  ('ncg-cinemas-atlanta', 'NCG Cinemas Atlanta', 'crawler', 'https://www.ncgmovies.com', TRUE)
ON CONFLICT (slug) DO UPDATE SET is_active = TRUE;
