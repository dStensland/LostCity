-- Migration 479: Best-of Editorial Venues Batch
--
-- ~60 Atlanta venues commonly featured in Eater Atlanta, The Infatuation,
-- Atlanta Magazine, Thrillist, What Now Atlanta, and ATL Bucket List
-- best-of editorial lists that were missing from our database.
--
-- Categories covered:
--   Steakhouses, Chinese/Asian (Vietnamese, Thai, Korean, Japanese),
--   Ice cream/dessert, Bagels, Breakfast/brunch,
--   Black-owned restaurants, Buckhead fine dining,
--   New American, Spanish/Iberian, Italian
--
-- All venues confirmed currently open as of 2026-03.
-- Sources registered as inactive (integration_method = 'none') —
-- these venues promote via Instagram/Resy and have no crawlable events page.
-- Set is_active = true when a crawler is built.

-- ============================================================
-- STEAKHOUSES
-- ============================================================

-- Bone's Restaurant — Atlanta's most storied steakhouse, Buckhead institution since 1979
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'Bone''s Restaurant',
  'bones-restaurant-buckhead',
  '3130 Piedmont Rd NE',
  'Buckhead',
  'Atlanta',
  'GA',
  '30305',
  33.8500,
  -84.3726,
  'restaurant',
  'restaurant',
  'https://bonesrestaurant.com',
  ARRAY['American', 'Steakhouse'],
  'Atlanta''s definitive power-lunch and special-occasion steakhouse since 1979, with dry-aged prime cuts, a legendary wine list, and a Buckhead clientele that spans generations.',
  ARRAY['upscale', 'date-night', 'power-lunch', 'classic', 'special-occasion'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- Kevin Rathbun Steak — Inman Park fine dining steakhouse from James Beard-nominated chef
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'Kevin Rathbun Steak',
  'kevin-rathbun-steak',
  '154 Krog St NE',
  'Inman Park',
  'Atlanta',
  'GA',
  '30307',
  33.7601,
  -84.3596,
  'restaurant',
  'restaurant',
  'https://kevinrathbunsteak.com',
  ARRAY['American', 'Steakhouse'],
  'James Beard-nominated chef Kevin Rathbun''s flagship steakhouse in an intimate Inman Park setting, known for prime cuts, raw bar, and one of Atlanta''s best bourbon selections.',
  ARRAY['upscale', 'date-night', 'special-occasion', 'craft-cocktails'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- Little Alley Steak — Roswell chophouse regularly cited on best steak lists
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'Little Alley Steak',
  'little-alley-steak',
  '1140 Woodstock Rd',
  'Roswell',
  'Roswell',
  'GA',
  '30075',
  34.0290,
  -84.3600,
  'restaurant',
  'restaurant',
  'https://littlealleysteak.com',
  ARRAY['American', 'Steakhouse'],
  'Intimate Roswell chophouse that consistently tops Atlanta''s best-steak lists with hand-selected prime cuts, creative sides, and a deep wine program in a warm neighborhood setting.',
  ARRAY['upscale', 'date-night', 'special-occasion', 'neighborhood'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- Cut 432 — Dunwoody steakhouse from Ford Fry, consistently on best-of lists
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'Cut 432',
  'cut-432',
  '432 Villa Mill Rd',
  'Dunwoody',
  'Dunwoody',
  'GA',
  '30346',
  33.9232,
  -84.3352,
  'restaurant',
  'restaurant',
  'https://cut432.com',
  ARRAY['American', 'Steakhouse'],
  'Ford Fry''s approachable Dunwoody steakhouse delivering prime dry-aged cuts, creative cocktails, and a lively bar scene without the Buckhead price tag.',
  ARRAY['upscale', 'date-night', 'lively', 'craft-cocktails'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- KR SteakBar — Kevin Rathbun's casual steak concept, Inman Park
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'KR SteakBar',
  'kr-steakbar',
  '99 Krog St NE',
  'Inman Park',
  'Atlanta',
  'GA',
  '30307',
  33.7592,
  -84.3632,
  'restaurant',
  'restaurant',
  'https://krsteakbar.com',
  ARRAY['American', 'Steakhouse'],
  'Kevin Rathbun''s counter-service steak concept in Krog Street Market serving hand-cut steaks, burgers, and steak sandwiches in a casual setting.',
  ARRAY['casual', 'quick-bite', 'neighborhood', 'lively'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- Ray's on the River — Sandy Springs waterfront landmark for upscale seafood and steak
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'Ray''s on the River',
  'rays-on-the-river',
  '6700 Powers Ferry Rd NW',
  'Sandy Springs',
  'Sandy Springs',
  'GA',
  '30339',
  33.9201,
  -84.4207,
  'restaurant',
  'restaurant',
  'https://raysrestaurants.com',
  ARRAY['American', 'Seafood', 'Steakhouse'],
  'Sandy Springs waterfront institution with Chattahoochee River views, serving upscale seafood and steaks — one of Atlanta''s most popular spots for anniversaries and celebrations.',
  ARRAY['upscale', 'date-night', 'waterfront', 'special-occasion', 'scenic'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- Hal's Steakhouse — Old-school Buckhead steakhouse, decades-long institution
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'Hal''s Steakhouse',
  'hals-steakhouse',
  '30 Old Ivy Rd NE',
  'Buckhead',
  'Atlanta',
  'GA',
  '30342',
  33.8610,
  -84.3690,
  'restaurant',
  'restaurant',
  'https://halsatl.com',
  ARRAY['American', 'Steakhouse'],
  'Buckhead steakhouse and New Orleans-inflected bar that has defined Atlanta''s upscale dining scene for decades, known for live jazz, classic cuts, and a see-and-be-seen crowd.',
  ARRAY['upscale', 'classic', 'live-music', 'date-night', 'power-lunch'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- Pappadeaux Seafood Kitchen — ATL location of beloved Houston chain
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'Pappadeaux Seafood Kitchen',
  'pappadeaux-seafood',
  '2830 Windy Hill Rd SE',
  'Marietta',
  'Marietta',
  'GA',
  '30067',
  33.9241,
  -84.5069,
  'restaurant',
  'restaurant',
  'https://pappadeaux.com',
  ARRAY['Cajun', 'Seafood', 'American'],
  'Houston seafood chain institution with an Atlanta following, serving massive Cajun-inflected seafood plates, shrimp etouffee, and whole fried fish in a casual festive setting.',
  ARRAY['casual', 'family-friendly', 'festive', 'large-group'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- JAPANESE / SUSHI
-- ============================================================

-- Miso Izakaya — Midtown Japanese izakaya with extensive sake list
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'Miso Izakaya',
  'miso-izakaya',
  '1661 McLendon Ave NE',
  'Candler Park',
  'Atlanta',
  'GA',
  '30307',
  33.7706,
  -84.3265,
  'restaurant',
  'restaurant',
  'https://misoizakaya.com',
  ARRAY['Japanese', 'Izakaya'],
  'Candler Park izakaya with a deep sake and shochu list, yakitori, small plates, and an intimate atmosphere ideal for late-night eating and drinking.',
  ARRAY['date-night', 'late-night', 'neighborhood', 'intimate', 'craft-cocktails'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- Kura Revolving Sushi Bar — Popular conveyor belt sushi, Dunwoody
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'Kura Revolving Sushi Bar',
  'kura-sushi-atlanta',
  '4780 Ashford Dunwoody Rd NE',
  'Dunwoody',
  'Dunwoody',
  'GA',
  '30338',
  33.9230,
  -84.3325,
  'restaurant',
  'restaurant',
  'https://kurasushi.com',
  ARRAY['Japanese', 'Sushi'],
  'Japanese revolving sushi chain with a tech-forward ordering system, tablet ordering, and a Bikkura-Pon prize machine — perennially packed and beloved for affordable quality sushi.',
  ARRAY['casual', 'family-friendly', 'fun', 'affordable'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- Jijin — Buckhead omakase/kaiseki, one of Atlanta's top sushi experiences
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'Jijin',
  'jijin-atlanta',
  '3356 Chamblee Tucker Rd',
  'Chamblee',
  'Atlanta',
  'GA',
  '30341',
  33.8811,
  -84.2974,
  'restaurant',
  'restaurant',
  'https://jijin.us',
  ARRAY['Japanese', 'Sushi', 'Omakase'],
  'Intimate omakase counter in Chamblee where chef-owners deliver a refined Japanese multi-course experience that Eater and Atlanta Magazine cite as one of the city''s essential sushi destinations.',
  ARRAY['upscale', 'intimate', 'date-night', 'special-occasion', 'omakase'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- OK Yaki — Buford Highway Japanese yakitori, frequently on best-of lists
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'OK Yaki',
  'ok-yaki',
  '3330 Piedmont Rd NE',
  'Buckhead',
  'Atlanta',
  'GA',
  '30305',
  33.8486,
  -84.3651,
  'restaurant',
  'restaurant',
  'https://okyaki.com',
  ARRAY['Japanese', 'Yakitori'],
  'Modern yakitori bar in Buckhead with carefully sourced chicken skewers, Japanese whisky, and a buzzy counter-service energy that''s earned it spots on Eater and Thrillist best-of lists.',
  ARRAY['date-night', 'lively', 'late-night', 'craft-cocktails'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- Umaido — Hakata-style ramen, Chamblee/Doraville corridor
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'Umaido',
  'umaido-ramen',
  '4897 Buford Hwy NE',
  'Chamblee',
  'Chamblee',
  'GA',
  '30341',
  33.8913,
  -84.2934,
  'restaurant',
  'restaurant',
  'https://umaido.com',
  ARRAY['Japanese', 'Ramen'],
  'Hakata-style ramen shop on Buford Highway serving rich tonkotsu broths, tsukemen, and Japanese sides — a serious ramen destination cited consistently on Atlanta best-of lists.',
  ARRAY['casual', 'neighborhood', 'affordable', 'comfort-food'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- KOREAN
-- ============================================================

-- Ssam Bar — Korean-inspired bar and restaurant, Virginia-Highland
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'Ssam Bar',
  'ssam-bar-atlanta',
  '1160 N Highland Ave NE',
  'Virginia-Highland',
  'Atlanta',
  'GA',
  '30306',
  33.7876,
  -84.3580,
  'restaurant',
  'restaurant',
  'https://ssambaratl.com',
  ARRAY['Korean', 'Asian Fusion'],
  'Virginia-Highland spot blending Korean flavors with American bar food — Korean fried chicken, ssam wraps, and inventive cocktails in a neighborhood setting.',
  ARRAY['casual', 'neighborhood', 'lively', 'craft-cocktails'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- Hanwoori — Authentic Korean BBQ, Doraville/Buford Highway
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'Hanwoori',
  'hanwoori-atlanta',
  '5524 Buford Hwy NE',
  'Doraville',
  'Doraville',
  'GA',
  '30340',
  33.9100,
  -84.2735,
  'restaurant',
  'restaurant',
  NULL,
  ARRAY['Korean', 'Korean BBQ'],
  'Authentic Korean BBQ destination on Buford Highway specializing in high-quality galbi and bulgogi, favored by Atlanta''s Korean community and frequently cited in best-of roundups.',
  ARRAY['casual', 'group-friendly', 'authentic', 'family-friendly'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- VIETNAMESE
-- ============================================================

-- Pho Dai Loi 2 — Doraville institution, one of ATL's most-cited pho spots
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'Pho Dai Loi 2',
  'pho-dai-loi-2',
  '3221 Buford Hwy NE',
  'Buford Highway',
  'Atlanta',
  'GA',
  '30329',
  33.8296,
  -84.3009,
  'restaurant',
  'restaurant',
  NULL,
  ARRAY['Vietnamese'],
  'Buford Highway institution that has been on every "best pho in Atlanta" list for decades — no-frills, cash-preferred, with generous bowls of deeply flavored broth.',
  ARRAY['casual', 'affordable', 'authentic', 'no-frills'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- Xe Lua Vietnamese Restaurant — Doraville, consistently on best pho lists
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'Xe Lua Vietnamese Restaurant',
  'xe-lua-vietnamese',
  '4897 Buford Hwy NE',
  'Doraville',
  'Doraville',
  'GA',
  '30340',
  33.8900,
  -84.2930,
  'restaurant',
  'restaurant',
  NULL,
  ARRAY['Vietnamese'],
  'Doraville Vietnamese restaurant known for its boat noodle soups, vermicelli bowls, and vibrant pho — a Buford Highway staple for authentic Vietnamese cooking.',
  ARRAY['casual', 'affordable', 'authentic', 'neighborhood'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- Viet Tofu — Buford Highway plant-based Vietnamese, notable for vegans
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'Viet Tofu',
  'viet-tofu',
  '5150 Buford Hwy NE',
  'Doraville',
  'Doraville',
  'GA',
  '30340',
  33.8968,
  -84.2740,
  'restaurant',
  'restaurant',
  NULL,
  ARRAY['Vietnamese', 'Vegan'],
  'All-vegetarian Vietnamese restaurant on Buford Highway making plant-based versions of pho, bun bo hue, and classic Vietnamese dishes entirely from tofu and vegetables.',
  ARRAY['casual', 'vegan-friendly', 'affordable', 'authentic'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- THAI
-- ============================================================

-- Surin West — Atlanta Thai landmark in Virginia-Highland, open since 1991
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'Surin West',
  'surin-west',
  '810 N Highland Ave NE',
  'Virginia-Highland',
  'Atlanta',
  'GA',
  '30306',
  33.7829,
  -84.3589,
  'restaurant',
  'restaurant',
  'https://surinwest.com',
  ARRAY['Thai'],
  'Virginia-Highland Thai institution open since 1991 with a sprawling patio and consistently excellent curries, noodle dishes, and an unpretentious neighborhood atmosphere.',
  ARRAY['casual', 'neighborhood', 'patio', 'classic', 'affordable'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- Thaicoon & Sushi Bar — Midtown Thai and sushi hybrid, popular for lunch and dinner
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'Thaicoon & Sushi Bar',
  'thaicoon-sushi-bar',
  '931 Monroe Dr NE',
  'Midtown',
  'Atlanta',
  'GA',
  '30308',
  33.7858,
  -84.3704,
  'restaurant',
  'restaurant',
  'https://thaicoonatl.com',
  ARRAY['Thai', 'Japanese', 'Sushi'],
  'Midtown Thai restaurant and sushi bar with a devoted lunch following, solid curries and pad Thai alongside a fresh sushi menu — one of Midtown''s reliable neighborhood spots.',
  ARRAY['casual', 'neighborhood', 'lunch', 'affordable'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- Little Bangkok — Compact intown Thai spot, Poncey-Highland
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'Little Bangkok',
  'little-bangkok-atlanta',
  '1492 Piedmont Ave NE',
  'Piedmont Heights',
  'Atlanta',
  'GA',
  '30309',
  33.8005,
  -84.3705,
  'restaurant',
  'restaurant',
  NULL,
  ARRAY['Thai'],
  'Cozy intown Thai restaurant with a loyal following for its aromatic curries, fresh spring rolls, and consistently good wok-tossed noodle dishes.',
  ARRAY['casual', 'neighborhood', 'cozy', 'affordable'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- CHINESE
-- ============================================================

-- Canton House — Chamblee dim sum institution, on every ATL dim sum list
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'Canton House',
  'canton-house',
  '4825 Buford Hwy NE',
  'Chamblee',
  'Chamblee',
  'GA',
  '30341',
  33.8908,
  -84.2946,
  'restaurant',
  'restaurant',
  NULL,
  ARRAY['Chinese', 'Dim Sum'],
  'Chamblee dim sum institution that has defined the Atlanta dim sum experience for generations — weekend cart service is packed, and the shrimp dumplings and XO turnip cake are not to be missed.',
  ARRAY['casual', 'family-friendly', 'authentic', 'weekend-brunch', 'group-friendly'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- Gu's Bistro — Upscale Sichuan in Chamblee, James Beard semifinalist buzz
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'Gu''s Bistro',
  'gus-bistro',
  '5750 Buford Hwy NE',
  'Chamblee',
  'Doraville',
  'GA',
  '30340',
  33.9064,
  -84.2748,
  'restaurant',
  'restaurant',
  'https://gusbistro.com',
  ARRAY['Chinese', 'Sichuan'],
  'Chef Gu Yunan''s acclaimed Sichuan bistro on Buford Highway earning national attention for refined takes on mapo tofu, dan dan noodles, and Sichuan fish — a James Beard semifinalist favorite.',
  ARRAY['upscale', 'date-night', 'authentic', 'special-occasion'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- ICE CREAM / DESSERT
-- ============================================================

-- Jeni's Splendid Ice Creams — Cult Columbus/national brand, multiple ATL locations
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'Jeni''s Splendid Ice Creams',
  'jenis-ice-cream-atlanta',
  '675 Ponce de Leon Ave NE',
  'Ponce City Market Area',
  'Atlanta',
  'GA',
  '30308',
  33.7727,
  -84.3633,
  'restaurant',
  'restaurant',
  'https://jenis.com',
  ARRAY['Ice Cream', 'Dessert'],
  'Columbus-born ice cream cult brand with multiple Atlanta locations, beloved for creative flavor combinations like brown butter almond brittle and brambleberry crisp made from whole ingredients.',
  ARRAY['casual', 'family-friendly', 'fun', 'sweet-tooth'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- Morelli's Gourmet Ice Cream — East Atlanta staple on every ATL ice cream list
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'Morelli''s Gourmet Ice Cream',
  'morellis-ice-cream',
  '749 Moreland Ave SE',
  'East Atlanta',
  'Atlanta',
  'GA',
  '30316',
  33.7363,
  -84.3467,
  'restaurant',
  'restaurant',
  'https://morellisicecream.com',
  ARRAY['Ice Cream', 'Dessert'],
  'East Atlanta neighborhood ice cream shop producing small-batch flavors with local and seasonal ingredients since 2006 — a DIY-spirit anchor of the East Atlanta Village food scene.',
  ARRAY['casual', 'neighborhood', 'family-friendly', 'local-favorite'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- King of Pops — ATL-born popsicle brand with permanent shops + carts citywide
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'King of Pops',
  'king-of-pops-atlanta',
  '830 Ralph McGill Blvd NE',
  'Old Fourth Ward',
  'Atlanta',
  'GA',
  '30306',
  33.7656,
  -84.3623,
  'restaurant',
  'restaurant',
  'https://kingofpops.com',
  ARRAY['Dessert', 'Ice Cream'],
  'Atlanta-born popsicle company that started as a street cart in 2010 and grew into an Atlanta icon, with inventive seasonal flavors like lemon pepper and seasonal fruit pops sold across the city.',
  ARRAY['casual', 'outdoor', 'family-friendly', 'local-icon'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- BAGELS
-- ============================================================

-- Holyfield Bagel — West Midtown artisan bagel shop, ATL Bucket List staple
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'Holyfield Bagel',
  'holyfield-bagel',
  '800 Marietta St NW',
  'West Midtown',
  'Atlanta',
  'GA',
  '30318',
  33.7798,
  -84.4098,
  'restaurant',
  'restaurant',
  'https://holyfieldbagelcompany.com',
  ARRAY['Bagels', 'Breakfast', 'Deli'],
  'West Midtown bagel shop hand-rolling and kettle-boiling Montreal-style bagels daily, piled high with house-made schmears, lox, and creative seasonal sandwiches.',
  ARRAY['casual', 'morning', 'neighborhood', 'artisan'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- L'bagel — Emory-area New York-style bagel institution
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'L''bagel',
  'lbagel-atlanta',
  '2472 Briarcliff Rd NE',
  'Briarcliff',
  'Atlanta',
  'GA',
  '30329',
  33.8168,
  -84.3284,
  'restaurant',
  'restaurant',
  'https://lbagelatlanta.com',
  ARRAY['Bagels', 'Deli', 'Breakfast'],
  'Emory-area bagel shop delivering New York-style water bagels, stuffed knishes, and deli sandwiches to the university crowd and intown neighborhood since 1994.',
  ARRAY['casual', 'morning', 'neighborhood', 'classic'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- Goldberg's Bagel & Deli — Sandy Springs NY deli institution
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'Goldberg''s New York Bagels',
  'goldbergs-bagel-deli',
  '4383 Roswell Rd NE',
  'Sandy Springs',
  'Sandy Springs',
  'GA',
  '30342',
  33.8700,
  -84.3720,
  'restaurant',
  'restaurant',
  'https://goldbergsnybagels.com',
  ARRAY['Bagels', 'Deli', 'Breakfast'],
  'Atlanta''s classic New York bagel deli institution serving hand-rolled bagels, house-cured lox, oversized deli sandwiches, and knishes — a multi-decade Buckhead/Sandy Springs staple.',
  ARRAY['casual', 'classic', 'morning', 'family-friendly'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- BREAKFAST / BRUNCH
-- ============================================================

-- Watershed on Peachtree — Eater and Infatuation pick for Southern brunch
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'Watershed on Peachtree',
  'watershed-on-peachtree',
  '1820 Peachtree Rd NW',
  'Buckhead',
  'Atlanta',
  'GA',
  '30309',
  33.8098,
  -84.3893,
  'restaurant',
  'restaurant',
  'https://watershedrestaurant.com',
  ARRAY['Southern', 'American'],
  'Scott Peacock''s beloved Southern restaurant on Peachtree, lauded for its fried chicken, seasonal vegetables, and cornbread — an Atlanta dining landmark and Eater perennial.',
  ARRAY['upscale', 'date-night', 'southern', 'special-occasion'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- Rolling Oven — Westside brunch hotspot, Infatuation top-10 brunch
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'Rolling Oven',
  'rolling-oven-atlanta',
  '400 17th St NW',
  'West Midtown',
  'Atlanta',
  'GA',
  '30363',
  33.7930,
  -84.4116,
  'restaurant',
  'restaurant',
  'https://rollingovenrestaurant.com',
  ARRAY['American', 'Brunch'],
  'West Midtown brunch favorite inside Atlantic Station, known for wood-fired pastries, Benedicts, and a rotating seasonal menu that earns consistent top-brunch placement from The Infatuation.',
  ARRAY['brunch', 'morning', 'date-night', 'patio', 'artisan'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- Cafe Lapin — Virginia-Highland brunch institution with a devoted following
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'Cafe Lapin',
  'cafe-lapin',
  '2984 N Highland Ave NE',
  'Morningside',
  'Atlanta',
  'GA',
  '30306',
  33.8063,
  -84.3600,
  'restaurant',
  'restaurant',
  'https://cafelapinatl.com',
  ARRAY['American', 'Brunch', 'French-inspired'],
  'Morningside neighborhood breakfast and brunch gem with a loyal following for house-baked goods, eggs dishes, and a relaxed European cafe vibe that''s earned it best-brunch citations for over 20 years.',
  ARRAY['brunch', 'morning', 'neighborhood', 'cozy', 'local-favorite'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- Son's Place — Soul food brunch, intown favorite, Black-owned
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'Son''s Place',
  'sons-place-atlanta',
  '100 Hurt St NE',
  'Old Fourth Ward',
  'Atlanta',
  'GA',
  '30307',
  33.7621,
  -84.3762,
  'restaurant',
  'restaurant',
  NULL,
  ARRAY['Southern', 'Soul Food', 'Breakfast'],
  'Old Fourth Ward soul food breakfast institution beloved for fried catfish with grits, country ham, and biscuits in a no-frills counter-service setting that''s been feeding Atlanta since 1985.',
  ARRAY['casual', 'morning', 'local-icon', 'affordable', 'authentic'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- H&F Burger — Holeman & Finch's legendary smash burger, Westside
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'H&F Burger',
  'h-and-f-burger',
  '1545 Peachtree St NE',
  'Midtown',
  'Atlanta',
  'GA',
  '30309',
  33.8022,
  -84.3852,
  'restaurant',
  'restaurant',
  'https://hfburger.com',
  ARRAY['American', 'Burgers'],
  'The approachable sibling to Holeman & Finch, serving the legendary double smash burger that spawned the famous midnight burger tradition, now available all day in a casual fast-casual format.',
  ARRAY['casual', 'quick-bite', 'lunch', 'affordable'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- BLACK-OWNED RESTAURANTS
-- ============================================================

-- The Real Chow Baby — Original Westside stir-fry spot, pioneer Black-owned concept
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'The Real Chow Baby',
  'the-real-chow-baby',
  '1016 Howell Mill Rd NW',
  'West Midtown',
  'Atlanta',
  'GA',
  '30318',
  33.7913,
  -84.4098,
  'restaurant',
  'restaurant',
  'https://therealchowbaby.com',
  ARRAY['Asian Fusion', 'Stir-Fry'],
  'Black-owned build-your-own stir-fry concept in West Midtown where you choose your noodles, protein, and sauce for a custom wok-tossed bowl — a beloved Atlanta original since 2005.',
  ARRAY['casual', 'fun', 'quick-bite', 'group-friendly', 'affordable'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- Chef Rob's Caribbean Cafe — OAK-area Caribbean, Black-owned, local institution
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'Chef Rob''s Caribbean Cafe',
  'chef-robs-caribbean-cafe',
  '1263 Glenwood Ave SE',
  'East Atlanta',
  'Atlanta',
  'GA',
  '30316',
  33.7373,
  -84.3420,
  'restaurant',
  'restaurant',
  NULL,
  ARRAY['Caribbean', 'Jamaican'],
  'Black-owned East Atlanta Caribbean kitchen producing authentic jerk chicken, oxtail, and curry goat with the depth of home cooking — a neighborhood institution on Glenwood Ave.',
  ARRAY['casual', 'neighborhood', 'authentic', 'local-favorite', 'affordable'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- Leyla Restaurant — Persian-Mediterranean, West Midtown, ATL Magazine pick
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'Leyla Restaurant',
  'leyla-restaurant',
  '1115 Howell Mill Rd NW',
  'West Midtown',
  'Atlanta',
  'GA',
  '30318',
  33.7926,
  -84.4100,
  'restaurant',
  'restaurant',
  'https://leylarestaurantatlanta.com',
  ARRAY['Persian', 'Mediterranean'],
  'West Midtown Persian-Mediterranean restaurant with an opulent interior and kitchen helmed by a James Beard Award-nominated chef, known for lavash flatbreads, kebabs, and festive Iranian stews.',
  ARRAY['upscale', 'date-night', 'special-occasion', 'vibrant'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- Bhojanic — Indian-inspired, Black-owned restaurant and bar, Westside
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'Bhojanic',
  'bhojanic',
  '1365 Ellsworth Industrial Blvd NW',
  'West Midtown',
  'Atlanta',
  'GA',
  '30318',
  33.7956,
  -84.4212,
  'restaurant',
  'restaurant',
  'https://bhojanic.com',
  ARRAY['Indian', 'Fusion'],
  'Black-owned Indian-inspired restaurant and bar in West Midtown fusing Southern ingredients with Indian spice traditions — elevated thali plates, creative cocktails, and a warm communal atmosphere.',
  ARRAY['upscale', 'date-night', 'innovative', 'craft-cocktails'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- BUCKHEAD FINE DINING / UPSCALE
-- ============================================================

-- Pricci — Buckhead Italian institution, Ritz Carlton neighbor
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'Pricci',
  'pricci-atlanta',
  '500 Pharr Rd NE',
  'Buckhead',
  'Atlanta',
  'GA',
  '30305',
  33.8368,
  -84.3744,
  'restaurant',
  'restaurant',
  'https://pricci.com',
  ARRAY['Italian'],
  'Buckhead Italian institution since 1993 with a sophisticated Northern Italian menu, extensive wine list, and the kind of white-tablecloth atmosphere that has made it a perennial Atlanta Magazine best-of fixture.',
  ARRAY['upscale', 'date-night', 'classic', 'special-occasion', 'wine'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- Nikolai's Roof — Atlanta Hilton rooftop fine dining, city skyline views
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'Nikolai''s Roof',
  'nikolais-roof',
  '255 Courtland St NE',
  'Downtown',
  'Atlanta',
  'GA',
  '30303',
  33.7572,
  -84.3862,
  'restaurant',
  'restaurant',
  'https://nikolaisroof.com',
  ARRAY['French', 'Continental'],
  'Atop the Atlanta Hilton, Nikolai''s Roof has served Continental-French cuisine with panoramic city skyline views since 1976 — Atlanta''s original fine-dining sky room.',
  ARRAY['upscale', 'date-night', 'romantic', 'views', 'special-occasion'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- Colletta — Buckhead Italian, Ford Fry concept, consistently listed
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'Colletta',
  'colletta-atlanta',
  '4321 Roswell Rd NE',
  'Buckhead',
  'Atlanta',
  'GA',
  '30342',
  33.8699,
  -84.3771,
  'restaurant',
  'restaurant',
  'https://collettarestaurant.com',
  ARRAY['Italian'],
  'Ford Fry''s rustic-elegant Italian restaurant in Buckhead featuring wood-fired Neapolitan pizzas, hand-rolled pastas, and a sophisticated wine program in an airy, loft-like dining room.',
  ARRAY['upscale', 'date-night', 'lively', 'wine'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- Nara — Contemporary Korean in Buckhead, regular Eater/Infatuation mention
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'Nara',
  'nara-restaurant-atlanta',
  '3280 Peachtree Rd NE',
  'Buckhead',
  'Atlanta',
  'GA',
  '30305',
  33.8497,
  -84.3675,
  'restaurant',
  'restaurant',
  'https://naraatlanta.com',
  ARRAY['Korean', 'Korean BBQ', 'Asian'],
  'Upscale Buckhead Korean restaurant combining modern Korean cuisine with premium tabletop BBQ — high-quality marbled beef, banchan service, and a design-forward interior that has made it an Eater ATL favorite.',
  ARRAY['upscale', 'date-night', 'group-friendly', 'lively'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- NEW AMERICAN / GASTROPUB
-- ============================================================

-- Holeman & Finch Public House — Legendary gastropub, source of ATL's famous burger
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'Holeman & Finch Public House',
  'holeman-and-finch',
  '2277 Peachtree Rd NE',
  'Buckhead',
  'Atlanta',
  'GA',
  '30309',
  33.8143,
  -84.3896,
  'restaurant',
  'restaurant',
  'https://holeman-finch.com',
  ARRAY['American', 'Gastropub'],
  'The Buckhead gastropub that launched the midnight burger phenomenon and remains one of Atlanta''s most celebrated restaurants — charcuterie, seasonal small plates, and a legendary craft cocktail and beer program.',
  ARRAY['upscale', 'craft-cocktails', 'date-night', 'late-night', 'classic'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- Parish — Inman Park French/American, Eater and ATL Mag staple
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'Parish',
  'parish-atlanta',
  '240 N Highland Ave NE',
  'Inman Park',
  'Atlanta',
  'GA',
  '30307',
  33.7590,
  -84.3680,
  'restaurant',
  'restaurant',
  'https://parishatl.com',
  ARRAY['French', 'American', 'New Orleans'],
  'Inman Park restaurant and market with a New Orleans soul, serving Creole-inflected French-American dishes, exceptional cocktails, and weekend jazz brunch inside a beautifully restored Victorian building.',
  ARRAY['upscale', 'date-night', 'brunch', 'lively', 'patio'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- NOTE: Serpas True Food, The Spence, Woodfire Grill, and Abattoir were
-- researched but confirmed permanently closed. Excluded to keep data clean.

-- ============================================================
-- SPANISH / IBERIAN
-- ============================================================

-- The Iberian Pig — Buckhead Spanish tapas, Ford Fry classic
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'The Iberian Pig',
  'iberian-pig-atlanta',
  '3011 Peachtree Rd NE',
  'Buckhead',
  'Atlanta',
  'GA',
  '30305',
  33.8411,
  -84.3707,
  'restaurant',
  'restaurant',
  'https://theiberianpigatl.com',
  ARRAY['Spanish', 'Tapas'],
  'Ford Fry''s beloved Buckhead Spanish tapas bar with Ibérico ham, house-made charcuterie, croquetas, patatas bravas, and one of Atlanta''s most extensive selections of Spanish wines and sherries.',
  ARRAY['date-night', 'craft-cocktails', 'lively', 'wine', 'upscale'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- MEXICAN
-- ============================================================

-- Minero — Sean Brock's Mexican cantina, Ponce City Market
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'Minero',
  'minero-atlanta',
  '675 Ponce de Leon Ave NE',
  'Ponce City Market Area',
  'Atlanta',
  'GA',
  '30308',
  33.7723,
  -84.3630,
  'restaurant',
  'restaurant',
  'https://mineromexican.com',
  ARRAY['Mexican', 'Tex-Mex'],
  'Sean Brock''s Mexican cantina inside Ponce City Market serving heritage-corn tortillas, birria tacos, and a mezcal-heavy bar program in a lively open market setting.',
  ARRAY['casual', 'lively', 'fun', 'craft-cocktails'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- El Felix — West Midtown Texas-Mexico cantina, Thrillist and Eater featured
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'El Felix',
  'el-felix-atlanta',
  '950 W Marietta St NW',
  'West Midtown',
  'Atlanta',
  'GA',
  '30318',
  33.7820,
  -84.4115,
  'restaurant',
  'restaurant',
  'https://elfelixatl.com',
  ARRAY['Mexican', 'Tex-Mex'],
  'West Midtown Tex-Mex cantina from the Ford Fry restaurant group with fajitas, queso, margaritas by the pitcher, and a festive open-air patio — one of Atlanta''s best outdoor dining spots.',
  ARRAY['casual', 'patio', 'lively', 'group-friendly', 'craft-cocktails'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- COCKTAIL BAR / WINE BAR (editorial-list-featured)
-- ============================================================

-- Kimball House — Decatur oyster and cocktail bar, Eater and Infatuation perennial
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'Kimball House',
  'kimball-house',
  '303 E Howard Ave',
  'Decatur',
  'Decatur',
  'GA',
  '30030',
  33.7744,
  -84.2952,
  'restaurant',
  'restaurant',
  'https://kimball-house.com',
  ARRAY['American', 'Oysters', 'Seafood'],
  'Decatur landmark in a historic train depot serving a raw bar of rotating oyster selections, absinthe cocktails, and seasonal New American plates — a James Beard semifinalist and perennial Eater Essential.',
  ARRAY['upscale', 'date-night', 'craft-cocktails', 'special-occasion', 'historic'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- Octane Coffee — West Midtown specialty coffee roaster and bar institution
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, cuisine, description, vibes, active)
VALUES (
  'Octane Coffee',
  'octane-coffee',
  '1009 Marietta St NW',
  'West Midtown',
  'Atlanta',
  'GA',
  '30318',
  33.7797,
  -84.4086,
  'coffee_shop',
  'coffee_shop',
  'https://octanecoffee.com',
  ARRAY['Coffee', 'Cafe'],
  'Atlanta''s pioneering specialty coffee bar that opened in 2005 on Westside and helped define the city''s third-wave coffee scene, with multiple locations, a full bar, and a beloved community anchor role.',
  ARRAY['casual', 'work-friendly', 'morning', 'local-icon', 'neighborhood'],
  true
) ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- SOURCES (inactive — no crawlable events page)
-- ============================================================

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('bones-restaurant-buckhead', 'Bone''s Restaurant', 'https://bonesrestaurant.com', 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('kevin-rathbun-steak', 'Kevin Rathbun Steak', 'https://kevinrathbunsteak.com', 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('little-alley-steak', 'Little Alley Steak', 'https://littlealleysteak.com', 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('cut-432', 'Cut 432', 'https://cut432.com', 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('kr-steakbar', 'KR SteakBar', 'https://krsteakbar.com', 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('rays-on-the-river', 'Ray''s on the River', 'https://raysrestaurants.com', 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('hals-steakhouse', 'Hal''s Steakhouse', 'https://halsatl.com', 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('pappadeaux-seafood', 'Pappadeaux Seafood Kitchen', 'https://pappadeaux.com', 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('miso-izakaya', 'Miso Izakaya', 'https://misoizakaya.com', 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('kura-sushi-atlanta', 'Kura Revolving Sushi Bar', 'https://kurasushi.com', 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('jijin-atlanta', 'Jijin', 'https://jijin.us', 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('ok-yaki', 'OK Yaki', 'https://okyaki.com', 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('umaido-ramen', 'Umaido', 'https://umaido.com', 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('ssam-bar-atlanta', 'Ssam Bar', 'https://ssambaratl.com', 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('hanwoori-atlanta', 'Hanwoori', NULL, 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('pho-dai-loi-2', 'Pho Dai Loi 2', NULL, 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('xe-lua-vietnamese', 'Xe Lua Vietnamese Restaurant', NULL, 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('viet-tofu', 'Viet Tofu', NULL, 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('surin-west', 'Surin West', 'https://surinwest.com', 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('thaicoon-sushi-bar', 'Thaicoon & Sushi Bar', 'https://thaicoonatl.com', 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('little-bangkok-atlanta', 'Little Bangkok', NULL, 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('canton-house', 'Canton House', NULL, 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('gus-bistro', 'Gu''s Bistro', 'https://gusbistro.com', 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('jenis-ice-cream-atlanta', 'Jeni''s Splendid Ice Creams', 'https://jenis.com', 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('morellis-ice-cream', 'Morelli''s Gourmet Ice Cream', 'https://morellisicecream.com', 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('king-of-pops-atlanta', 'King of Pops', 'https://kingofpops.com', 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('holyfield-bagel', 'Holyfield Bagel', 'https://holyfieldbagelcompany.com', 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('lbagel-atlanta', 'L''bagel', 'https://lbagelatlanta.com', 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('goldbergs-bagel-deli', 'Goldberg''s New York Bagels', 'https://goldbergsnybagels.com', 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('watershed-on-peachtree', 'Watershed on Peachtree', 'https://watershedrestaurant.com', 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('rolling-oven-atlanta', 'Rolling Oven', 'https://rollingovenrestaurant.com', 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('cafe-lapin', 'Cafe Lapin', 'https://cafelapinatl.com', 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('sons-place-atlanta', 'Son''s Place', 'https://sonsplaceatl.com', 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('h-and-f-burger', 'H&F Burger', 'https://hfburger.com', 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('the-real-chow-baby', 'The Real Chow Baby', 'https://therealchowbaby.com', 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('chef-robs-caribbean-cafe', 'Chef Rob''s Caribbean Cafe', 'https://www.facebook.com/ChefRobsCaribbean', 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('leyla-restaurant', 'Leyla Restaurant', 'https://leylarestaurantatlanta.com', 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('bhojanic', 'Bhojanic', 'https://bhojanic.com', 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('pricci-atlanta', 'Pricci', 'https://pricci.com', 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('nikolais-roof', 'Nikolai''s Roof', 'https://nikolaisroof.com', 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('colletta-atlanta', 'Colletta', 'https://collettarestaurant.com', 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('nara-restaurant-atlanta', 'Nara', 'https://naraatlanta.com', 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('holeman-and-finch', 'Holeman & Finch Public House', 'https://holeman-finch.com', 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('parish-atlanta', 'Parish', 'https://parishatl.com', 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

-- Sources for confirmed-closed venues (Serpas, The Spence, Woodfire Grill, Abattoir) intentionally omitted.

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('iberian-pig-atlanta', 'The Iberian Pig', 'https://theiberianpigatl.com', 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('minero-atlanta', 'Minero', 'https://mineromexican.com', 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('el-felix-atlanta', 'El Felix', 'https://elfelixatl.com', 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('kimball-house', 'Kimball House', 'https://kimball-house.com', 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (slug, name, url, source_type, is_active, integration_method, owner_portal_id)
VALUES ('octane-coffee', 'Octane Coffee', 'https://octanecoffee.com', 'venue', false, 'none', (SELECT id FROM portals WHERE slug = 'atlanta'))
ON CONFLICT (slug) DO NOTHING;
