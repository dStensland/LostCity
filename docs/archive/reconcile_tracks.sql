-- ============================================================================
-- Explore Tracks Audit Reconciliation
-- UPSERT desired venues + DELETE unwanted, preserves editorial_blurbs
-- ============================================================================

BEGIN;

-- ============================================================================
-- Track 1: Welcome to Atlanta (20 venues)
-- ============================================================================
INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured) VALUES
  ((SELECT id FROM explore_tracks WHERE slug = 'welcome-to-atlanta'), 29, 1, true),   -- Georgia Aquarium
  ((SELECT id FROM explore_tracks WHERE slug = 'welcome-to-atlanta'), 147, 2, false),  -- Centennial Olympic Park
  ((SELECT id FROM explore_tracks WHERE slug = 'welcome-to-atlanta'), 209, 3, false),  -- World of Coca-Cola
  ((SELECT id FROM explore_tracks WHERE slug = 'welcome-to-atlanta'), 416, 4, false),  -- Zoo Atlanta
  ((SELECT id FROM explore_tracks WHERE slug = 'welcome-to-atlanta'), 119, 5, false),  -- Fox Theatre
  ((SELECT id FROM explore_tracks WHERE slug = 'welcome-to-atlanta'), 372, 6, false),  -- Ponce City Market
  ((SELECT id FROM explore_tracks WHERE slug = 'welcome-to-atlanta'), 100, 7, false),  -- Atlanta Botanical Garden
  ((SELECT id FROM explore_tracks WHERE slug = 'welcome-to-atlanta'), 305, 8, false),  -- Piedmont Park
  ((SELECT id FROM explore_tracks WHERE slug = 'welcome-to-atlanta'), 214, 9, false),  -- College Football Hall of Fame
  ((SELECT id FROM explore_tracks WHERE slug = 'welcome-to-atlanta'), 196, 10, false), -- Center for Puppetry Arts
  ((SELECT id FROM explore_tracks WHERE slug = 'welcome-to-atlanta'), 557, 11, false), -- National Center for Civil and Human Rights
  ((SELECT id FROM explore_tracks WHERE slug = 'welcome-to-atlanta'), 221, 12, false), -- MLK NHP
  ((SELECT id FROM explore_tracks WHERE slug = 'welcome-to-atlanta'), 95, 13, false),  -- High Museum of Art
  ((SELECT id FROM explore_tracks WHERE slug = 'welcome-to-atlanta'), 108, 14, false), -- Mercedes-Benz Stadium
  ((SELECT id FROM explore_tracks WHERE slug = 'welcome-to-atlanta'), 170, 15, false), -- The BeltLine
  ((SELECT id FROM explore_tracks WHERE slug = 'welcome-to-atlanta'), 895, 16, false), -- Oakland Cemetery
  ((SELECT id FROM explore_tracks WHERE slug = 'welcome-to-atlanta'), 220, 17, false), -- Jimmy Carter Presidential Library
  ((SELECT id FROM explore_tracks WHERE slug = 'welcome-to-atlanta'), 211, 18, false), -- Atlanta History Center
  ((SELECT id FROM explore_tracks WHERE slug = 'welcome-to-atlanta'), 212, 19, false), -- Fernbank Museum
  ((SELECT id FROM explore_tracks WHERE slug = 'welcome-to-atlanta'), 3185, 20, false) -- The Varsity
ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, is_featured = EXCLUDED.is_featured;

DELETE FROM explore_track_venues WHERE track_id = (SELECT id FROM explore_tracks WHERE slug = 'welcome-to-atlanta')
  AND venue_id NOT IN (29,147,209,416,119,372,100,305,214,196,557,221,95,108,170,895,220,211,212,3185);

-- ============================================================================
-- Track 2: Good Trouble (17 venues)
-- ============================================================================
INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured) VALUES
  ((SELECT id FROM explore_tracks WHERE slug = 'good-trouble'), 557, 1, true),   -- National Center for Civil and Human Rights
  ((SELECT id FROM explore_tracks WHERE slug = 'good-trouble'), 221, 2, true),   -- MLK NHP
  ((SELECT id FROM explore_tracks WHERE slug = 'good-trouble'), 985, 3, false),  -- Ebenezer Baptist Church
  ((SELECT id FROM explore_tracks WHERE slug = 'good-trouble'), 352, 4, false),  -- Sweet Auburn Curb Market
  ((SELECT id FROM explore_tracks WHERE slug = 'good-trouble'), 211, 5, false),  -- Atlanta History Center
  ((SELECT id FROM explore_tracks WHERE slug = 'good-trouble'), 216, 6, false),  -- APEX Museum
  ((SELECT id FROM explore_tracks WHERE slug = 'good-trouble'), 895, 7, false),  -- Oakland Cemetery
  ((SELECT id FROM explore_tracks WHERE slug = 'good-trouble'), 218, 8, false),  -- Hammonds House Museum
  ((SELECT id FROM explore_tracks WHERE slug = 'good-trouble'), 4490, 9, false), -- Herndon Home Museum
  ((SELECT id FROM explore_tracks WHERE slug = 'good-trouble'), 3207, 10, false),-- Paschal's
  ((SELECT id FROM explore_tracks WHERE slug = 'good-trouble'), 986, 11, false), -- The King Center
  ((SELECT id FROM explore_tracks WHERE slug = 'good-trouble'), 632, 12, false), -- Morehouse College
  ((SELECT id FROM explore_tracks WHERE slug = 'good-trouble'), 220, 13, false), -- Jimmy Carter
  ((SELECT id FROM explore_tracks WHERE slug = 'good-trouble'), 4461, 14, false),-- Big Bethel AME Church
  ((SELECT id FROM explore_tracks WHERE slug = 'good-trouble'), 47, 15, false),  -- Auburn Avenue Research Library
  ((SELECT id FROM explore_tracks WHERE slug = 'good-trouble'), 1970, 16, false),-- Friendship Baptist Church
  ((SELECT id FROM explore_tracks WHERE slug = 'good-trouble'), 675, 17, false)  -- Busy Bee Cafe
ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, is_featured = EXCLUDED.is_featured;

DELETE FROM explore_track_venues WHERE track_id = (SELECT id FROM explore_tracks WHERE slug = 'good-trouble')
  AND venue_id NOT IN (557,221,985,352,211,216,895,218,4490,3207,986,632,220,4461,47,1970,675);

-- ============================================================================
-- Track 3: The South Got Something to Say (19 venues)
-- Keep existing + add new + remove cut
-- ============================================================================
-- Remove explicitly cut venues
DELETE FROM explore_track_venues WHERE track_id = (SELECT id FROM explore_tracks WHERE slug = 'the-south-got-something-to-say')
  AND venue_id IN (119, 537); -- Fox Theatre, Lenox Square

-- UPSERT kept + new venues
INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured) VALUES
  ((SELECT id FROM explore_tracks WHERE slug = 'the-south-got-something-to-say'), 4073, 1, true),  -- Trap Music Museum (lead)
  ((SELECT id FROM explore_tracks WHERE slug = 'the-south-got-something-to-say'), 826, 2, true),   -- Magic City
  ((SELECT id FROM explore_tracks WHERE slug = 'the-south-got-something-to-say'), 211, 3, false),  -- Atlanta History Center (Outkast exhibit)
  ((SELECT id FROM explore_tracks WHERE slug = 'the-south-got-something-to-say'), 825, 4, false),  -- Clermont Lounge
  ((SELECT id FROM explore_tracks WHERE slug = 'the-south-got-something-to-say'), 46, 5, false),   -- The Eastern
  ((SELECT id FROM explore_tracks WHERE slug = 'the-south-got-something-to-say'), 429, 6, false),  -- Compound Atlanta
  ((SELECT id FROM explore_tracks WHERE slug = 'the-south-got-something-to-say'), 4391, 7, false), -- The Royal Peacock
  ((SELECT id FROM explore_tracks WHERE slug = 'the-south-got-something-to-say'), 4392, 8, false), -- Killer Mike's SWAG Shop
  ((SELECT id FROM explore_tracks WHERE slug = 'the-south-got-something-to-say'), 4393, 9, false), -- Escobar
  ((SELECT id FROM explore_tracks WHERE slug = 'the-south-got-something-to-say'), 4394, 10, false),-- Crates ATL
  ((SELECT id FROM explore_tracks WHERE slug = 'the-south-got-something-to-say'), 4395, 11, false),-- Tree Sound Studios
  -- Kept from original (other kept venues fill remaining)
  ((SELECT id FROM explore_tracks WHERE slug = 'the-south-got-something-to-say'), 337, 12, false), -- Criminal Records
  ((SELECT id FROM explore_tracks WHERE slug = 'the-south-got-something-to-say'), 57, 13, false),  -- Apache Cafe
  ((SELECT id FROM explore_tracks WHERE slug = 'the-south-got-something-to-say'), 588, 14, false), -- Wax n Facts
  ((SELECT id FROM explore_tracks WHERE slug = 'the-south-got-something-to-say'), 1378, 15, false),-- JB's Record Lounge
  ((SELECT id FROM explore_tracks WHERE slug = 'the-south-got-something-to-say'), 323, 16, false), -- Northside Tavern
  ((SELECT id FROM explore_tracks WHERE slug = 'the-south-got-something-to-say'), 115, 17, false), -- Aisle 5
  ((SELECT id FROM explore_tracks WHERE slug = 'the-south-got-something-to-say'), 3207, 18, false),-- Paschal's
  ((SELECT id FROM explore_tracks WHERE slug = 'the-south-got-something-to-say'), 104, 19, false)  -- The Masquerade
ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, is_featured = EXCLUDED.is_featured;

DELETE FROM explore_track_venues WHERE track_id = (SELECT id FROM explore_tracks WHERE slug = 'the-south-got-something-to-say')
  AND venue_id NOT IN (4073,826,211,825,46,429,4391,4392,4393,4394,4395,337,57,588,1378,323,115,3207,104);

-- ============================================================================
-- Track 4: Keep Moving Forward / BeltLine (15 venues)
-- ============================================================================
INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured) VALUES
  ((SELECT id FROM explore_tracks WHERE slug = 'keep-moving-forward'), 372, 1, true),   -- Ponce City Market
  ((SELECT id FROM explore_tracks WHERE slug = 'keep-moving-forward'), 421, 2, false),  -- Krog Street Market
  ((SELECT id FROM explore_tracks WHERE slug = 'keep-moving-forward'), 308, 3, false),  -- Historic Fourth Ward Park
  ((SELECT id FROM explore_tracks WHERE slug = 'keep-moving-forward'), 925, 4, false),  -- New Realm Brewing
  ((SELECT id FROM explore_tracks WHERE slug = 'keep-moving-forward'), 4491, 5, false), -- Paris on Ponce
  ((SELECT id FROM explore_tracks WHERE slug = 'keep-moving-forward'), 4471, 6, false), -- Skyline Park
  ((SELECT id FROM explore_tracks WHERE slug = 'keep-moving-forward'), 4038, 7, false), -- BeltLine Eastside Trail
  ((SELECT id FROM explore_tracks WHERE slug = 'keep-moving-forward'), 4472, 8, false), -- Lee + White
  ((SELECT id FROM explore_tracks WHERE slug = 'keep-moving-forward'), 732, 9, false),  -- Monday Night Garage
  ((SELECT id FROM explore_tracks WHERE slug = 'keep-moving-forward'), 4473, 10, false),-- Westside Provisions
  ((SELECT id FROM explore_tracks WHERE slug = 'keep-moving-forward'), 170, 11, false), -- Atlanta BeltLine (West End)
  ((SELECT id FROM explore_tracks WHERE slug = 'keep-moving-forward'), 1356, 12, false),-- Pittsburgh Yards
  ((SELECT id FROM explore_tracks WHERE slug = 'keep-moving-forward'), 4462, 13, false),-- Boulevard Crossing Park
  ((SELECT id FROM explore_tracks WHERE slug = 'keep-moving-forward'), 4094, 14, false),-- Westside Reservoir Park (Bellwood Quarry)
  ((SELECT id FROM explore_tracks WHERE slug = 'keep-moving-forward'), 4463, 15, false) -- Atlanta BeltLine Center
ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, is_featured = EXCLUDED.is_featured;

DELETE FROM explore_track_venues WHERE track_id = (SELECT id FROM explore_tracks WHERE slug = 'keep-moving-forward')
  AND venue_id NOT IN (372,421,308,925,4491,4471,4038,4472,732,4473,170,1356,4462,4094,4463);

-- ============================================================================
-- Track 5: What'll Ya Have? (~22 venues)
-- Keep existing + add new + remove cut
-- ============================================================================
-- Remove explicitly cut venues (DAS BBQ, Food Truck Park, Stackhouse - find and remove if present)
DELETE FROM explore_track_venues WHERE track_id = (SELECT id FROM explore_tracks WHERE slug = 'the-itis')
  AND venue_id IN (SELECT id FROM venues WHERE name ILIKE '%DAS BBQ%' OR name ILIKE '%Food Truck Park%' OR name ILIKE '%Stackhouse%');

-- UPSERT all audit venues
INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured) VALUES
  ((SELECT id FROM explore_tracks WHERE slug = 'the-itis'), 3185, 1, true),   -- The Varsity
  ((SELECT id FROM explore_tracks WHERE slug = 'the-itis'), 675, 2, true),    -- Busy Bee Cafe
  ((SELECT id FROM explore_tracks WHERE slug = 'the-itis'), 1203, 3, true),   -- Mary Mac's Tea Room
  ((SELECT id FROM explore_tracks WHERE slug = 'the-itis'), 3207, 4, false),  -- Paschal's
  ((SELECT id FROM explore_tracks WHERE slug = 'the-itis'), 4389, 5, false),  -- JR Crickets
  ((SELECT id FROM explore_tracks WHERE slug = 'the-itis'), 826, 6, false),   -- Magic City (for the wings)
  ((SELECT id FROM explore_tracks WHERE slug = 'the-itis'), 1019, 7, false),  -- Soul Vegetarian
  ((SELECT id FROM explore_tracks WHERE slug = 'the-itis'), 663, 8, false),   -- Sweet Auburn BBQ
  ((SELECT id FROM explore_tracks WHERE slug = 'the-itis'), 4390, 9, false),  -- K&K Soul Food
  ((SELECT id FROM explore_tracks WHERE slug = 'the-itis'), 689, 10, false),  -- Twisted Soul
  ((SELECT id FROM explore_tracks WHERE slug = 'the-itis'), 2502, 11, false), -- Old Lady Gang
  ((SELECT id FROM explore_tracks WHERE slug = 'the-itis'), 1204, 12, false), -- Colonnade Restaurant
  ((SELECT id FROM explore_tracks WHERE slug = 'the-itis'), 1205, 13, true),  -- Buford Highway Farmers Market
  ((SELECT id FROM explore_tracks WHERE slug = 'the-itis'), 352, 14, false),  -- Sweet Auburn Curb Market
  ((SELECT id FROM explore_tracks WHERE slug = 'the-itis'), 690, 15, false),  -- Bacchanalia
  ((SELECT id FROM explore_tracks WHERE slug = 'the-itis'), 1730, 16, false), -- The Works Atlanta
  ((SELECT id FROM explore_tracks WHERE slug = 'the-itis'), 1728, 17, false), -- Politan Row
  -- Keep additional existing
  ((SELECT id FROM explore_tracks WHERE slug = 'the-itis'), 685, 18, false),  -- Miller Union
  ((SELECT id FROM explore_tracks WHERE slug = 'the-itis'), 674, 19, false),  -- Staplehouse
  ((SELECT id FROM explore_tracks WHERE slug = 'the-itis'), 671, 20, false),  -- Gunshow
  ((SELECT id FROM explore_tracks WHERE slug = 'the-itis'), 676, 21, false),  -- BoccaLupo
  ((SELECT id FROM explore_tracks WHERE slug = 'the-itis'), 1173, 22, false)  -- Home Grown
ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, is_featured = EXCLUDED.is_featured;

DELETE FROM explore_track_venues WHERE track_id = (SELECT id FROM explore_tracks WHERE slug = 'the-itis')
  AND venue_id NOT IN (3185,675,1203,3207,4389,826,1019,663,4390,689,2502,1204,1205,352,690,1730,1728,685,674,671,676,1173);

-- ============================================================================
-- Track 6: City in a Forest (14 venues)
-- Move Doll's Head Trail / Constitution Lakes to #1, keep rest
-- ============================================================================
INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured) VALUES
  ((SELECT id FROM explore_tracks WHERE slug = 'city-in-a-forest'), 315, 1, true),   -- Constitution Lakes / Doll's Head Trail (#1!)
  ((SELECT id FROM explore_tracks WHERE slug = 'city-in-a-forest'), 305, 2, true),   -- Piedmont Park
  ((SELECT id FROM explore_tracks WHERE slug = 'city-in-a-forest'), 100, 3, true),   -- Atlanta Botanical Garden
  ((SELECT id FROM explore_tracks WHERE slug = 'city-in-a-forest'), 307, 4, false),  -- Westside Park
  ((SELECT id FROM explore_tracks WHERE slug = 'city-in-a-forest'), 312, 5, false),  -- Sweetwater Creek
  ((SELECT id FROM explore_tracks WHERE slug = 'city-in-a-forest'), 1747, 6, false), -- Chattahoochee River NRA
  ((SELECT id FROM explore_tracks WHERE slug = 'city-in-a-forest'), 992, 7, false),  -- Stone Mountain Park
  ((SELECT id FROM explore_tracks WHERE slug = 'city-in-a-forest'), 306, 8, false),  -- Grant Park
  ((SELECT id FROM explore_tracks WHERE slug = 'city-in-a-forest'), 310, 9, false),  -- Chastain Park
  ((SELECT id FROM explore_tracks WHERE slug = 'city-in-a-forest'), 313, 10, false), -- Arabia Mountain
  ((SELECT id FROM explore_tracks WHERE slug = 'city-in-a-forest'), 314, 11, false), -- Cascade Springs
  ((SELECT id FROM explore_tracks WHERE slug = 'city-in-a-forest'), 4474, 12, false),-- East Palisades
  ((SELECT id FROM explore_tracks WHERE slug = 'city-in-a-forest'), 3983, 13, false),-- Morningside Nature Preserve
  ((SELECT id FROM explore_tracks WHERE slug = 'city-in-a-forest'), 3787, 14, false) -- Lullwater Preserve
ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, is_featured = EXCLUDED.is_featured;

DELETE FROM explore_track_venues WHERE track_id = (SELECT id FROM explore_tracks WHERE slug = 'city-in-a-forest')
  AND venue_id NOT IN (315,305,100,307,312,1747,992,306,310,313,314,4474,3983,3787);

-- ============================================================================
-- Track 7: Hard in Da Paint (18 venues)
-- ============================================================================
INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured) VALUES
  ((SELECT id FROM explore_tracks WHERE slug = 'hard-in-da-paint'), 4036, 1, true),  -- Krog Street Tunnel
  ((SELECT id FROM explore_tracks WHERE slug = 'hard-in-da-paint'), 4040, 2, true),  -- Cabbagetown Murals
  ((SELECT id FROM explore_tracks WHERE slug = 'hard-in-da-paint'), 2217, 3, false), -- Little Five Points
  ((SELECT id FROM explore_tracks WHERE slug = 'hard-in-da-paint'), 4073, 4, false), -- Trap Music Museum
  ((SELECT id FROM explore_tracks WHERE slug = 'hard-in-da-paint'), 1071, 5, false), -- The Supermarket ATL
  ((SELECT id FROM explore_tracks WHERE slug = 'hard-in-da-paint'), 4396, 6, false), -- Day & Night Projects
  ((SELECT id FROM explore_tracks WHERE slug = 'hard-in-da-paint'), 4397, 7, false), -- Echo Contemporary
  ((SELECT id FROM explore_tracks WHERE slug = 'hard-in-da-paint'), 1079, 8, false), -- One Contemporary Gallery
  ((SELECT id FROM explore_tracks WHERE slug = 'hard-in-da-paint'), 244, 9, false),  -- ZuCot Gallery
  ((SELECT id FROM explore_tracks WHERE slug = 'hard-in-da-paint'), 4043, 10, false),-- Castleberry Hill Art District
  ((SELECT id FROM explore_tracks WHERE slug = 'hard-in-da-paint'), 389, 11, false), -- Underground Atlanta (galleries)
  ((SELECT id FROM explore_tracks WHERE slug = 'hard-in-da-paint'), 4069, 12, false),-- Folk Art Park
  ((SELECT id FROM explore_tracks WHERE slug = 'hard-in-da-paint'), 1102, 13, false),-- MASS Collective
  -- Keep some original venues that fit
  ((SELECT id FROM explore_tracks WHERE slug = 'hard-in-da-paint'), 2076, 14, false),-- The Goat Farm
  ((SELECT id FROM explore_tracks WHERE slug = 'hard-in-da-paint'), 233, 15, false), -- Atlanta Contemporary
  ((SELECT id FROM explore_tracks WHERE slug = 'hard-in-da-paint'), 931, 16, false), -- Pullman Yards
  ((SELECT id FROM explore_tracks WHERE slug = 'hard-in-da-paint'), 1092, 17, false),-- Eyedrum
  ((SELECT id FROM explore_tracks WHERE slug = 'hard-in-da-paint'), 234, 18, false)  -- Whitespace Gallery
ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, is_featured = EXCLUDED.is_featured;

DELETE FROM explore_track_venues WHERE track_id = (SELECT id FROM explore_tracks WHERE slug = 'hard-in-da-paint')
  AND venue_id NOT IN (4036,4040,2217,4073,1071,4396,4397,1079,244,4043,389,4069,1102,2076,233,931,1092,234);

-- ============================================================================
-- Track 8: A Beautiful Mosaic (18 venues)
-- ============================================================================
INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured) VALUES
  ((SELECT id FROM explore_tracks WHERE slug = 'a-beautiful-mosaic'), 1205, 1, true),  -- Buford Highway Farmers Market
  ((SELECT id FROM explore_tracks WHERE slug = 'a-beautiful-mosaic'), 4497, 2, false), -- Your DeKalb Farmers Market
  ((SELECT id FROM explore_tracks WHERE slug = 'a-beautiful-mosaic'), 2623, 3, true),  -- Plaza Fiesta
  ((SELECT id FROM explore_tracks WHERE slug = 'a-beautiful-mosaic'), 4495, 4, false), -- Super H Mart
  ((SELECT id FROM explore_tracks WHERE slug = 'a-beautiful-mosaic'), 4496, 5, false), -- Atlanta Chinatown Mall
  ((SELECT id FROM explore_tracks WHERE slug = 'a-beautiful-mosaic'), 4398, 6, false), -- Global Mall
  ((SELECT id FROM explore_tracks WHERE slug = 'a-beautiful-mosaic'), 4035, 7, false), -- Jeju Sauna
  ((SELECT id FROM explore_tracks WHERE slug = 'a-beautiful-mosaic'), 4402, 8, false), -- Treat Your Feet Doraville
  ((SELECT id FROM explore_tracks WHERE slug = 'a-beautiful-mosaic'), 2588, 9, false), -- BAPS Mandir
  ((SELECT id FROM explore_tracks WHERE slug = 'a-beautiful-mosaic'), 2558, 10, false),-- Drepung Loseling Monastery
  ((SELECT id FROM explore_tracks WHERE slug = 'a-beautiful-mosaic'), 4407, 11, false),-- Al-Farooq Masjid
  ((SELECT id FROM explore_tracks WHERE slug = 'a-beautiful-mosaic'), 4401, 12, false),-- Two Fish Myanmar
  ((SELECT id FROM explore_tracks WHERE slug = 'a-beautiful-mosaic'), 4404, 13, false),-- KuKu Ethiopian Coffee
  ((SELECT id FROM explore_tracks WHERE slug = 'a-beautiful-mosaic'), 4403, 14, false),-- Hanshin Pocha
  ((SELECT id FROM explore_tracks WHERE slug = 'a-beautiful-mosaic'), 4400, 15, false),-- Kinokuniya Bookstore
  ((SELECT id FROM explore_tracks WHERE slug = 'a-beautiful-mosaic'), 4399, 16, false),-- Teso Life
  ((SELECT id FROM explore_tracks WHERE slug = 'a-beautiful-mosaic'), 4405, 17, false),-- Panaderia Del Valle
  ((SELECT id FROM explore_tracks WHERE slug = 'a-beautiful-mosaic'), 4406, 18, false) -- Refuge Coffee Co.
ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, is_featured = EXCLUDED.is_featured;

DELETE FROM explore_track_venues WHERE track_id = (SELECT id FROM explore_tracks WHERE slug = 'a-beautiful-mosaic')
  AND venue_id NOT IN (1205,2623,4398,4035,4402,2588,2558,4407,4401,4404,4403,4400,4399,4405,4406,
    4497, 4495, 4496);

-- ============================================================================
-- Track 9: Too Busy for Haters / LGBTQ+ (15 venues)
-- ============================================================================
INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured) VALUES
  ((SELECT id FROM explore_tracks WHERE slug = 'too-busy-to-hate'), 305, 1, true),   -- Piedmont Park
  ((SELECT id FROM explore_tracks WHERE slug = 'too-busy-to-hate'), 4408, 2, true),  -- Rainbow Crosswalks
  ((SELECT id FROM explore_tracks WHERE slug = 'too-busy-to-hate'), 570, 3, false),  -- My Sister's Room
  ((SELECT id FROM explore_tracks WHERE slug = 'too-busy-to-hate'), 422, 4, false),  -- Blake's on the Park
  ((SELECT id FROM explore_tracks WHERE slug = 'too-busy-to-hate'), 574, 5, false),  -- Bulldogs
  ((SELECT id FROM explore_tracks WHERE slug = 'too-busy-to-hate'), 571, 6, false),  -- Mary's (EAV)
  ((SELECT id FROM explore_tracks WHERE slug = 'too-busy-to-hate'), 569, 7, false),  -- The Heretic
  ((SELECT id FROM explore_tracks WHERE slug = 'too-busy-to-hate'), 572, 8, false),  -- Atlanta Eagle
  ((SELECT id FROM explore_tracks WHERE slug = 'too-busy-to-hate'), 430, 9, false),  -- Lore Atlanta
  ((SELECT id FROM explore_tracks WHERE slug = 'too-busy-to-hate'), 573, 10, false), -- Future Atlanta
  ((SELECT id FROM explore_tracks WHERE slug = 'too-busy-to-hate'), 272, 11, false), -- Charis Books & More
  ((SELECT id FROM explore_tracks WHERE slug = 'too-busy-to-hate'), 1228, 12, false),-- Out Front Theatre
  ((SELECT id FROM explore_tracks WHERE slug = 'too-busy-to-hate'), 4484, 13, false),-- Philip Rush Center
  ((SELECT id FROM explore_tracks WHERE slug = 'too-busy-to-hate'), 901, 14, false), -- Sister Louisa's Church
  ((SELECT id FROM explore_tracks WHERE slug = 'too-busy-to-hate'), 441, 15, false)  -- Friends on Ponce
ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, is_featured = EXCLUDED.is_featured;

DELETE FROM explore_track_venues WHERE track_id = (SELECT id FROM explore_tracks WHERE slug = 'too-busy-to-hate')
  AND venue_id NOT IN (305,4408,570,422,574,569,572,430,573,272,1228,4484,901,441,
    571);

-- ============================================================================
-- Track 10: Roll for Initiative / Gaming & Nerd (14 venues)
-- ============================================================================
INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured) VALUES
  ((SELECT id FROM explore_tracks WHERE slug = 'the-midnight-train'), 257, 1, true),  -- Joystick Gamebar
  ((SELECT id FROM explore_tracks WHERE slug = 'the-midnight-train'), 256, 2, false), -- Battle & Brew
  ((SELECT id FROM explore_tracks WHERE slug = 'the-midnight-train'), 2360, 3, false),-- My Parents' Basement
  ((SELECT id FROM explore_tracks WHERE slug = 'the-midnight-train'), 4409, 4, false),-- The Wasteland Gaming
  ((SELECT id FROM explore_tracks WHERE slug = 'the-midnight-train'), 4485, 5, false),-- Giga-Bites Cafe
  ((SELECT id FROM explore_tracks WHERE slug = 'the-midnight-train'), 4410, 6, false),-- Portal Pinball Arcade
  ((SELECT id FROM explore_tracks WHERE slug = 'the-midnight-train'), 2534, 7, false),-- Savage Pizza
  ((SELECT id FROM explore_tracks WHERE slug = 'the-midnight-train'), 4165, 8, false),-- Charlie's Collectible Show
  ((SELECT id FROM explore_tracks WHERE slug = 'the-midnight-train'), 4411, 9, false),-- Contender eSports
  ((SELECT id FROM explore_tracks WHERE slug = 'the-midnight-train'), 1712, 10, false),-- The Escape Game Atlanta
  ((SELECT id FROM explore_tracks WHERE slug = 'the-midnight-train'), 2361, 11, false),-- Oxford Comics & Games
  ((SELECT id FROM explore_tracks WHERE slug = 'the-midnight-train'), 196, 12, false),-- Center for Puppetry Arts
  ((SELECT id FROM explore_tracks WHERE slug = 'the-midnight-train'), 960, 13, false),-- Freeside Atlanta
  ((SELECT id FROM explore_tracks WHERE slug = 'the-midnight-train'), 1229, 14, false) -- Schoolhouse Brewing
ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, is_featured = EXCLUDED.is_featured;

DELETE FROM explore_track_venues WHERE track_id = (SELECT id FROM explore_tracks WHERE slug = 'the-midnight-train')
  AND venue_id NOT IN (257,256,2360,4409,4485,4410,2534,4165,4411,1712,2361,196,960,1229);

-- ============================================================================
-- Track 11: Keep Swinging / Sports (16 venues)
-- ============================================================================
INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured) VALUES
  ((SELECT id FROM explore_tracks WHERE slug = 'keep-swinging'), 108, 1, true),   -- Mercedes-Benz Stadium
  ((SELECT id FROM explore_tracks WHERE slug = 'keep-swinging'), 126, 2, true),   -- State Farm Arena
  ((SELECT id FROM explore_tracks WHERE slug = 'keep-swinging'), 103, 3, true),   -- Truist Park
  ((SELECT id FROM explore_tracks WHERE slug = 'keep-swinging'), 624, 4, false),  -- Bobby Dodd Stadium
  ((SELECT id FROM explore_tracks WHERE slug = 'keep-swinging'), 214, 5, false),  -- College Football Hall of Fame
  ((SELECT id FROM explore_tracks WHERE slug = 'keep-swinging'), 2271, 6, false), -- East Lake Golf Club
  ((SELECT id FROM explore_tracks WHERE slug = 'keep-swinging'), 4414, 7, false), -- Hank Aaron Memorial
  ((SELECT id FROM explore_tracks WHERE slug = 'keep-swinging'), 562, 8, false),  -- Atlanta Motor Speedway
  ((SELECT id FROM explore_tracks WHERE slug = 'keep-swinging'), 590, 9, false),  -- Brewhouse Cafe
  ((SELECT id FROM explore_tracks WHERE slug = 'keep-swinging'), 640, 10, false), -- Park Tavern
  ((SELECT id FROM explore_tracks WHERE slug = 'keep-swinging'), 715, 11, false), -- The Beverly
  ((SELECT id FROM explore_tracks WHERE slug = 'keep-swinging'), 4412, 12, false),-- Black Bear Tavern
  ((SELECT id FROM explore_tracks WHERE slug = 'keep-swinging'), 4413, 13, false),-- Fellaship
  ((SELECT id FROM explore_tracks WHERE slug = 'keep-swinging'), 4240, 14, false),-- Five Iron Golf
  ((SELECT id FROM explore_tracks WHERE slug = 'keep-swinging'), 1147, 15, false),-- Midway Pub
  ((SELECT id FROM explore_tracks WHERE slug = 'keep-swinging'), 654, 16, false)  -- STATS Brewpub
ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, is_featured = EXCLUDED.is_featured;

DELETE FROM explore_track_venues WHERE track_id = (SELECT id FROM explore_tracks WHERE slug = 'keep-swinging')
  AND venue_id NOT IN (108,126,103,624,214,2271,4414,562,590,640,715,4412,4413,4240,1147,654);

-- ============================================================================
-- Track 12: Life's Like a Movie / Family & Kids (18 venues)
-- ============================================================================
INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured) VALUES
  ((SELECT id FROM explore_tracks WHERE slug = 'lifes-like-a-movie'), 196, 1, true),  -- Center for Puppetry Arts
  ((SELECT id FROM explore_tracks WHERE slug = 'lifes-like-a-movie'), 29, 2, true),   -- Georgia Aquarium
  ((SELECT id FROM explore_tracks WHERE slug = 'lifes-like-a-movie'), 416, 3, false),  -- Zoo Atlanta
  ((SELECT id FROM explore_tracks WHERE slug = 'lifes-like-a-movie'), 212, 4, false),  -- Fernbank Museum
  ((SELECT id FROM explore_tracks WHERE slug = 'lifes-like-a-movie'), 225, 5, false),  -- Fernbank Science Center
  ((SELECT id FROM explore_tracks WHERE slug = 'lifes-like-a-movie'), 215, 6, false),  -- Children's Museum of Atlanta
  ((SELECT id FROM explore_tracks WHERE slug = 'lifes-like-a-movie'), 1268, 7, false), -- LEGO Discovery Center
  ((SELECT id FROM explore_tracks WHERE slug = 'lifes-like-a-movie'), 209, 8, false),  -- World of Coca-Cola
  ((SELECT id FROM explore_tracks WHERE slug = 'lifes-like-a-movie'), 214, 9, false),  -- College Football Hall of Fame
  ((SELECT id FROM explore_tracks WHERE slug = 'lifes-like-a-movie'), 147, 10, false), -- Centennial Olympic Park
  ((SELECT id FROM explore_tracks WHERE slug = 'lifes-like-a-movie'), 305, 11, false), -- Piedmont Park
  ((SELECT id FROM explore_tracks WHERE slug = 'lifes-like-a-movie'), 308, 12, false), -- Historic Fourth Ward Park
  ((SELECT id FROM explore_tracks WHERE slug = 'lifes-like-a-movie'), 100, 13, false), -- Atlanta Botanical Garden
  ((SELECT id FROM explore_tracks WHERE slug = 'lifes-like-a-movie'), 4471, 14, false),-- Skyline Park
  ((SELECT id FROM explore_tracks WHERE slug = 'lifes-like-a-movie'), 372, 15, false), -- Ponce City Market
  ((SELECT id FROM explore_tracks WHERE slug = 'lifes-like-a-movie'), 587, 16, false), -- Netherworld Haunted House
  ((SELECT id FROM explore_tracks WHERE slug = 'lifes-like-a-movie'), 4478, 17, false),-- SK8 the Roof
  ((SELECT id FROM explore_tracks WHERE slug = 'lifes-like-a-movie'), 992, 18, false)  -- Stone Mountain Park
ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, is_featured = EXCLUDED.is_featured;

DELETE FROM explore_track_venues WHERE track_id = (SELECT id FROM explore_tracks WHERE slug = 'lifes-like-a-movie')
  AND venue_id NOT IN (196,29,416,212,225,215,1268,209,214,147,305,308,100,4471,372,587,4478,992);

-- ============================================================================
-- Track 13: Say Less / Speakeasy & Hidden Bars (18 venues)
-- ============================================================================
INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured) VALUES
  ((SELECT id FROM explore_tracks WHERE slug = 'say-less'), 1148, 1, true),  -- Trader Vic's
  ((SELECT id FROM explore_tracks WHERE slug = 'say-less'), 2450, 2, true),  -- Tiger Sun
  ((SELECT id FROM explore_tracks WHERE slug = 'say-less'), 1196, 3, false), -- Red Phone Booth
  ((SELECT id FROM explore_tracks WHERE slug = 'say-less'), 4415, 4, false), -- The James Room
  ((SELECT id FROM explore_tracks WHERE slug = 'say-less'), 1198, 5, false), -- Himitsu
  ((SELECT id FROM explore_tracks WHERE slug = 'say-less'), 914, 6, false),  -- SOS Tiki Bar
  ((SELECT id FROM explore_tracks WHERE slug = 'say-less'), 4416, 7, false), -- Eleanor's
  ((SELECT id FROM explore_tracks WHERE slug = 'say-less'), 4417, 8, false), -- Edgar's Proof & Provision
  ((SELECT id FROM explore_tracks WHERE slug = 'say-less'), 4418, 9, false), -- The Subway Speakeasy
  ((SELECT id FROM explore_tracks WHERE slug = 'say-less'), 4487, 10, false),-- The Bureau
  ((SELECT id FROM explore_tracks WHERE slug = 'say-less'), 2488, 11, false),-- 12 Cocktail Bar
  ((SELECT id FROM explore_tracks WHERE slug = 'say-less'), 45, 12, false),  -- JoJo's Beloved
  ((SELECT id FROM explore_tracks WHERE slug = 'say-less'), 2446, 13, false),-- Moonlight at FORTH
  ((SELECT id FROM explore_tracks WHERE slug = 'say-less'), 4486, 14, false),-- Ranger Station
  ((SELECT id FROM explore_tracks WHERE slug = 'say-less'), 679, 15, false), -- Kimball House
  ((SELECT id FROM explore_tracks WHERE slug = 'say-less'), 677, 16, false), -- Ticonderoga Club
  ((SELECT id FROM explore_tracks WHERE slug = 'say-less'), 4419, 17, false),-- The Waiting Room
  ((SELECT id FROM explore_tracks WHERE slug = 'say-less'), 4420, 18, false) -- La Cueva
ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, is_featured = EXCLUDED.is_featured;

DELETE FROM explore_track_venues WHERE track_id = (SELECT id FROM explore_tracks WHERE slug = 'say-less')
  AND venue_id NOT IN (1148,2450,1196,4415,1198,914,4416,4417,4418,4487,2488,45,2446,4486,679,677,4419,4420);

-- ============================================================================
-- Track 14: Y'allywood / Cinema (6 venues)
-- ============================================================================
INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured) VALUES
  ((SELECT id FROM explore_tracks WHERE slug = 'yallywood'), 119, 1, true),  -- Fox Theatre
  ((SELECT id FROM explore_tracks WHERE slug = 'yallywood'), 197, 2, true),  -- Plaza Theatre
  ((SELECT id FROM explore_tracks WHERE slug = 'yallywood'), 1708, 3, false),-- Starlight Drive-In
  ((SELECT id FROM explore_tracks WHERE slug = 'yallywood'), 198, 4, false), -- Tara Theatre
  ((SELECT id FROM explore_tracks WHERE slug = 'yallywood'), 199, 5, false), -- Landmark Midtown Art Cinema
  ((SELECT id FROM explore_tracks WHERE slug = 'yallywood'), 110, 6, false)  -- Trilith LIVE
ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, is_featured = EXCLUDED.is_featured;

DELETE FROM explore_track_venues WHERE track_id = (SELECT id FROM explore_tracks WHERE slug = 'yallywood')
  AND venue_id NOT IN (119,197,1708,198,199,110);

-- ============================================================================
-- Track 15: SpelHouse Spirit (18 venues)
-- ============================================================================
INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured) VALUES
  ((SELECT id FROM explore_tracks WHERE slug = 'spelhouse-spirit'), 3207, 1, true),  -- Paschal's
  ((SELECT id FROM explore_tracks WHERE slug = 'spelhouse-spirit'), 715, 2, false),  -- The Beverly
  ((SELECT id FROM explore_tracks WHERE slug = 'spelhouse-spirit'), 632, 3, true),   -- Morehouse College
  ((SELECT id FROM explore_tracks WHERE slug = 'spelhouse-spirit'), 631, 4, true),   -- Spelman College
  ((SELECT id FROM explore_tracks WHERE slug = 'spelhouse-spirit'), 633, 5, false),  -- Clark Atlanta University
  ((SELECT id FROM explore_tracks WHERE slug = 'spelhouse-spirit'), 218, 6, true),   -- Hammonds House Museum
  ((SELECT id FROM explore_tracks WHERE slug = 'spelhouse-spirit'), 675, 7, false),  -- Busy Bee Cafe
  ((SELECT id FROM explore_tracks WHERE slug = 'spelhouse-spirit'), 4479, 8, false), -- Shrine of the Black Madonna
  ((SELECT id FROM explore_tracks WHERE slug = 'spelhouse-spirit'), 4480, 9, false), -- Ray Charles Performing Arts Center
  ((SELECT id FROM explore_tracks WHERE slug = 'spelhouse-spirit'), 4481, 10, false),-- MLK International Chapel
  ((SELECT id FROM explore_tracks WHERE slug = 'spelhouse-spirit'), 852, 11, false), -- Spelman Museum of Fine Art
  ((SELECT id FROM explore_tracks WHERE slug = 'spelhouse-spirit'), 304, 12, false), -- Clark Atlanta University Art Museum
  ((SELECT id FROM explore_tracks WHERE slug = 'spelhouse-spirit'), 724, 13, false), -- Robert W. Woodruff Library AUC
  ((SELECT id FROM explore_tracks WHERE slug = 'spelhouse-spirit'), 4482, 14, false),-- Slim & Husky's
  ((SELECT id FROM explore_tracks WHERE slug = 'spelhouse-spirit'), 4483, 15, false),-- Be Coffee Tea Wine
  ((SELECT id FROM explore_tracks WHERE slug = 'spelhouse-spirit'), 4166, 16, false),-- Morris Brown College
  ((SELECT id FROM explore_tracks WHERE slug = 'spelhouse-spirit'), 4490, 17, false),-- Herndon Home Museum
  ((SELECT id FROM explore_tracks WHERE slug = 'spelhouse-spirit'), 223, 18, false)  -- Wren's Nest House Museum
ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, is_featured = EXCLUDED.is_featured;

DELETE FROM explore_track_venues WHERE track_id = (SELECT id FROM explore_tracks WHERE slug = 'spelhouse-spirit')
  AND venue_id NOT IN (3207,715,632,631,633,218,675,4479,4480,4481,852,304,724,4482,4483,4166,4490,223);

COMMIT;
