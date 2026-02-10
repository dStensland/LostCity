-- Migration 155: Add oddity shops, antique stores, flea markets, vintage stores, and niche venues
-- Adds ~21 curated specialty shops across the Atlanta metro area including:
-- - Antique stores (Kudzu Antiques, Antique Factory, Chamblee Antiques, etc.)
-- - Flea markets (Peachtree Peddlers, Bill's Flea Market)
-- - Vintage/thrift shops (Junkman's Daughter, Psycho Sisters, The Lucky Exchange, etc.)
-- - Record stores (Fantasyland Records, Ella Guru)
-- - Comic/game stores (My Parents' Basement, Oxford Comics, East Atlanta Comics, etc.)
-- - Crystal/metaphysical shops (Crystal Blue, The Honey Pot)
-- These venues represent important destinations for treasure hunting, browsing, and discovering unique finds.

BEGIN;

-- Antique Stores

INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website,
  description, vibes
) VALUES
(
  'Kudzu Antiques + Modern',
  'kudzu-antiques-modern',
  '2928 E Ponce De Leon Ave',
  'Decatur',
  'Decatur',
  'GA',
  '30030',
  33.7743,
  -84.2969,
  'venue',
  'antique_store',
  'https://kudzuantiques.com',
  '26,000 sq ft facility mixing antique store, new furniture, vintage dealers mall, and gift store voted Atlanta''s Best since 1979.',
  '{vintage,treasure-hunting,eclectic,browsing}'
),
(
  'Antique Factory',
  'antique-factory',
  '5505 Peachtree Rd',
  'Chamblee',
  'Chamblee',
  'GA',
  '30341',
  33.8883,
  -84.3013,
  'venue',
  'antique_store',
  'https://antiquefactoryatlanta.com',
  '8,000 sq ft shop specializing in retro, space age, art nouveau, and 20th-century treasures. Rents props to movie sets.',
  '{retro,vintage,mid-century,treasure-hunting}'
),
(
  'Chamblee Antiques & Interiors',
  'chamblee-antiques-interiors',
  '3550 Broad St Suite A',
  'Chamblee',
  'Chamblee',
  'GA',
  '30341',
  33.8878,
  -84.3039,
  'venue',
  'antique_store',
  'http://antiquerow.com',
  '18,000 sq ft home to Atlanta''s most well-known antiques dealers with American and European antiques, vintage, mid-century, and industrial pieces.',
  '{vintage,antiques,browsing,treasure-hunting}'
),
(
  'Charleston House Antiques',
  'charleston-house-antiques',
  '3676 N Peachtree Rd',
  'Chamblee',
  'Chamblee',
  'GA',
  '30341',
  33.8896,
  -84.3022,
  'venue',
  'antique_store',
  'http://www.charlestonhouseantiques.com',
  'Quality antique store on Chamblee''s historic Antique Row with curated American and European pieces.',
  '{antiques,vintage,classic,browsing}'
),
(
  'Decatur Estate Vintage Market',
  'decatur-estate-vintage-market',
  '3429 Covington Hwy C',
  'Decatur',
  'Decatur',
  'GA',
  '30032',
  33.7582,
  -84.2715,
  'venue',
  'antique_store',
  'https://www.decaturestateantiques.com',
  '20,000+ sq ft with 70+ dealers featuring antique furniture, pottery, home decor, lamps, books, jewelry, and collectibles.',
  '{antiques,vintage,treasure-hunting,browsing}'
),
(
  'Atlanta Vintage Books',
  'atlanta-vintage-books',
  '3660 Clairmont Rd',
  'Chamblee',
  'Atlanta',
  'GA',
  '30341',
  33.8577,
  -84.3138,
  'bookstore',
  'bookstore',
  'https://www.atlantavintagebooks.com',
  'Cat-friendly shop stuffed with rare and historic books across every genre alongside a cozy browsing atmosphere.',
  '{cozy,cats,rare-books,browsing}'
),

-- Flea Markets

(
  'Peachtree Peddlers Flea Market',
  'peachtree-peddlers-flea-market',
  '155 Mill Rd',
  'McDonough',
  'McDonough',
  'GA',
  '30253',
  33.4448,
  -84.1363,
  'farmers_market',
  'flea_market',
  'https://peachtreepeddlers.net',
  'South Atlanta''s largest flea market and antique center with indoor and outdoor booths featuring collectibles, antiques, and household treasures.',
  '{treasure-hunting,bargains,browsing,outdoor}'
),
(
  'Bill''s Flea Market',
  'bills-flea-market',
  '11001 Veterans Memorial Hwy',
  'Lithia Springs',
  'Lithia Springs',
  'GA',
  '30122',
  33.7769,
  -84.6335,
  'farmers_market',
  'flea_market',
  'https://www.billsfleamarket.com',
  'Weekend flea market with 400+ booths featuring collectibles, fresh produce, clothing, and antiques. Open Sat-Sun 7am-4pm.',
  '{treasure-hunting,bargains,outdoor,weekend-destination}'
),

-- Vintage / Thrift (Curated)

(
  'Junkman''s Daughter',
  'junkmans-daughter',
  '464 Moreland Ave NE',
  'Little Five Points',
  'Atlanta',
  'GA',
  '30307',
  33.7644,
  -84.3488,
  'venue',
  'vintage_shop',
  'https://www.thejunkmansdaughter.com',
  'The crown jewel of Little Five Points — a massive eclectic emporium packed with vintage clothing, costumes, accessories, novelties, and home decor.',
  '{eclectic,weird,colorful,iconic,funky}'
),
(
  'Psycho Sisters',
  'psycho-sisters',
  '428 Moreland Ave NE',
  'Little Five Points',
  'Atlanta',
  'GA',
  '30307',
  33.7641,
  -84.3489,
  'venue',
  'vintage_shop',
  NULL,
  '20+ year Little Five Points institution specializing in vintage, festival, and era-specific clothing with punk rock edge. Used by celebrities and costume designers.',
  '{punk,vintage,edgy,curated}'
),
(
  'The Lucky Exchange',
  'the-lucky-exchange',
  '212 Ponce De Leon Ave NE',
  'Midtown',
  'Atlanta',
  'GA',
  '30308',
  33.7730,
  -84.3747,
  'venue',
  'vintage_shop',
  'https://www.luckyexchange.com',
  'Curated vintage boutique offering extraordinary clothes, spectacular vintage furniture, jewelry, and books.',
  '{curated,vintage,boutique,stylish}'
),
(
  'The Clothing Warehouse',
  'the-clothing-warehouse',
  '420 Moreland Ave NE',
  'Little Five Points',
  'Atlanta',
  'GA',
  '30307',
  33.7640,
  -84.3490,
  'venue',
  'vintage_shop',
  'https://theclothingwarehouse.com',
  'Hand-curated vintage clothing from the 50s through 80s. Rows of retro t-shirts, dresses, jackets, and more.',
  '{retro,vintage,affordable,browsing}'
),

-- Record Stores

(
  'Fantasyland Records',
  'fantasyland-records',
  '360 Pharr Rd NE',
  'Buckhead',
  'Atlanta',
  'GA',
  '30305',
  33.8151,
  -84.3730,
  'record_store',
  'record_store',
  'https://fantasylandrecords.com',
  'Possibly the largest collection of used vinyl in Georgia. Visited by Robert Plant, Eric Clapton, and Andre 3000.',
  '{vinyl,legendary,crate-digging,music-lovers}'
),
(
  'Ella Guru Record Shop',
  'ella-guru-record-shop',
  '2747 Lavista Rd',
  'Decatur',
  'Decatur',
  'GA',
  '30033',
  33.7936,
  -84.2995,
  'record_store',
  'record_store',
  NULL,
  'Highest quality selection of used indie, classic, and alternative rock LPs in Atlanta.',
  '{indie,crate-digging,curated,music-lovers}'
),

-- Comic / Game Stores

(
  'My Parents'' Basement',
  'my-parents-basement',
  '22 N Avondale Rd',
  'Avondale Estates',
  'Avondale Estates',
  'GA',
  '30002',
  33.7718,
  -84.2665,
  'bookstore',
  'comic_shop',
  'https://www.myparentsbasementcbcb.com',
  'Comic book shop meets craft beer bar and eatery with incredible geeky ambiance. A true destination for nerds.',
  '{geeky,craft-beer,comics,community,fun}'
),
(
  'Oxford Comics & Games',
  'oxford-comics-games',
  '2855 Piedmont Rd NE',
  'Buckhead',
  'Atlanta',
  'GA',
  '30305',
  33.8173,
  -84.3675,
  'bookstore',
  'comic_shop',
  'https://oxfordcomicsandgames.com',
  'Atlanta''s oldest comic book store featuring comics, games, and collectibles in every corner.',
  '{comics,games,collectibles,nostalgic}'
),
(
  'East Atlanta Comics',
  'east-atlanta-comics',
  '508 Flat Shoals Ave',
  'East Atlanta Village',
  'Atlanta',
  'GA',
  '30316',
  33.7398,
  -84.3426,
  'bookstore',
  'comic_shop',
  'https://www.eastatlantacomics.com',
  'Locally owned community-driven comic shop in East Atlanta Village. Open Wed-Sun.',
  '{community,comics,indie,neighborhood}'
),
(
  'Titan Games & Comics',
  'titan-games-comics',
  '2512 Cobb Pkwy SW',
  'Smyrna',
  'Smyrna',
  'GA',
  '30080',
  33.8586,
  -84.4726,
  'bookstore',
  'comic_shop',
  'https://titangamesandcomics.com',
  'Excellent comic and tabletop game selection with weekly events, friendly staff, and commitment to inclusivity.',
  '{games,comics,community,inclusive,events}'
),
(
  'Infinite Realities',
  'infinite-realities',
  '5007 Lavista Rd',
  'Tucker',
  'Tucker',
  'GA',
  '30084',
  33.8500,
  -84.2359,
  'bookstore',
  'comic_shop',
  'https://infiniterealitiescomics.com',
  'Metro Atlanta''s best comic and game store with comics, manga, board games, Pokemon, and Magic: The Gathering.',
  '{comics,gaming,collectibles,friendly}'
),

-- Crystal / Metaphysical

(
  'Crystal Blue',
  'crystal-blue',
  '1168 Euclid Ave NE',
  'Little Five Points',
  'Atlanta',
  'GA',
  '30307',
  33.7651,
  -84.3496,
  'venue',
  'crystal_shop',
  'https://crystalbluel5p.com',
  'Family-owned metaphysical gem and mineral shop since 1985 with crystals, jewelry, candles, incense, divination tools, and local art.',
  '{crystals,metaphysical,spiritual,eclectic}'
),
(
  'The Honey Pot Energy and Art',
  'the-honey-pot-energy-and-art',
  '1087 Euclid Ave',
  'Little Five Points',
  'Atlanta',
  'GA',
  '30307',
  33.7648,
  -84.3505,
  'venue',
  'crystal_shop',
  'https://energyandarts.com',
  'Black-owned metaphysical store with hand-poured candles, spiritual baths, and products invoking positive energy.',
  '{spiritual,black-owned,candles,healing}'
)
ON CONFLICT (slug) DO UPDATE SET
  website = EXCLUDED.website,
  description = EXCLUDED.description,
  vibes = EXCLUDED.vibes;

COMMIT;
