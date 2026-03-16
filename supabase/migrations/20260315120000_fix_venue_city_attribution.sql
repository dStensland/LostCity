-- Fix 92 venues with city='Atlanta' but coordinates outside Atlanta metro.
-- Root cause: crawlers (esp. Atlanta Outdoor Club, Supercross) defaulted city
-- to 'Atlanta' regardless of actual venue location.
-- Also: fix source 753 (Cherry Blossom Festival) owner_portal_id.

BEGIN;

-- ============================================================
-- 1. Fix source 753: Macon event source incorrectly attributed to Atlanta
-- ============================================================
UPDATE sources
SET owner_portal_id = NULL
WHERE id = 753;

-- Backfill: clear portal_id on events from this source
UPDATE events
SET portal_id = NULL
WHERE source_id = 753;

-- ============================================================
-- 2. Fix venue city fields — venues with addresses
-- ============================================================

-- Stadiums and arenas (from Supercross and other touring sources)
UPDATE venues SET city = 'Grand Rapids' WHERE id = 136;    -- Van Andel Arena, MI
UPDATE venues SET city = 'Gainesville' WHERE id = 725;     -- Burd Center, GA
UPDATE venues SET city = 'Tallapoosa' WHERE id = 968;      -- The Possum Den, GA
UPDATE venues SET city = 'Del Mar' WHERE id = 2167;         -- Del Mar Fairgrounds, CA
UPDATE venues SET city = 'Portland' WHERE id = 2169;        -- Thompson's Point, ME
UPDATE venues SET city = 'Blue Ridge' WHERE id = 2174;      -- Downtown Blue Ridge, GA
UPDATE venues SET city = 'Blue Ridge' WHERE id = 2176;      -- Blue Ridge Play Park, GA
UPDATE venues SET city = 'Macon' WHERE id = 2182;           -- Macon, GA
UPDATE venues SET city = 'Dahlonega' WHERE id = 2193;       -- Dahlonega, GA
UPDATE venues SET city = 'La Crosse' WHERE id = 2208;       -- IrishFest, WI
UPDATE venues SET city = 'San Diego' WHERE id = 2223;       -- Snapdragon Stadium, CA
UPDATE venues SET city = 'Houston' WHERE id = 2224;         -- NRG Stadium, TX
UPDATE venues SET city = 'Daytona Beach' WHERE id = 2228;   -- Daytona Speedway, FL
UPDATE venues SET city = 'Indianapolis' WHERE id = 2229;    -- Lucas Oil Stadium, IN
UPDATE venues SET city = 'Birmingham' WHERE id = 2230;      -- Protective Stadium, AL
UPDATE venues SET city = 'Philadelphia' WHERE id = 2234;    -- Lincoln Financial Field, PA
UPDATE venues SET city = 'Denver' WHERE id = 2235;          -- Empower Field, CO
UPDATE venues SET city = 'Salt Lake City' WHERE id = 2236;  -- Rice-Eccles Stadium, UT
UPDATE venues SET city = 'Nashville' WHERE id = 2273;       -- Sheraton Music City, TN
UPDATE venues SET city = 'Waycross' WHERE id = 2338;        -- Okefenokee Fairgrounds, GA
UPDATE venues SET city = 'Knoxville' WHERE id = 2340;       -- Knoxville Expo, TN
UPDATE venues SET city = 'Sedalia' WHERE id = 2342;         -- MO State Fairgrounds
UPDATE venues SET city = 'West Liberty' WHERE id = 2343;    -- Morgan County, KY
UPDATE venues SET city = 'Joplin' WHERE id = 2344;          -- Joplin Expo, MO
UPDATE venues SET city = 'Gurdon' WHERE id = 4061;          -- Hoo-Hoo Monument, AR

-- ============================================================
-- 3. Fix venue city fields — adventure destinations (no address)
-- ============================================================

-- North Georgia
UPDATE venues SET city = 'Toccoa' WHERE id = 5397;          -- Currahee Mountain Trailhead
UPDATE venues SET city = 'Suches' WHERE id = 5410;           -- Dicks Knob
UPDATE venues SET city = 'Hiawassee' WHERE id = 5411;        -- Unicoi Gap
UPDATE venues SET city = 'Hiawassee' WHERE id = 5413;        -- Grassy Ridge
UPDATE venues SET city = 'Cleveland' WHERE id = 5422;        -- Ingles in Cleveland
UPDATE venues SET city = 'Jasper' WHERE id = 5433;           -- Tabacco Pouch Trail
UPDATE venues SET city = 'Blairsville' WHERE id = 5437;      -- Vogel State Park
UPDATE venues SET city = 'Hiawassee' WHERE id = 5441;        -- Tray Mountain
UPDATE venues SET city = 'Dawsonville' WHERE id = 5444;      -- Amicalola State Park
UPDATE venues SET city = 'Hiawassee' WHERE id = 5446;        -- Hiawassee, GA
UPDATE venues SET city = 'Suches' WHERE id = 5448;           -- Woody Gap to Blood Mtn
UPDATE venues SET city = 'Clayton' WHERE id = 5451;          -- Warwoman Dell Rd
UPDATE venues SET city = 'Twin City' WHERE id = 5452;        -- George L Smith State Park
UPDATE venues SET city = 'Suches' WHERE id = 5454;           -- Lake Winfield Scott
UPDATE venues SET city = 'Blairsville' WHERE id = 5457;      -- Jacks Gap
UPDATE venues SET city = 'Jackson' WHERE id = 5462;          -- High Falls State Park
UPDATE venues SET city = 'Jackson' WHERE id = 5463;          -- High Falls Park Drive
UPDATE venues SET city = 'Forsyth' WHERE id = 5464;          -- Dames Ferry State Park
UPDATE venues SET city = 'Hiawassee' WHERE id = 5466;        -- Black Rock Lake
UPDATE venues SET city = 'Dawsonville' WHERE id = 5470;      -- Amicalola State Park
UPDATE venues SET city = 'Suches' WHERE id = 6065;           -- Suches, GA
UPDATE venues SET city = 'Hiawassee' WHERE id = 6067;        -- Hiawassee, Georgia

-- Campgrounds — North Georgia
UPDATE venues SET city = 'Dawsonville' WHERE id = 5549;      -- Amicalola Falls Campground
UPDATE venues SET city = 'Ellijay' WHERE id = 5550;          -- Bear Creek Campground
UPDATE venues SET city = 'Suches' WHERE id = 5551;           -- Cooper Creek
UPDATE venues SET city = 'Suches' WHERE id = 5552;           -- Deep Hole
UPDATE venues SET city = 'Suches' WHERE id = 5553;           -- Dockery Lake
UPDATE venues SET city = 'Suches' WHERE id = 5554;           -- Lake Winfield Scott Camp
UPDATE venues SET city = 'LaFayette' WHERE id = 5555;        -- The Pocket
UPDATE venues SET city = 'Tallulah Falls' WHERE id = 5558;   -- Terrora
UPDATE venues SET city = 'Blue Ridge' WHERE id = 5570;       -- Frank Gross
UPDATE venues SET city = 'Blue Ridge' WHERE id = 5571;       -- Mulky
UPDATE venues SET city = 'Blue Ridge' WHERE id = 5572;       -- Toccoa River Sandy Bottoms
UPDATE venues SET city = 'Dahlonega' WHERE id = 5580;        -- DeSoto Falls
UPDATE venues SET city = 'Chatsworth' WHERE id = 5581;       -- Lake Conasauga
UPDATE venues SET city = 'Chatsworth' WHERE id = 5584;       -- Lake Conasauga Overflow
UPDATE venues SET city = 'Chatsworth' WHERE id = 5585;       -- Hickey Gap
UPDATE venues SET city = 'Dahlonega' WHERE id = 5587;        -- Bolding Mill
UPDATE venues SET city = 'Dahlonega' WHERE id = 5588;        -- Toto Creek
UPDATE venues SET city = 'Dahlonega' WHERE id = 5589;        -- Ducket Mill

-- South / Coastal Georgia
UPDATE venues SET city = 'St. Marys' WHERE id = 5573;        -- Brickhill Bluff
UPDATE venues SET city = 'Folkston' WHERE id = 5574;         -- Buffalo Swamp
UPDATE venues SET city = 'Blakely' WHERE id = 5575;          -- Camp Hicita
UPDATE venues SET city = 'Brunswick' WHERE id = 5582;        -- Blythe Island
UPDATE venues SET city = 'Zebulon' WHERE id = 5583;          -- Joe Kurz WMA

-- Out of state (Tennessee, NC, SC)
UPDATE venues SET city = 'Chattanooga' WHERE id = 5423;      -- Chattanooga, TN
UPDATE venues SET city = 'Franklin' WHERE id = 5427;         -- Standing Indian Camp, NC
UPDATE venues SET city = 'Townsend' WHERE id = 5443;         -- Rainbow Fall, TN
UPDATE venues SET city = 'Townsend' WHERE id = 5447;         -- Ramsey Cascades, TN
UPDATE venues SET city = 'Bryson City' WHERE id = 5449;      -- Newfound Gap, TN/NC
UPDATE venues SET city = 'Townsend' WHERE id = 5467;         -- Townsend, TN
UPDATE venues SET city = 'Townsend' WHERE id = 5468;         -- Townsend, TN
UPDATE venues SET city = 'Franklin' WHERE id = 5469;         -- Bear Pen Trail, NC
UPDATE venues SET city = 'Cashiers' WHERE id = 5465;         -- Yellow Mountain, NC
UPDATE venues SET city = 'Scaly Mountain' WHERE id = 5412;   -- Big Scaly Mountain, NC
UPDATE venues SET city = 'Walhalla' WHERE id = 5458;         -- Walhalla, SC
UPDATE venues SET city = 'Greer' WHERE id = 5455;            -- Greer, SC
UPDATE venues SET city = 'Gruetli-Laager' WHERE id = 6066;   -- Gruetli-Laager, TN

-- International / distant US
UPDATE venues SET city = 'Bowness-on-Solway' WHERE id = 5456; -- UK
UPDATE venues SET city = 'Concrete' WHERE id = 5471;          -- Washington state
UPDATE venues SET city = 'Silverton' WHERE id = 5472;         -- Colorado
UPDATE venues SET city = 'Marrakech' WHERE id = 5473;         -- Morocco
UPDATE venues SET city = 'Yerevan' WHERE id = 5474;           -- Armenia
UPDATE venues SET city = 'Lincoln' WHERE id = 5475;           -- New Hampshire
UPDATE venues SET city = 'Te Anau' WHERE id = 5476;           -- New Zealand
UPDATE venues SET city = 'Tanabe' WHERE id = 5477;            -- Japan
UPDATE venues SET city = 'Arusha' WHERE id = 5461;            -- Tanzania

-- ============================================================
-- 4. Clean up venue 2182 spam description
-- ============================================================
UPDATE venues
SET description = NULL
WHERE id = 2182
  AND description LIKE '%termostati digitali%';

COMMIT;
