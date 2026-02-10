-- Migration 156: Metro Atlanta Oddity, Antique, & Niche Venue Expansion
-- Extends coverage beyond ITP to include metro-wide oddity shops, prop houses,
-- antique malls, and curiosity destinations. Focuses on places people would
-- specifically drive to visit.

BEGIN;

-- ============================================================================
-- ODDITY / CURIOSITY / PROP DESTINATIONS
-- ============================================================================

-- Obscure Props — same building as Oddities Museum, open to public for shopping
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website,
  description, vibes
) VALUES (
  'Obscure Props',
  'obscure-props',
  '3870 N Peachtree Rd Suite C, Chamblee, GA 30341',
  'Chamblee',
  'Chamblee', 'GA', '30341',
  33.8870, -84.3015,
  'museum', 'oddity_shop',
  'https://www.obscureprops.com',
  'Atlanta''s premier film prop rental house open to the public. Real and replica human skeletons, taxidermy, Victorian antiques, carnival art, funeral memorabilia, and arcade games. Credits include Ozark, The Conjuring 3, and The Wonder Years.',
  '{weird,macabre,film-industry,treasure-hunting,taxidermy}'
)
ON CONFLICT (slug) DO UPDATE SET
  website = EXCLUDED.website,
  description = EXCLUDED.description,
  vibes = EXCLUDED.vibes;

-- Rainy Day Revival — L5P oddities store
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website,
  description, vibes
) VALUES (
  'Rainy Day Revival',
  'rainy-day-revival',
  '1146 Euclid Ave NE, Atlanta, GA 30307',
  'Little Five Points',
  'Atlanta', 'GA', '30307',
  33.7650, -84.3498,
  'museum', 'oddity_shop',
  'https://www.rainydayrevival.com',
  'Atlanta''s largest oddities store in the heart of Little Five Points. Taxidermy, animal remains, wet specimens, funerary memorabilia, bones, and morbid curiosities. Open Thu-Mon.',
  '{weird,macabre,taxidermy,oddities,eclectic}'
)
ON CONFLICT (slug) DO UPDATE SET
  website = EXCLUDED.website,
  description = EXCLUDED.description,
  vibes = EXCLUDED.vibes;

-- Night Owl Oddities — south side oddities & spiritual shop
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website,
  description, vibes
) VALUES (
  'Night Owl Oddities',
  'night-owl-oddities',
  '4035 Jonesboro Rd Unit 270, Forest Park, GA 30297',
  'Forest Park',
  'Forest Park', 'GA', '30297',
  33.6214, -84.3575,
  'venue', 'oddity_shop',
  NULL,
  'Oddities and spiritual shop south of Atlanta with taxidermy, crystals, candles, and curiosities. Open late with evening hours.',
  '{weird,spiritual,oddities,crystals,late-night}'
)
ON CONFLICT (slug) DO UPDATE SET
  description = EXCLUDED.description,
  vibes = EXCLUDED.vibes;

-- BOBO Intriguing Objects — Westside curiosity/design shop
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website,
  description, vibes
) VALUES (
  'BOBO Intriguing Objects',
  'bobo-intriguing-objects',
  '1235 Chattahoochee Ave NW Suite 152, Atlanta, GA 30318',
  'Westside',
  'Atlanta', 'GA', '30318',
  33.8038, -84.4280,
  'venue', 'oddity_shop',
  'https://bobointriguingobjects.com',
  'Eclectic furnishings and curiosities showroom on the Westside. One-of-a-kind antiques, taxidermy, industrial artifacts, and globally sourced intriguing objects for home and film sets.',
  '{eclectic,design,curiosities,industrial,global}'
)
ON CONFLICT (slug) DO UPDATE SET
  website = EXCLUDED.website,
  description = EXCLUDED.description,
  vibes = EXCLUDED.vibes;

-- ============================================================================
-- METRO ANTIQUE MALLS — Destination-worthy large venues
-- ============================================================================

-- Marietta Antique Mall
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website,
  description, vibes
) VALUES (
  'Marietta Antique Mall',
  'marietta-antique-mall',
  '1477 Roswell Rd Suite 100, Marietta, GA 30062',
  'Marietta',
  'Marietta', 'GA', '30062',
  33.9734, -84.5218,
  'venue', 'antique_store',
  'https://www.mariettaantiquemall.com',
  '30,000 sq ft antique mall near the Big Chicken with 100+ vendors. Vintage treasures, mid-century modern, collectibles, and estate finds.',
  '{antiques,vintage,treasure-hunting,browsing,mid-century}'
)
ON CONFLICT (slug) DO UPDATE SET
  website = EXCLUDED.website,
  description = EXCLUDED.description,
  vibes = EXCLUDED.vibes;

-- Cobb Antique Mall — "The Vintage Superstore"
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website,
  description, vibes
) VALUES (
  'Cobb Antique Mall',
  'cobb-antique-mall',
  '2800 Canton Rd, Marietta, GA 30066',
  'Marietta',
  'Marietta', 'GA', '30066',
  34.0065, -84.5313,
  'venue', 'antique_store',
  'https://cobbantiques.com',
  'The Vintage Superstore — 46,000 sq ft with 200+ dealer spaces. Expanded in 2025 with antiques, vintage furniture, records, collectibles, and retro finds.',
  '{vintage,antiques,treasure-hunting,massive,browsing}'
)
ON CONFLICT (slug) DO UPDATE SET
  website = EXCLUDED.website,
  description = EXCLUDED.description,
  vibes = EXCLUDED.vibes;

-- Queen of Hearts Antiques — Alpharetta
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website,
  description, vibes
) VALUES (
  'Queen of Hearts Antiques - Alpharetta',
  'queen-of-hearts-alpharetta',
  '670 N Main St, Alpharetta, GA 30009',
  'Alpharetta',
  'Alpharetta', 'GA', '30009',
  34.0797, -84.2943,
  'venue', 'antique_store',
  'https://www.queenofheartsantiques-interiors.com',
  'Part of North Georgia''s largest antique mall chain with 550+ dealer-merchants across three locations. European imports, American antiques, and vintage decor.',
  '{antiques,vintage,treasure-hunting,upscale,browsing}'
)
ON CONFLICT (slug) DO UPDATE SET
  website = EXCLUDED.website,
  description = EXCLUDED.description,
  vibes = EXCLUDED.vibes;

-- Queen of Hearts Antiques — Buford
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website,
  description, vibes
) VALUES (
  'Queen of Hearts Antiques - Buford',
  'queen-of-hearts-buford',
  '4125 GA Hwy 20, Buford, GA 30518',
  'Buford',
  'Buford', 'GA', '30518',
  34.0858, -84.0193,
  'venue', 'antique_store',
  'https://www.queenofheartsantiques-interiors.com',
  'Massive Buford location of North Georgia''s largest antique mall chain. Hundreds of dealer booths with antiques, vintage furniture, art, and collectibles.',
  '{antiques,vintage,treasure-hunting,massive,browsing}'
)
ON CONFLICT (slug) DO UPDATE SET
  website = EXCLUDED.website,
  description = EXCLUDED.description,
  vibes = EXCLUDED.vibes;

-- Queen of Hearts Antiques — Marietta
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website,
  description, vibes
) VALUES (
  'Queen of Hearts Antiques - Marietta',
  'queen-of-hearts-marietta',
  '2745 Sandy Plains Rd, Marietta, GA 30066',
  'Marietta',
  'Marietta', 'GA', '30066',
  34.0217, -84.4784,
  'venue', 'antique_store',
  'https://www.queenofheartsantiques-interiors.com',
  'Marietta outpost of the Queen of Hearts chain. Sprawling antique mall with furniture, art, jewelry, and vintage finds from hundreds of dealers.',
  '{antiques,vintage,treasure-hunting,browsing}'
)
ON CONFLICT (slug) DO UPDATE SET
  website = EXCLUDED.website,
  description = EXCLUDED.description,
  vibes = EXCLUDED.vibes;

-- Lakewood 400 Antiques Market — Cumming (monthly market)
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website,
  description, vibes
) VALUES (
  'Lakewood 400 Antiques Market',
  'lakewood-400-antiques-market',
  '1321 Atlanta Hwy, Cumming, GA 30040',
  'Cumming',
  'Cumming', 'GA', '30040',
  34.1771, -84.1570,
  'venue', 'antique_store',
  'https://www.lakewoodantiques.com',
  '75,000 sq ft climate-controlled antique market with 500+ dealer spaces. Open the third weekend of every month. One of the largest in the Southeast.',
  '{antiques,massive,treasure-hunting,monthly-market,browsing}'
)
ON CONFLICT (slug) DO UPDATE SET
  website = EXCLUDED.website,
  description = EXCLUDED.description,
  vibes = EXCLUDED.vibes;

-- ============================================================================
-- LOCAL MAKERS / ARTISAN SHOPS
-- ============================================================================

-- The Beehive — handmade artisan collective
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website,
  description, vibes
) VALUES (
  'The Beehive',
  'the-beehive-atl',
  '1250 Caroline St NE Suite C120, Atlanta, GA 30307',
  'Old Fourth Ward',
  'Atlanta', 'GA', '30307',
  33.7620, -84.3548,
  'venue', 'vintage_shop',
  'https://thebeehiveatl.com',
  'Atlanta''s first handmade boutique collective. Jewelry, clothing, art, candles, and food products all made by local Atlanta artists. Meet the makers in person.',
  '{handmade,local-artists,artisan,boutique,unique}'
)
ON CONFLICT (slug) DO UPDATE SET
  website = EXCLUDED.website,
  description = EXCLUDED.description,
  vibes = EXCLUDED.vibes;

COMMIT;
