-- Migration 291: Add restaurant venues from Reddit r/Atlanta underrated restaurants thread
-- These are dining destinations valued for food/drink recommendations around events.
-- No sources created — these don't have crawlable event pages.

-- Fred's Meat & Bread (Krog Street Market)
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description)
VALUES (
    'Fred''s Meat & Bread', 'freds-meat-bread',
    '99 Krog St NE, Stall 1', 'Inman Park', 'Atlanta', 'GA', '30307',
    33.7590, -84.3633, 'restaurant', 'restaurant',
    'https://www.fredsmeatandbread.com',
    'American',
    'Counter-service spot in Krog Street Market known for burgers, cheesesteaks, and smoked meat sandwiches.'
) ON CONFLICT (slug) DO NOTHING;

-- Embilta Ethiopian Restaurant
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description)
VALUES (
    'Embilta Ethiopian Restaurant', 'embilta-ethiopian',
    '2175 Cheshire Bridge Rd NE', 'Cheshire Bridge', 'Atlanta', 'GA', '30324',
    33.8186, -84.3560, 'restaurant', 'restaurant',
    'https://www.embiltarestaurant.com',
    'Ethiopian',
    'Family-run Ethiopian restaurant on Cheshire Bridge serving traditional dishes on injera with vegan and meat options.'
) ON CONFLICT (slug) DO NOTHING;

-- Bahel Ethiopian Restaurant
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description)
VALUES (
    'Bahel Ethiopian Restaurant', 'bahel-ethiopian',
    '3125 Briarcliff Rd NE', 'Briarcliff', 'Atlanta', 'GA', '30329',
    33.8219, -84.3289, 'restaurant', 'restaurant',
    'https://www.bahelrestaurant.com',
    'Ethiopian',
    'Ethiopian restaurant featuring traditional platters, seasonal fasting menus, and family-style dining.'
) ON CONFLICT (slug) DO NOTHING;

-- Piassa Ethiopian Restaurant
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description)
VALUES (
    'Piassa Ethiopian Restaurant', 'piassa-ethiopian',
    '3086 E Ponce de Leon Ave', 'Scottdale', 'Scottdale', 'GA', '30079',
    33.7749, -84.2720, 'restaurant', 'restaurant',
    'https://www.piassaethiopianrestaurant.com',
    'Ethiopian',
    'Ethiopian restaurant with live music on weekends and traditional coffee ceremonies on Sundays.'
) ON CONFLICT (slug) DO NOTHING;

-- La Calavera Pizza
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description)
VALUES (
    'La Calavera Pizza', 'la-calavera-pizza',
    '1410 Memorial Dr SE', 'Reynoldstown', 'Atlanta', 'GA', '30317',
    33.7426, -84.3540, 'restaurant', 'restaurant',
    'https://lacalaverapizza.com',
    'Pizza',
    'Neighborhood pizza spot on Memorial Drive with creative pies and a laid-back vibe.'
) ON CONFLICT (slug) DO NOTHING;

-- Comunidad
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description)
VALUES (
    'Comunidad', 'comunidad-atl',
    '475 Highland Ave NE', 'Old Fourth Ward', 'Atlanta', 'GA', '30312',
    33.7597, -84.3666, 'restaurant', 'restaurant',
    'https://www.comunidadatl.com',
    'Latin American',
    'Latin American restaurant in Old Fourth Ward with inventive plates and cocktails.'
) ON CONFLICT (slug) DO NOTHING;

-- Crusher's Pizza
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description)
VALUES (
    'Crusher''s Pizza', 'crushers-pizza',
    '301 W Ponce de Leon Ave', 'Decatur', 'Decatur', 'GA', '30030',
    33.7748, -84.2987, 'restaurant', 'restaurant',
    'https://crusherspizza.com',
    'Pizza',
    'Decatur pizza shop serving New York-style slices and whole pies with craft beer.'
) ON CONFLICT (slug) DO NOTHING;

-- Big Dave's Cheesesteaks
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description)
VALUES (
    'Big Dave''s Cheesesteaks', 'big-daves-cheesesteaks',
    '300 Marietta St NW, Suite 105', 'Downtown', 'Atlanta', 'GA', '30313',
    33.7618, -84.3971, 'restaurant', 'restaurant',
    'https://bigdavescheesesteaks.com',
    'American',
    'Atlanta-born cheesesteak chain known for loaded Philly-style cheesesteaks and wings.'
) ON CONFLICT (slug) DO NOTHING;

-- Skip's Chicago Dogs
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description)
VALUES (
    'Skip''s Chicago Dogs', 'skips-chicago-dogs',
    '17 N Avondale Rd', 'Avondale Estates', 'Avondale Estates', 'GA', '30002',
    33.7721, -84.2661, 'restaurant', 'restaurant',
    'https://skipschicagodogs.com',
    'American',
    'Chicago-style hot dog joint in Avondale Estates serving Vienna Beef dogs, Italian beef, and gyros.'
) ON CONFLICT (slug) DO NOTHING;

-- Dave's Cosmic Subs
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description)
VALUES (
    'Dave''s Cosmic Subs', 'daves-cosmic-subs',
    '1546 N Decatur Rd NE', 'Emory Village', 'Atlanta', 'GA', '30307',
    33.7927, -84.3167, 'restaurant', 'restaurant',
    'https://davescosmicsubs.com',
    'American',
    'Cult-favorite sub shop near Emory serving massive subs, salads, and wraps since 1998.'
) ON CONFLICT (slug) DO NOTHING;

-- Cafe Sababa
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description)
VALUES (
    'Cafe Sababa', 'cafe-sababa',
    '4920 Roswell Rd NE, Suite 35', 'Dunwoody', 'Sandy Springs', 'GA', '30342',
    33.8638, -84.3540, 'restaurant', 'restaurant',
    'https://www.cafesababaatlanta.com',
    'Israeli/Mediterranean',
    'Israeli-Mediterranean cafe serving falafel, shawarma, hummus plates, and fresh-baked pita.'
) ON CONFLICT (slug) DO NOTHING;

-- White House Restaurant
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description)
VALUES (
    'White House Restaurant', 'white-house-restaurant',
    '3172 Peachtree Rd NE', 'Buckhead', 'Atlanta', 'GA', '30305',
    33.8446, -84.3762, 'restaurant', 'restaurant',
    NULL,
    'American/Southern',
    'Old-school Buckhead restaurant serving Southern breakfast and comfort food since 1947.'
) ON CONFLICT (slug) DO NOTHING;

-- Mama's Cocina
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description)
VALUES (
    'Mama''s Cocina', 'mamas-cocina',
    '2040 Piedmont Rd NE', 'Piedmont Heights', 'Atlanta', 'GA', '30324',
    33.8103, -84.3654, 'restaurant', 'restaurant',
    'https://mamascocina.com',
    'Mexican',
    'Late-night Mexican spot on Piedmont Road with tacos, burritos, and margaritas.'
) ON CONFLICT (slug) DO NOTHING;

-- Waikikie Hawaiian BBQ
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description)
VALUES (
    'Waikikie Hawaiian BBQ', 'waikikie-hawaiian-bbq',
    '2140 Briarcliff Rd NE', 'Briarcliff', 'Atlanta', 'GA', '30329',
    33.8150, -84.3310, 'restaurant', 'restaurant',
    'https://waikikiebbq.com',
    'Hawaiian/Asian',
    'Hawaiian BBQ and poke bowls with half-off wine specials on Wednesdays and Sundays.'
) ON CONFLICT (slug) DO NOTHING;

-- Blue India
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description)
VALUES (
    'Blue India', 'blue-india',
    '933 Peachtree St NE', 'Midtown', 'Atlanta', 'GA', '30309',
    33.7833, -84.3845, 'restaurant', 'restaurant',
    'https://www.blueindia.com',
    'Indian',
    'Upscale Indian restaurant in Midtown with curries, tandoori, and a full bar with happy hour.'
) ON CONFLICT (slug) DO NOTHING;

-- Kathmandu Kitchen
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description)
VALUES (
    'Kathmandu Kitchen', 'kathmandu-kitchen',
    '4494 Memorial Dr', 'Clarkston', 'Clarkston', 'GA', '30021',
    33.7619, -84.2305, 'restaurant', 'restaurant',
    NULL,
    'Nepali/Indian',
    'Clarkston Nepali-Indian restaurant popular with the local community for dal bhat, momos, and curries.'
) ON CONFLICT (slug) DO NOTHING;

-- Nick's Food To Go
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description)
VALUES (
    'Nick''s Food To Go', 'nicks-food-to-go',
    '240 Martin Luther King Jr Dr SW', 'Mechanicsville', 'Atlanta', 'GA', '30303',
    33.7488, -84.4004, 'restaurant', 'restaurant',
    NULL,
    'American/Soul Food',
    'Neighborhood takeout spot in Mechanicsville known for fried fish, wings, and soul food plates.'
) ON CONFLICT (slug) DO NOTHING;

-- The Bowl
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description)
VALUES (
    'The Bowl', 'the-bowl-marietta',
    '93 Church St NE', 'Marietta Square', 'Marietta', 'GA', '30060',
    33.9527, -84.5497, 'restaurant', 'restaurant',
    'https://thebowlmarietta.com',
    'Asian Fusion',
    'Asian-inspired noodle and rice bowl restaurant on Marietta Square.'
) ON CONFLICT (slug) DO NOTHING;

-- Hamp & Harry's
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description)
VALUES (
    'Hamp & Harry''s', 'hamp-and-harrys',
    '29 W Park Sq NE', 'Marietta Square', 'Marietta', 'GA', '30060',
    33.9529, -84.5510, 'restaurant', 'restaurant',
    'https://www.hampandharrys.com',
    'American/British Pub',
    'British-inspired pub on Marietta Square with trivia nights, dinner-and-a-movie events, live music, and weekend brunch.'
) ON CONFLICT (slug) DO NOTHING;

-- Los Rancheros
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description)
VALUES (
    'Los Rancheros Mexican Restaurant', 'los-rancheros-dunwoody',
    '5880 Roswell Rd NE', 'Dunwoody', 'Sandy Springs', 'GA', '30328',
    33.9109, -84.3564, 'restaurant', 'restaurant',
    NULL,
    'Mexican',
    'Family-owned Mexican restaurant in Dunwoody known for fajitas and live mariachi music.'
) ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- VENUE SPECIALS
-- ============================================================================

-- Waikikie Hawaiian BBQ: Half off wine Wed/Sun
INSERT INTO venue_specials (venue_id, title, type, description, days_of_week, time_start, price_note, source_url, confidence)
SELECT
  v.id,
  'Half Off Wine at Waikikie',
  'drink_special',
  'Half off all wine by the glass on Wednesdays and Sundays at Waikikie Hawaiian BBQ.',
  '{3,7}',  -- Wednesday=3, Sunday=7 (ISO 8601)
  NULL,
  '50% off wine',
  'https://waikikiebbq.com',
  'medium'
FROM venues v WHERE v.slug = 'waikikie-hawaiian-bbq'
ON CONFLICT DO NOTHING;
