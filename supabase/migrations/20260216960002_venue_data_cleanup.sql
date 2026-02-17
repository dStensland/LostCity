-- Comprehensive venue data cleanup
-- 1. Delete junk venues (0 events, not in tracks)
-- 2. Merge true duplicates
-- 3. Reclassify generic "venue" types
-- 4. Reclassify NULL venue types
-- 5. Consolidate non-standard venue types

-- ============================================================================
-- 1. DELETE JUNK VENUES
-- Only venues with 0 events and not in explore_track_venues
-- ============================================================================

-- 1a. Address-as-name venues with 0 events (not legitimate named venues)
DELETE FROM venues WHERE id IN (
  19, 39, 60, 88, 93, 98, 298, 299, 300, 301, 302, 303, 393, 394, 397,
  524, 1546, 1568, 1572, 1578, 1580, 1589, 1591, 1761, 1772, 1773,
  1788, 1789, 1792, 1813, 1821, 1827, 1838, 1839, 1841, 1843,
  1904, 1909, 1910
);

-- 1b. Gas stations (not destinations)
DELETE FROM venues WHERE id IN (
  3169, 3178, 3179, 3181, 3187, 3298, 3300, 3301, 3306, 3307, 3311,
  3318, 3319, 3320, 3321, 3322, 3323, 3324, 3326, 3328, 3330,
  3451, 3464, 3465, 3466, 3468, 3469, 3490, 3580, 3581, 3582,
  3586, 3635, 3645
);

-- 1c. Fast food chains (not destinations, 0 events)
DELETE FROM venues WHERE id IN (
  3054, 3055, 3060, 3073, 3084, 3087, 3088, 3092, 3093, 3105,
  3173, 3176, 3195, 3254, 3309, 3341, 3364, 3368, 3376, 3377,
  3379, 3453, 3456, 3460, 3482, 3494, 3497, 3498, 3503, 3513,
  3521, 3533, 3583
);

-- 1d. Junk names (Unknown, email addresses, Location TBD, etc.)
DELETE FROM venues WHERE id IN (
  1111,  -- Unknown
  1925,  -- email Raphael at...
  1926,  -- Online! Email us at...
  2154,  -- Various Bars and Restaurants
  2165,  -- Various Restaurants
  2183,  -- Online Casino
  2286   -- Various Atlanta streets
);

-- 1e. Other non-destination junk (0 events)
DELETE FROM venues WHERE id IN (
  2198   -- Seattle, Washington (wrong city entirely)
);

-- ============================================================================
-- 2. MERGE TRUE DUPLICATES
-- Keep the best record, reassign events, update track references, delete dupes
-- ============================================================================

-- 2a. 7 Stages: Keep 44 (8 events, correct theater type, dq=92)
--     Merge 339 (0 events, venue type) and 2279 (3 events, in yallywood track)
UPDATE events SET venue_id = 44 WHERE venue_id IN (339, 2279);
UPDATE explore_track_venues SET venue_id = 44 WHERE venue_id = 2279;
DELETE FROM venues WHERE id IN (339, 2279);

-- 2b. Schwartz Center: Keep 534 (59 events, dq=77)
--     Delete 408 (0 events, dq=68)
UPDATE events SET venue_id = 534 WHERE venue_id = 408;
DELETE FROM venues WHERE id = 408;

-- 2c. Painted Pin: Keep 263 (lower ID), delete 2085 (dupe)
UPDATE events SET venue_id = 263 WHERE venue_id = 2085;
DELETE FROM venues WHERE id = 2085;

-- 2d. Eddie's Attic: Keep 192 (34 events, music_venue, dq=92)
--     Delete 3589 (0 events, wrong type restaurant)
UPDATE events SET venue_id = 192 WHERE venue_id = 3589;
DELETE FROM venues WHERE id = 3589;

-- 2e. Ferst Center: Keep 533 (15 events, dq=92)
--     Delete 296 (0 events, dq=62)
UPDATE events SET venue_id = 533 WHERE venue_id = 296;
DELETE FROM venues WHERE id = 296;

-- 2f. Staplehouse: Keep 674 (in tracks, has image, dq=77)
--     Delete 3661 and 3256 (0 events each, dq=48)
UPDATE events SET venue_id = 674 WHERE venue_id IN (3661, 3256);
DELETE FROM venues WHERE id IN (3661, 3256);

-- 2g. Big Peach Running Co: Keep 467 (52 events, has image, dq=92)
--     Delete 433 (0 events), 2127 (0 events), 2126 (0 events)
UPDATE events SET venue_id = 467 WHERE venue_id IN (433, 2127, 2126);
DELETE FROM venues WHERE id IN (433, 2127, 2126);

-- 2h. The Beehive: Keep 2377 (better data, dq=78, O4W)
--     Delete 1836 (dq=62)
UPDATE events SET venue_id = 2377 WHERE venue_id = 1836;
DELETE FROM venues WHERE id = 1836;

-- 2i. Harbor Coffee: Keep 3236 (1 event), delete 2529 and 3591
UPDATE events SET venue_id = 3236 WHERE venue_id IN (2529, 3591);
DELETE FROM venues WHERE id IN (2529, 3591);

-- 2j. 365 Center: Keep 2824 (56 events), merge 2834 (4 events) and 2772 (36 events)
UPDATE events SET venue_id = 2824 WHERE venue_id IN (2834, 2772);
DELETE FROM venues WHERE id IN (2834, 2772);

-- ============================================================================
-- 3. RECLASSIFY GENERIC "venue" TYPE
-- ============================================================================

-- Theaters
UPDATE venues SET venue_type = 'theater' WHERE id IN (
  339, 3025, 369, 725, 436, 534, 408, 465  -- 7 Stages already deleted above
);
-- Note: 339, 408 deleted above; these UPDATEs are idempotent/no-ops for deleted rows

-- Comedy clubs
UPDATE venues SET venue_type = 'comedy_club' WHERE id IN (
  424, 195, 1425, 550, 1489
);

-- Entertainment (escape rooms, bowling, karting, haunted houses, etc.)
UPDATE venues SET venue_type = 'entertainment' WHERE id IN (
  592, 1713, 604, 462, 1715, 1711, 260, 267, 1725, 254, 1279, 1750,
  268, 1727, 593, 601, 1723, 1724, 1268, 252, 253, 2468, 266, 587,
  606, 263, 605, 265, 258, 259, 1354, 609, 262, 1712, 2085, 248, 247,
  1352, 270
);

-- Bars
UPDATE venues SET venue_type = 'bar' WHERE id = 256; -- Battle & Brew

-- Nightclub
UPDATE venues SET venue_type = 'nightclub' WHERE id = 10; -- REVEL

-- Record store
UPDATE venues SET venue_type = 'record_store' WHERE id = 603; -- Moods Music

-- Market (malls, shopping, antiques, etc.)
UPDATE venues SET venue_type = 'market' WHERE id IN (
  2347, 899, 2370, 1367, 2348, 2349, 2372, 2365, 2350, 538, 565, 1369,
  2427, 2354, 2346, 2376, 537, 1344, 561, 2371, 2369, 1672, 2355,
  2373, 2374, 2375, 597, 897, 2377, 1836, 2357, 2366, 2356, 1362, 389,
  588, 611
);

-- Gallery / arts center
UPDATE venues SET venue_type = 'gallery' WHERE id IN (
  533, 296, 845, 1334, 1102, 1265, 535, 1478, 4075, 1820
);

-- Organization
UPDATE venues SET venue_type = 'organization' WHERE id IN (
  101, 458, 375, 2126, 433, 467, 2127, 27, 1746
);

-- Fitness center
UPDATE venues SET venue_type = 'fitness_center' WHERE id IN (
  837, 401, 841, 843
);

-- Hospital
UPDATE venues SET venue_type = 'hospital' WHERE id IN (
  3772, 3771, 3774, 3773, 3770
);

-- Pharmacy (medical support venues)
UPDATE venues SET venue_type = 'pharmacy' WHERE id IN (
  492, 3783, 3782, 3785, 3784, 493
);

-- Park
UPDATE venues SET venue_type = 'park' WHERE id IN (
  1668, 891, 416
);

-- Festival
UPDATE venues SET venue_type = 'festival' WHERE id = 566; -- Dragon Con

-- Coworking
UPDATE venues SET venue_type = 'coworking' WHERE id = 62; -- The Gathering Spot

-- Event space (neighborhoods used as event locations, etc.)
UPDATE venues SET venue_type = 'event_space' WHERE id IN (
  1333, 1358, 1417, 1768, 1356, 931, 1431
);

-- Remaining "venue" type -> specific types
UPDATE venues SET venue_type = 'theater' WHERE id = 527; -- Actor's Express
UPDATE venues SET venue_type = 'entertainment' WHERE id = 1714; -- All In Adventures
UPDATE venues SET venue_type = 'theater' WHERE id = 366; -- Dad's Garage
UPDATE venues SET venue_type = 'museum' WHERE id = 4145; -- Donaldson-Bannister Farm
UPDATE venues SET venue_type = 'entertainment' WHERE id = 1406; -- Eastside Bowl
UPDATE venues SET venue_type = 'market' WHERE id = 1216; -- Great Wall Supermarket
UPDATE venues SET venue_type = 'market' WHERE id IN (1273, 1274, 1275, 1276, 1277, 1278); -- Home Depots
UPDATE venues SET venue_type = 'entertainment' WHERE id = 1722; -- Jeju Sauna
UPDATE venues SET venue_type = 'entertainment' WHERE id = 999; -- Metro Fun Center
UPDATE venues SET venue_type = 'museum' WHERE id = 1666; -- The Hermitage
UPDATE venues SET venue_type = 'theater' WHERE id = 582; -- Theatrical Outfit
UPDATE venues SET venue_type = 'entertainment' WHERE id = 981; -- Turtle Cove Golf Course
UPDATE venues SET venue_type = 'event_space' WHERE id = 107; -- Under the Big Top
UPDATE venues SET venue_type = 'event_space' WHERE id = 982; -- Cyprus Hartford

-- ============================================================================
-- 4. RECLASSIFY NULL VENUE TYPES
-- ============================================================================

-- Arena / sports venues
UPDATE venues SET venue_type = 'arena' WHERE id IN (
  2082, 1978, 1984, 2228, 2271, 1961, 1956, 1945, 1962, 1983,
  2226, 2237, 2343, 1977, 3862, 1937, 2134
);

-- Bars
UPDATE venues SET venue_type = 'bar' WHERE id IN (3052, 3844);

-- Community centers
UPDATE venues SET venue_type = 'community_center' WHERE id IN (
  2202, 2200, 2254, 2258, 2277
);

-- Convention centers
UPDATE venues SET venue_type = 'convention_center' WHERE id IN (
  2163, 2189, 2151, 2253, 2168, 2191, 2252, 2148, 2335, 2206,
  2344, 2256, 2255, 2340, 2342, 2338
);

-- Event spaces (neighborhoods, plazas, streets, buildings)
UPDATE venues SET venue_type = 'event_space' WHERE id IN (
  2562, 2214, 2185, 2244, 2193, 2266, 2174, 2243, 2240, 2197,
  2220, 2336, 2251, 2567, 2217, 2182, 2172, 2171, 2570, 2218,
  2272, 2262, 2337, 2345, 2269, 3865
);

-- Festivals
UPDATE venues SET venue_type = 'festival' WHERE id IN (
  2152, 2553, 3845, 2156, 2157, 2187, 2188, 2194, 2552, 2199,
  2203, 2207, 2208, 2209, 2554, 2161, 2568, 3864, 2265
);

-- Hotels
UPDATE venues SET venue_type = 'hotel' WHERE id IN (
  2565, 2221, 3866, 2270, 2276, 2317, 2192, 2273, 2261, 2267,
  2238, 2275
);

-- Market
UPDATE venues SET venue_type = 'market' WHERE id = 2339; -- Trader's Mall

-- Organization
UPDATE venues SET venue_type = 'organization' WHERE id = 2160; -- Atlanta Magazine

-- Park
UPDATE venues SET venue_type = 'park' WHERE id IN (3861, 2196, 2162);

-- Theater
UPDATE venues SET venue_type = 'theater' WHERE id = 3863; -- Landmark's Midtown Art Cinema

-- Museum
UPDATE venues SET venue_type = 'museum' WHERE id = 4145; -- Donaldson-Bannister Farm (already set above, idempotent)

-- Remaining NULL types that have events but are hard to classify -> event_space
UPDATE venues SET venue_type = 'event_space' WHERE id IN (
  2078,  -- Airport
  2170,  -- AmericasMart Building 3
  2245,  -- Cobb County
  2257,  -- Conference venue
  1954,  -- Convocation Center
  2247,  -- Location TBD
  2341,  -- Machinists Aerospace Union Hall
  2204,  -- McDonough Square
  2573,  -- outside of Murphy's
  4030,  -- Starlite Family Fun Center
  2159,  -- Sugarloaf Mills
  2263,  -- Suwanee Town Center
  2169,  -- Thompson's Point
  2166,  -- Various venues across Atlanta
  2274   -- Vibe Credit Union Showplace
);

-- Remaining NULL with 0 events -> event_space
UPDATE venues SET venue_type = 'event_space' WHERE id IN (
  2150,  -- Atlanta Bead Show
  2239   -- Old Moreland Mill
);

-- ============================================================================
-- 5. CONSOLIDATE NON-STANDARD VENUE TYPES
-- ============================================================================

-- nonprofit, nonprofit_hq -> organization
UPDATE venues SET venue_type = 'organization' WHERE venue_type IN ('nonprofit', 'nonprofit_hq');

-- grocery -> market
UPDATE venues SET venue_type = 'market' WHERE venue_type = 'grocery';

-- international_market -> market
UPDATE venues SET venue_type = 'market' WHERE venue_type = 'international_market';

-- fitness -> fitness_center
UPDATE venues SET venue_type = 'fitness' WHERE venue_type = 'fitness';
-- Correction: fitness -> fitness_center
UPDATE venues SET venue_type = 'fitness_center' WHERE venue_type = 'fitness';

-- recreation -> fitness_center
UPDATE venues SET venue_type = 'fitness_center' WHERE venue_type = 'recreation';

-- games -> entertainment
UPDATE venues SET venue_type = 'entertainment' WHERE venue_type = 'games';

-- trail -> park
UPDATE venues SET venue_type = 'park' WHERE venue_type = 'trail';

-- skyscraper -> landmark (keep as distinctive type)
UPDATE venues SET venue_type = 'landmark' WHERE venue_type = 'skyscraper';

-- public_art -> landmark
UPDATE venues SET venue_type = 'landmark' WHERE venue_type = 'public_art';

-- viewpoint -> landmark
UPDATE venues SET venue_type = 'landmark' WHERE venue_type = 'viewpoint';

-- club -> classify individually
UPDATE venues SET venue_type = 'nightclub' WHERE id IN (832, 829, 834, 828); -- strip clubs / nightlife
UPDATE venues SET venue_type = 'bar' WHERE id = 1919; -- Jamerican Lounge
UPDATE venues SET venue_type = 'landmark' WHERE id = 4080; -- The Lion of Atlanta
UPDATE venues SET venue_type = 'arena' WHERE id = 2232; -- The Dome
UPDATE venues SET venue_type = 'event_space' WHERE id = 2147; -- Coca-Cola Stage

-- cultural_center -> community_center
UPDATE venues SET venue_type = 'community_center' WHERE venue_type = 'cultural_center';

-- community_center_religious -> community_center
UPDATE venues SET venue_type = 'community_center' WHERE venue_type = 'community_center_religious';

-- wellness -> fitness_center
UPDATE venues SET venue_type = 'fitness_center' WHERE venue_type = 'wellness';

-- monastery -> church
UPDATE venues SET venue_type = 'church' WHERE venue_type = 'monastery';

-- virtual -> delete the single virtual venue if it has no events
DELETE FROM venues WHERE venue_type = 'virtual'
  AND id NOT IN (SELECT DISTINCT venue_id FROM events WHERE venue_id IS NOT NULL);

-- ============================================================================
-- 6. FIX McDONALD'S TYPE (was coffee_shop, should be restaurant)
-- ============================================================================
UPDATE venues SET venue_type = 'restaurant' WHERE name = 'McDonald''s' AND venue_type = 'coffee_shop';
UPDATE venues SET venue_type = 'restaurant' WHERE name = 'Dunkin''' AND venue_type = 'coffee_shop';
UPDATE venues SET venue_type = 'restaurant' WHERE name = 'Panera Bread' AND venue_type = 'coffee_shop';
UPDATE venues SET venue_type = 'restaurant' WHERE name = 'Einstein Bros. Bagels' AND venue_type = 'coffee_shop';
UPDATE venues SET venue_type = 'restaurant' WHERE name = 'Chicken Salad Chick' AND venue_type = 'coffee_shop';

-- ============================================================================
-- 7. VENUE-VS-ORG RECLASSIFICATION
-- Venues that are really organizations, festivals, or mistyped
-- ============================================================================

-- Organizations (host events at other venues, not physical destinations)
UPDATE venues SET venue_type = 'organization' WHERE id IN (
  203,   -- Atlanta Film Society (was cinema)
  1797,  -- Atlanta Humane Society (was event_space)
  1230,  -- Atlanta Freethought Society (was community_center)
  2606,  -- Southeast Fiber Arts Alliance (was community_center)
  1097,  -- Avondale Arts Alliance (was gallery)
  1249,  -- South River Forest Coalition (was park)
  4191,  -- Alliance Française d'Atlanta (was event_space)
  2595,  -- Scraplanta (was community_center)
  1016,  -- Encyclomedia (was gallery)
  2073,  -- Midnight Grove Collective (was gallery)
  1102,  -- MASS Collective (was gallery)
  2591,  -- Circus Arts Institute (was fitness_center)
  2895   -- Sacred Space Foundation (was community_center)
);

-- Festivals (events, not venues)
UPDATE venues SET venue_type = 'festival' WHERE id IN (
  2283,  -- Atlanta Salsa & Bachata Festival
  2284,  -- Atlanta Science Festival
  2285,  -- Atlanta Spotlight Film Festival
  2288,  -- Cobb International Film Festival
  2291,  -- Grant Park Summer Shade Festival
  2201,  -- Georgia Latino International Film Festival
  609,   -- Southern-Fried Gaming Expo
  2150,  -- Atlanta Bead Show
  1104   -- Southern Fried Queer Pride
);

-- Escape rooms misclassified as fitness_center
UPDATE venues SET venue_type = 'entertainment' WHERE id IN (
  1716,  -- Escape Room Atlanta
  1710,  -- Paranoia Quest Escape Room
  1717   -- Quest Quest Escape Room
);

-- Cooking schools are event spaces, not restaurants
UPDATE venues SET venue_type = 'event_space' WHERE id IN (
  598,   -- Publix Aprons Cooking School
  599    -- The Cooking School at Irwin Street
);

-- Ridgeview Institute is a hospital, not community_center
UPDATE venues SET venue_type = 'hospital' WHERE id = 2814;

-- Westview Cemetery is a museum/historic site, not a park
UPDATE venues SET venue_type = 'museum' WHERE id = 4033;
