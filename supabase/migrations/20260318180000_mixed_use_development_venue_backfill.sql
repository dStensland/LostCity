-- Migration: Mixed-use development venue backfill
--
-- Seeds venue records for tenants at Atlanta's major mixed-use developments
-- that are NOT already in the system. These are destination-worthy restaurants,
-- bars, and entertainment venues within premium developments that people
-- specifically plan to visit.
--
-- Sources: poncecitymarket.com/directory, batteryatl.com/dine, westsideprovisions.com/directory
-- Uses ON CONFLICT (slug) DO NOTHING for idempotency.

-- ============================================================
-- PONCE CITY MARKET — 675 Ponce de Leon Ave NE, Old Fourth Ward
-- ============================================================

INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('Nine Mile Station', 'nine-mile-station', '675 Ponce de Leon Ave NE', 'Ponce City Market Area', 'Atlanta', 'GA', '30308',
  33.7727, -84.3653, 'bar', 'bar', 'https://www.ninemilestation.com',
  'Rooftop beer garden and restaurant atop Ponce City Market with skyline views, craft beers, and elevated bar food.', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('Honeysuckle Gelato', 'honeysuckle-gelato', '675 Ponce de Leon Ave NE', 'Ponce City Market Area', 'Atlanta', 'GA', '30308',
  33.7727, -84.3653, 'cafe', 'cafe', 'https://www.honeysucklegelato.com',
  'Small-batch artisan gelato shop at Ponce City Market. Local favorite for seasonal flavors.', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('Jia', 'jia-pcm', '675 Ponce de Leon Ave NE', 'Ponce City Market Area', 'Atlanta', 'GA', '30308',
  33.7727, -84.3653, 'restaurant', 'restaurant', NULL,
  'Chinese restaurant at Ponce City Market.', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('Pancake Social', 'pancake-social', '675 Ponce de Leon Ave NE', 'Ponce City Market Area', 'Atlanta', 'GA', '30308',
  33.7727, -84.3653, 'restaurant', 'restaurant', 'https://www.pancakesocial.com',
  'All-day brunch restaurant at Ponce City Market featuring creative pancakes, fried chicken, and cocktails.', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('Vietvana Pho Noodle House', 'vietvana-pcm', '675 Ponce de Leon Ave NE', 'Ponce City Market Area', 'Atlanta', 'GA', '30308',
  33.7727, -84.3653, 'restaurant', 'restaurant', NULL,
  'Vietnamese pho and noodle house at Ponce City Market. Popular for fresh pho and banh mi.', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('RFD Social', 'rfd-social', '675 Ponce de Leon Ave NE', 'Ponce City Market Area', 'Atlanta', 'GA', '30308',
  33.7727, -84.3653, 'bar', 'bar', NULL,
  'Bar and social lounge at Ponce City Market.', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('Five Daughters Bakery', 'five-daughters-bakery-pcm', '675 Ponce de Leon Ave NE', 'Ponce City Market Area', 'Atlanta', 'GA', '30308',
  33.7727, -84.3653, 'cafe', 'cafe', 'https://www.fivedaughtersbakery.com',
  'Nashville-born bakery at Ponce City Market known for 100-layer donuts and paleo/vegan-friendly baked goods.', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('The Tap on Ponce', 'tap-on-ponce', '675 Ponce de Leon Ave NE', 'Ponce City Market Area', 'Atlanta', 'GA', '30308',
  33.7727, -84.3653, 'bar', 'bar', NULL,
  'Self-pour craft beer and wine taproom at Ponce City Market. Pay-by-the-ounce format.', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('Van Leeuwen Ice Cream', 'van-leeuwen-pcm', '675 Ponce de Leon Ave NE', 'Ponce City Market Area', 'Atlanta', 'GA', '30308',
  33.7727, -84.3653, 'cafe', 'cafe', 'https://www.vanleeuwenicecream.com',
  'Artisan ice cream shop at Ponce City Market. Known for French-style ice cream and vegan flavors.', true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- THE BATTERY ATLANTA — 800 Battery Ave SE, Cumberland
-- ============================================================

INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('C. Ellet''s Steakhouse', 'c-ellets', '800 Battery Ave SE', 'Cumberland', 'Atlanta', 'GA', '30339',
  33.8907, -84.4679, 'restaurant', 'restaurant', NULL,
  'Upscale steakhouse at The Battery Atlanta, adjacent to Truist Park.', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('BURN by Rocky Patel', 'burn-by-rocky-patel', '800 Battery Ave SE', 'Cumberland', 'Atlanta', 'GA', '30339',
  33.8907, -84.4679, 'bar', 'bar', 'https://www.burnlounge.com',
  'Premium cigar lounge and cocktail bar at The Battery Atlanta. Upscale atmosphere with craft spirits.', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('Ph''east', 'pheast-battery', '800 Battery Ave SE', 'Cumberland', 'Atlanta', 'GA', '30339',
  33.8907, -84.4679, 'restaurant', 'food_hall', NULL,
  'Asian street food hall at The Battery Atlanta featuring multiple vendor stalls.', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('Good Game', 'good-game-battery', '800 Battery Ave SE', 'Cumberland', 'Atlanta', 'GA', '30339',
  33.8907, -84.4679, 'entertainment', 'entertainment', NULL,
  'Topgolf Swing Suite concept at The Battery Atlanta. Sports simulation and gaming lounge with food and drinks.', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('Walk-On''s Sports Bistreaux', 'walk-ons-battery', '800 Battery Ave SE', 'Cumberland', 'Atlanta', 'GA', '30339',
  33.8907, -84.4679, 'restaurant', 'sports_bar', NULL,
  'Louisiana-style sports restaurant at The Battery Atlanta. Cajun-inspired menu with wall-to-wall screens.', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('Cru Wine Bar', 'cru-wine-bar-battery', '800 Battery Ave SE', 'Cumberland', 'Atlanta', 'GA', '30339',
  33.8907, -84.4679, 'bar', 'bar', NULL,
  'Wine bar and restaurant at The Battery Atlanta featuring curated wine selections and small plates.', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('Blue Moon Brewery & Grill', 'blue-moon-brewery-battery', '800 Battery Ave SE', 'Cumberland', 'Atlanta', 'GA', '30339',
  33.8907, -84.4679, 'brewery', 'brewery', NULL,
  'Blue Moon Brewing Company taphouse and restaurant at The Battery Atlanta.', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('EATaliano Kitchen', 'eataliano-battery', '800 Battery Ave SE', 'Cumberland', 'Atlanta', 'GA', '30339',
  33.8907, -84.4679, 'restaurant', 'restaurant', NULL,
  'Italian restaurant at The Battery Atlanta.', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('Garden & Gun Club', 'garden-and-gun-club', '800 Battery Ave SE', 'Cumberland', 'Atlanta', 'GA', '30339',
  33.8907, -84.4679, 'bar', 'bar', NULL,
  'Southern-inspired social club, bar, and event space at The Battery Atlanta. From the Garden & Gun magazine brand.', true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- WESTSIDE PROVISIONS DISTRICT — 1198 Howell Mill Rd NW, West Midtown
-- ============================================================

INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('Bar Blanc', 'bar-blanc', '1198 Howell Mill Rd NW', 'West Midtown', 'Atlanta', 'GA', '30318',
  33.7918, -84.4139, 'restaurant', 'restaurant', NULL,
  'Fine dining steakhouse at Westside Provisions District.', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('Barrel Proof', 'barrel-proof', '1198 Howell Mill Rd NW', 'West Midtown', 'Atlanta', 'GA', '30318',
  33.7918, -84.4139, 'bar', 'bar', NULL,
  'Spirits-focused bar at Westside Provisions District featuring whiskey, bourbon, and craft cocktails.', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('Brown Bag Seafood Co.', 'brown-bag-seafood', '1198 Howell Mill Rd NW', 'West Midtown', 'Atlanta', 'GA', '30318',
  33.7918, -84.4139, 'restaurant', 'restaurant', 'https://www.brownbagseafood.com',
  'Fast-casual seafood restaurant at Westside Provisions District. Sustainable, responsibly sourced seafood.', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('Flower Child', 'flower-child-wpd', '1198 Howell Mill Rd NW', 'West Midtown', 'Atlanta', 'GA', '30318',
  33.7918, -84.4139, 'restaurant', 'restaurant', 'https://www.iamaflowerchild.com',
  'Healthy fast-casual restaurant at Westside Provisions District. Organic, gluten-free, and plant-based options.', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('Paya Thai', 'paya-thai', '1198 Howell Mill Rd NW', 'West Midtown', 'Atlanta', 'GA', '30318',
  33.7918, -84.4139, 'restaurant', 'restaurant', NULL,
  'Thai restaurant at Westside Provisions District.', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active)
VALUES ('Perrine''s Wine Shop', 'perrines-wine-shop', '1198 Howell Mill Rd NW', 'West Midtown', 'Atlanta', 'GA', '30318',
  33.7918, -84.4139, 'bar', 'bar', NULL,
  'Neighborhood wine shop and bar at Westside Provisions District. Curated selection with tastings and events.', true)
ON CONFLICT (slug) DO NOTHING;
