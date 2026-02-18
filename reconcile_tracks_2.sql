-- ============================================================================
-- Explore Tracks Audit Reconciliation — Part 2 (Tracks 16-21)
-- ============================================================================

BEGIN;

-- ============================================================================
-- Track 16: Resurgens / Skyline (30 venues)
-- ============================================================================
INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured) VALUES
  -- Downtown Modern
  ((SELECT id FROM explore_tracks WHERE slug = 'resurgens'), 4044, 1, true),  -- Bank of America Plaza
  ((SELECT id FROM explore_tracks WHERE slug = 'resurgens'), 4421, 2, true),  -- Truist Plaza
  ((SELECT id FROM explore_tracks WHERE slug = 'resurgens'), 4048, 3, false), -- 191 Peachtree Tower
  ((SELECT id FROM explore_tracks WHERE slug = 'resurgens'), 786, 4, true),  -- Westin Peachtree Plaza
  ((SELECT id FROM explore_tracks WHERE slug = 'resurgens'), 4047, 5, false), -- Georgia-Pacific Tower
  ((SELECT id FROM explore_tracks WHERE slug = 'resurgens'), 187, 6, false),  -- Atlanta Marriott Marquis
  ((SELECT id FROM explore_tracks WHERE slug = 'resurgens'), 3259, 7, false), -- Signia by Hilton
  -- Downtown Historic
  ((SELECT id FROM explore_tracks WHERE slug = 'resurgens'), 785, 8, false),  -- Hyatt Regency Atlanta
  ((SELECT id FROM explore_tracks WHERE slug = 'resurgens'), 4422, 9, false), -- Flatiron Building Atlanta
  ((SELECT id FROM explore_tracks WHERE slug = 'resurgens'), 802, 10, false), -- Candler Hotel Atlanta
  ((SELECT id FROM explore_tracks WHERE slug = 'resurgens'), 75, 11, false),  -- The Vick at Healey
  -- Midtown Modern
  ((SELECT id FROM explore_tracks WHERE slug = 'resurgens'), 4046, 12, true), -- One Atlantic Center
  ((SELECT id FROM explore_tracks WHERE slug = 'resurgens'), 4423, 13, false),-- 1072 West Peachtree
  ((SELECT id FROM explore_tracks WHERE slug = 'resurgens'), 4424, 14, false),-- Promenade II
  ((SELECT id FROM explore_tracks WHERE slug = 'resurgens'), 4425, 15, false),-- Tower Square
  ((SELECT id FROM explore_tracks WHERE slug = 'resurgens'), 4426, 16, false),-- 1180 Peachtree / Batman Building
  ((SELECT id FROM explore_tracks WHERE slug = 'resurgens'), 788, 17, false), -- Four Seasons Hotel / GLG Grand
  ((SELECT id FROM explore_tracks WHERE slug = 'resurgens'), 4427, 18, false),-- The Atlantic
  ((SELECT id FROM explore_tracks WHERE slug = 'resurgens'), 4428, 19, false),-- 1100 Peachtree / Campanile
  -- Midtown Historic
  ((SELECT id FROM explore_tracks WHERE slug = 'resurgens'), 119, 20, false), -- Fox Theatre
  ((SELECT id FROM explore_tracks WHERE slug = 'resurgens'), 4049, 21, false),-- Rhodes Hall
  -- Buckhead
  ((SELECT id FROM explore_tracks WHERE slug = 'resurgens'), 4429, 22, false),-- 3344 Peachtree / Sovereign
  ((SELECT id FROM explore_tracks WHERE slug = 'resurgens'), 411, 23, false), -- Waldorf Astoria Buckhead
  ((SELECT id FROM explore_tracks WHERE slug = 'resurgens'), 4430, 24, false),-- Terminus 100
  ((SELECT id FROM explore_tracks WHERE slug = 'resurgens'), 4431, 25, false),-- The Paramount at Buckhead
  ((SELECT id FROM explore_tracks WHERE slug = 'resurgens'), 4432, 26, false),-- Ritz-Carlton Residences
  ((SELECT id FROM explore_tracks WHERE slug = 'resurgens'), 4433, 27, false),-- Buckhead Grand
  -- Perimeter
  ((SELECT id FROM explore_tracks WHERE slug = 'resurgens'), 4498, 28, false), -- The King (Concourse VI)
  ((SELECT id FROM explore_tracks WHERE slug = 'resurgens'), 4499, 29, false), -- The Queen (Concourse V)
  -- Historic
  ((SELECT id FROM explore_tracks WHERE slug = 'resurgens'), 535, 30, false)  -- Rialto Center for the Arts
ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, is_featured = EXCLUDED.is_featured;

DELETE FROM explore_track_venues WHERE track_id = (SELECT id FROM explore_tracks WHERE slug = 'resurgens')
  AND venue_id NOT IN (4044,4421,4048,187,4047,3259,785,4422,802,75,4046,4423,4424,4425,4426,788,4427,4428,119,4049,4429,411,4430,4431,4432,4433,535,
    786, 4498, 4499);

-- ============================================================================
-- Track 18: As Seen on TV / Filming Locations (20 venues) — NEW
-- ============================================================================
INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured) VALUES
  ((SELECT id FROM explore_tracks WHERE slug = 'as-seen-on-tv'), 4470, 1, true),  -- Trilith Studios
  ((SELECT id FROM explore_tracks WHERE slug = 'as-seen-on-tv'), 4440, 2, true),  -- Senoia Walking Dead Town
  ((SELECT id FROM explore_tracks WHERE slug = 'as-seen-on-tv'), 4441, 3, false), -- Jackson GA / Hawkins
  ((SELECT id FROM explore_tracks WHERE slug = 'as-seen-on-tv'), 4442, 4, false), -- Covington GA / Mystic Falls
  ((SELECT id FROM explore_tracks WHERE slug = 'as-seen-on-tv'), 4037, 5, false), -- Jackson Street Bridge
  ((SELECT id FROM explore_tracks WHERE slug = 'as-seen-on-tv'), 187, 6, false),  -- Atlanta Marriott Marquis (Loki)
  ((SELECT id FROM explore_tracks WHERE slug = 'as-seen-on-tv'), 4434, 7, false), -- Porsche Experience Center (Avengers HQ)
  ((SELECT id FROM explore_tracks WHERE slug = 'as-seen-on-tv'), 95, 8, false),   -- High Museum of Art (Black Panther)
  ((SELECT id FROM explore_tracks WHERE slug = 'as-seen-on-tv'), 4435, 9, false),  -- Swan House (Hunger Games)
  ((SELECT id FROM explore_tracks WHERE slug = 'as-seen-on-tv'), 931, 10, false),  -- Pullman Yards
  ((SELECT id FROM explore_tracks WHERE slug = 'as-seen-on-tv'), 2076, 11, false), -- Goat Farm Arts Center
  ((SELECT id FROM explore_tracks WHERE slug = 'as-seen-on-tv'), 305, 12, false),  -- Piedmont Park
  ((SELECT id FROM explore_tracks WHERE slug = 'as-seen-on-tv'), 4436, 13, false), -- Silver Skillet
  ((SELECT id FROM explore_tracks WHERE slug = 'as-seen-on-tv'), 1708, 14, false), -- Starlight Drive-In
  ((SELECT id FROM explore_tracks WHERE slug = 'as-seen-on-tv'), 323, 15, false),  -- Northside Tavern
  ((SELECT id FROM explore_tracks WHERE slug = 'as-seen-on-tv'), 1182, 16, false), -- Zesto
  ((SELECT id FROM explore_tracks WHERE slug = 'as-seen-on-tv'), 4437, 17, false), -- Healey Building (Baby Driver)
  ((SELECT id FROM explore_tracks WHERE slug = 'as-seen-on-tv'), 4438, 18, false), -- Wheat Street Towers (Black Panther)
  ((SELECT id FROM explore_tracks WHERE slug = 'as-seen-on-tv'), 4439, 19, false), -- Odd Fellows Building (Baby Driver)
  ((SELECT id FROM explore_tracks WHERE slug = 'as-seen-on-tv'), 4443, 20, false)  -- JD's on the Lake (Ozark)
ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, is_featured = EXCLUDED.is_featured;

-- ============================================================================
-- Track 19: Comedy & Live Performance (18 venues) — NEW
-- ============================================================================
INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured) VALUES
  ((SELECT id FROM explore_tracks WHERE slug = 'comedy-live'), 195, 1, true),   -- Punchline Comedy Club
  ((SELECT id FROM explore_tracks WHERE slug = 'comedy-live'), 194, 2, false),  -- Laughing Skull Lounge
  ((SELECT id FROM explore_tracks WHERE slug = 'comedy-live'), 4460, 3, false), -- WHIPLASH Comedy Club
  ((SELECT id FROM explore_tracks WHERE slug = 'comedy-live'), 552, 4, false),  -- Atlanta Comedy Theater
  ((SELECT id FROM explore_tracks WHERE slug = 'comedy-live'), 99, 5, true),    -- Dad's Garage Theatre
  ((SELECT id FROM explore_tracks WHERE slug = 'comedy-live'), 551, 6, false),  -- Whole World Improv Theatre
  ((SELECT id FROM explore_tracks WHERE slug = 'comedy-live'), 1008, 7, false), -- Dynamic El Dorado
  ((SELECT id FROM explore_tracks WHERE slug = 'comedy-live'), 326, 8, false),  -- Relapse Theatre
  ((SELECT id FROM explore_tracks WHERE slug = 'comedy-live'), 125, 9, true),   -- Alliance Theatre
  ((SELECT id FROM explore_tracks WHERE slug = 'comedy-live'), 44, 10, false),  -- 7 Stages Theater
  ((SELECT id FROM explore_tracks WHERE slug = 'comedy-live'), 423, 11, false), -- Horizon Theatre
  ((SELECT id FROM explore_tracks WHERE slug = 'comedy-live'), 582, 12, false), -- Theatrical Outfit
  ((SELECT id FROM explore_tracks WHERE slug = 'comedy-live'), 527, 13, false), -- Actor's Express
  ((SELECT id FROM explore_tracks WHERE slug = 'comedy-live'), 583, 14, false), -- True Colors Theatre
  ((SELECT id FROM explore_tracks WHERE slug = 'comedy-live'), 584, 15, false), -- Synchronicity Theatre
  ((SELECT id FROM explore_tracks WHERE slug = 'comedy-live'), 919, 16, false), -- Star Community Bar
  ((SELECT id FROM explore_tracks WHERE slug = 'comedy-live'), 657, 17, false), -- Kat's Cafe
  ((SELECT id FROM explore_tracks WHERE slug = 'comedy-live'), 58, 18, false)   -- Red Light Cafe
ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, is_featured = EXCLUDED.is_featured;

-- ============================================================================
-- Track 20: Native Heritage (14 venues) — NEW
-- ============================================================================
INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured) VALUES
  ((SELECT id FROM explore_tracks WHERE slug = 'native-heritage'), 4444, 1, true),  -- Standing Peachtree Park
  ((SELECT id FROM explore_tracks WHERE slug = 'native-heritage'), 4117, 2, false), -- Owl Rock
  ((SELECT id FROM explore_tracks WHERE slug = 'native-heritage'), 4445, 3, false), -- Soapstone Ridge
  ((SELECT id FROM explore_tracks WHERE slug = 'native-heritage'), 211, 4, false),  -- Atlanta History Center
  ((SELECT id FROM explore_tracks WHERE slug = 'native-heritage'), 217, 5, false),  -- Carlos Museum (Emory)
  ((SELECT id FROM explore_tracks WHERE slug = 'native-heritage'), 312, 6, false),  -- Sweetwater Creek State Park
  ((SELECT id FROM explore_tracks WHERE slug = 'native-heritage'), 1747, 7, false), -- Chattahoochee River NRA
  ((SELECT id FROM explore_tracks WHERE slug = 'native-heritage'), 4446, 8, true),  -- Etowah Indian Mounds
  ((SELECT id FROM explore_tracks WHERE slug = 'native-heritage'), 4447, 9, true),  -- Ocmulgee Mounds
  ((SELECT id FROM explore_tracks WHERE slug = 'native-heritage'), 4448, 10, false), -- New Echota
  ((SELECT id FROM explore_tracks WHERE slug = 'native-heritage'), 4449, 11, false), -- Funk Heritage Center
  ((SELECT id FROM explore_tracks WHERE slug = 'native-heritage'), 4346, 12, false), -- Kennesaw Mountain
  ((SELECT id FROM explore_tracks WHERE slug = 'native-heritage'), 4450, 13, false), -- Chief Vann House
  ((SELECT id FROM explore_tracks WHERE slug = 'native-heritage'), 4451, 14, false)  -- Track Rock Gap
ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, is_featured = EXCLUDED.is_featured;

-- ============================================================================
-- Track 21: Hell of an Engineer / Georgia Tech (18 venues) — NEW
-- ============================================================================
INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured) VALUES
  ((SELECT id FROM explore_tracks WHERE slug = 'hell-of-an-engineer'), 4452, 1, true),  -- Tech Tower
  ((SELECT id FROM explore_tracks WHERE slug = 'hell-of-an-engineer'), 624, 2, true),   -- Bobby Dodd Stadium
  ((SELECT id FROM explore_tracks WHERE slug = 'hell-of-an-engineer'), 4453, 4, false),  -- Kessler Campanile
  ((SELECT id FROM explore_tracks WHERE slug = 'hell-of-an-engineer'), 4454, 5, false),  -- Brittain Dining Hall
  ((SELECT id FROM explore_tracks WHERE slug = 'hell-of-an-engineer'), 4455, 6, false),  -- McAuley Aquatic Center
  ((SELECT id FROM explore_tracks WHERE slug = 'hell-of-an-engineer'), 4456, 7, false),  -- Kendeda Building
  ((SELECT id FROM explore_tracks WHERE slug = 'hell-of-an-engineer'), 4457, 8, false),  -- Seven Bridges Plaza
  ((SELECT id FROM explore_tracks WHERE slug = 'hell-of-an-engineer'), 4458, 9, false),  -- Technology Square
  ((SELECT id FROM explore_tracks WHERE slug = 'hell-of-an-engineer'), 4459, 10, false), -- Coda Building
  ((SELECT id FROM explore_tracks WHERE slug = 'hell-of-an-engineer'), 3185, 11, false), -- The Varsity
  ((SELECT id FROM explore_tracks WHERE slug = 'hell-of-an-engineer'), 687, 12, false),  -- Antico Pizza Napoletana
  ((SELECT id FROM explore_tracks WHERE slug = 'hell-of-an-engineer'), 3218, 13, false), -- Rocky Mountain Pizza
  ((SELECT id FROM explore_tracks WHERE slug = 'hell-of-an-engineer'), 1026, 14, false), -- Sublime Doughnuts
  ((SELECT id FROM explore_tracks WHERE slug = 'hell-of-an-engineer'), 785, 15, false),  -- Hyatt Regency Atlanta (Portman)
  ((SELECT id FROM explore_tracks WHERE slug = 'hell-of-an-engineer'), 786, 16, false),  -- Westin Peachtree Plaza (Portman)
  ((SELECT id FROM explore_tracks WHERE slug = 'hell-of-an-engineer'), 187, 17, false),  -- Marriott Marquis (Portman)
  ((SELECT id FROM explore_tracks WHERE slug = 'hell-of-an-engineer'), 214, 18, false)   -- College Football Hall of Fame
ON CONFLICT (track_id, venue_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, is_featured = EXCLUDED.is_featured;

COMMIT;
