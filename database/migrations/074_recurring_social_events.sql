-- ============================================
-- MIGRATION 074: Add Recurring Social Event Venues
-- ============================================
-- Weekly recurring events discovered from badslava.com
-- Categories: Open Mics, Karaoke, Game Nights, Bingo
-- ============================================

-- ============================================
-- 1. KARAOKE VENUES
-- ============================================

-- Metalsome Live Band Karaoke (Monday)
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'Metalsome Live Band Karaoke',
    'metalsome-live-band-karaoke',
    '1092 Briarcliff Pl NE',
    'Briarcliff',
    'Atlanta',
    'GA',
    '30306',
    'bar',
    NULL
)
ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address,
    neighborhood = EXCLUDED.neighborhood;

-- Copper Cove Restaurant & Lounge (Tuesday)
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'Copper Cove Restaurant & Lounge',
    'copper-cove-restaurant-lounge',
    '1782 Cheshire Bridge Rd NE',
    'Cheshire Bridge',
    'Atlanta',
    'GA',
    '30324',
    'restaurant',
    NULL
)
ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address,
    neighborhood = EXCLUDED.neighborhood;

-- Boggs Social & Supply (Wednesday)
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'Boggs Social & Supply',
    'boggs-social-supply',
    '1310 White St SW',
    'West End',
    'Atlanta',
    'GA',
    '30310',
    'bar',
    NULL
)
ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address,
    neighborhood = EXCLUDED.neighborhood;

-- TEN ATL (Wednesday karaoke, Thursday open mic)
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'TEN ATL',
    'ten-atl',
    '495 Flat Shoals Ave SE',
    'East Atlanta',
    'Atlanta',
    'GA',
    '30316',
    'bar',
    NULL
)
ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address,
    neighborhood = EXCLUDED.neighborhood;

-- Daiquiriville (Thursday)
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'Daiquiriville',
    'daiquiriville',
    '50 Upper Alabama St SW',
    'Downtown',
    'Atlanta',
    'GA',
    '30303',
    'bar',
    NULL
)
ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address,
    neighborhood = EXCLUDED.neighborhood;

-- Roll 1 Cafe (Thursday)
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'Roll 1 Cafe',
    'roll-1-cafe',
    '1917 Pryor Road Suite F',
    'Lakewood',
    'Atlanta',
    'GA',
    '30315',
    'cafe',
    NULL
)
ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address,
    neighborhood = EXCLUDED.neighborhood;

-- Your 3rd Spot (Thursday)
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'Your 3rd Spot',
    'your-3rd-spot',
    '400 Chattahoochee Row NW',
    'Upper Westside',
    'Atlanta',
    'GA',
    '30318',
    'bar',
    NULL
)
ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address,
    neighborhood = EXCLUDED.neighborhood;

-- Smith's Olde Bar (Thursday karaoke, Wednesday open mic)
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'Smith''s Olde Bar',
    'smiths-olde-bar',
    '1578 Piedmont Ave NE',
    'Ansley Park',
    'Atlanta',
    'GA',
    '30324',
    'bar',
    'https://www.smithsoldebar.com'
)
ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address,
    website = EXCLUDED.website;

-- Metro Fun Center (Friday)
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'Metro Fun Center',
    'metro-fun-center',
    '1959 Metropolitan Pkwy SW',
    'Lakewood',
    'Atlanta',
    'GA',
    '30315',
    'entertainment_venue',
    NULL
)
ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address,
    neighborhood = EXCLUDED.neighborhood;

-- ============================================
-- 2. COMEDY/OPEN MIC VENUES
-- ============================================

-- Joe's Coffeehouse (Monday)
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'Joe''s Coffeehouse',
    'joes-coffeehouse',
    '510 Flat Shoals Ave SE',
    'East Atlanta',
    'Atlanta',
    'GA',
    '30316',
    'cafe',
    NULL
)
ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address,
    neighborhood = EXCLUDED.neighborhood;

-- Our Bar ATL (Monday)
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'Our Bar ATL',
    'our-bar-atl',
    '339 Edgewood Ave SE',
    'Old Fourth Ward',
    'Atlanta',
    'GA',
    '30312',
    'bar',
    NULL
)
ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address,
    neighborhood = EXCLUDED.neighborhood;

-- Southern Feed Store (Tuesday)
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'Southern Feed Store',
    'southern-feed-store',
    '1245 Glenwood Ave SE Suite 6',
    'East Atlanta',
    'Atlanta',
    'GA',
    '30316',
    'bar',
    NULL
)
ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address,
    neighborhood = EXCLUDED.neighborhood;

-- Laughing Skull Lounge (Tuesday)
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'Laughing Skull Lounge',
    'laughing-skull-lounge',
    '878 Peachtree St NE',
    'Midtown',
    'Atlanta',
    'GA',
    '30309',
    'comedy_club',
    'https://laughingskulllounge.com'
)
ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address,
    website = EXCLUDED.website;

-- Limerick Junction (Tuesday)
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'Limerick Junction',
    'limerick-junction',
    '822 N Highland Ave NE',
    'Virginia Highland',
    'Atlanta',
    'GA',
    '30306',
    'bar',
    NULL
)
ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address,
    neighborhood = EXCLUDED.neighborhood;

-- Limelight Theater (Tuesday)
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'Limelight Theater',
    'limelight-theater',
    '349 Decatur St SE',
    'Downtown',
    'Atlanta',
    'GA',
    '30312',
    'theater',
    NULL
)
ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address,
    neighborhood = EXCLUDED.neighborhood;

-- Farm Burger (Wednesday)
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'Farm Burger Midtown',
    'farm-burger-midtown',
    '22 14th St NW Suite D',
    'Midtown',
    'Atlanta',
    'GA',
    '30309',
    'restaurant',
    'https://farmburger.com'
)
ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address,
    website = EXCLUDED.website;

-- Red Light Cafe (Wednesday)
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'Red Light Cafe',
    'red-light-cafe',
    '553 Amsterdam Ave NE',
    'Midtown',
    'Atlanta',
    'GA',
    '30306',
    'cafe',
    'https://redlightcafe.com'
)
ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address,
    website = EXCLUDED.website;

-- Pullman Yards (Wednesday) - may already exist
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'Pullman Yards',
    'pullman-yards',
    '225 Rogers St NE',
    'Kirkwood',
    'Atlanta',
    'GA',
    '30317',
    'event_venue',
    'https://pullmanyards.com'
)
ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address,
    website = EXCLUDED.website;

-- ASW Whiskey Exchange (Thursday)
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'ASW Whiskey Exchange',
    'asw-whiskey-exchange',
    '1000 White St SW',
    'West End',
    'Atlanta',
    'GA',
    '30310',
    'bar',
    'https://aswdistillery.com'
)
ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address,
    website = EXCLUDED.website;

-- Atlantucky Brewing (Thursday)
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'Atlantucky Brewing',
    'atlantucky-brewing',
    '170 Northside Dr SW Suite 96',
    'English Avenue',
    'Atlanta',
    'GA',
    '30313',
    'brewery',
    NULL
)
ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address,
    neighborhood = EXCLUDED.neighborhood;

-- Urban Grind (Thursday)
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'Urban Grind',
    'urban-grind',
    '962 Marietta St NW',
    'Home Park',
    'Atlanta',
    'GA',
    '30318',
    'cafe',
    NULL
)
ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address,
    neighborhood = EXCLUDED.neighborhood;

-- Kat's Cafe (Thursday)
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'Kat''s Cafe',
    'kats-cafe',
    '970 Piedmont Ave NE',
    'Midtown',
    'Atlanta',
    'GA',
    '30309',
    'cafe',
    NULL
)
ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address,
    neighborhood = EXCLUDED.neighborhood;

-- The Battery Atlanta (Thursday)
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'The Battery Atlanta',
    'the-battery-atlanta',
    '800 Battery Ave SE',
    'The Battery',
    'Atlanta',
    'GA',
    '30339',
    'entertainment_venue',
    'https://batteryatl.com'
)
ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address,
    website = EXCLUDED.website;

-- Joystick Gamebar (Thursday)
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'Joystick Gamebar',
    'joystick-gamebar',
    '427 Edgewood Ave SE',
    'Old Fourth Ward',
    'Atlanta',
    'GA',
    '30312',
    'bar',
    'https://joystickgamebar.com'
)
ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address,
    website = EXCLUDED.website;

-- Peters Street Station (Thursday)
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'Peters Street Station',
    'peters-street-station',
    '333 Peters St SW',
    'Castleberry Hill',
    'Atlanta',
    'GA',
    '30313',
    'bar',
    NULL
)
ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address,
    neighborhood = EXCLUDED.neighborhood;

-- Dynamic El Dorado (Friday)
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'Dynamic El Dorado',
    'dynamic-el-dorado',
    '572 Edgewood Ave SE #116',
    'Old Fourth Ward',
    'Atlanta',
    'GA',
    '30312',
    'bar',
    NULL
)
ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address,
    neighborhood = EXCLUDED.neighborhood;

-- 529 Bar (Saturday)
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    '529 Bar',
    '529-bar',
    '529 Flat Shoals Ave SE',
    'East Atlanta',
    'Atlanta',
    'GA',
    '30316',
    'bar',
    'https://529atl.com'
)
ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address,
    website = EXCLUDED.website;

-- ============================================
-- 3. GAME NIGHT VENUES
-- ============================================

-- Jason's Deli (Monday)
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'Jason''s Deli Dunwoody',
    'jasons-deli-dunwoody',
    '4705 Ashford Dunwoody Rd',
    'Dunwoody',
    'Atlanta',
    'GA',
    '30338',
    'restaurant',
    'https://jasonsdeli.com'
)
ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address,
    website = EXCLUDED.website;

-- Manuels Tavern (Wednesday)
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'Manuel''s Tavern',
    'manuels-tavern',
    '602 N Highland Ave NE',
    'Poncey-Highland',
    'Atlanta',
    'GA',
    '30306',
    'bar',
    'https://manuelstavern.com'
)
ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address,
    website = EXCLUDED.website;

-- Church of the Epiphany (Saturday)
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'Church of the Epiphany',
    'church-of-the-epiphany',
    '2089 Ponce De Leon Ave NE',
    'Druid Hills',
    'Atlanta',
    'GA',
    '30307',
    'community_center',
    NULL
)
ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address,
    neighborhood = EXCLUDED.neighborhood;

-- ============================================
-- 4. BINGO VENUES
-- ============================================

-- Punch Bowl Social (Thursday)
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'Punch Bowl Social',
    'punch-bowl-social',
    '875 Battery Ave SE Ste 720',
    'The Battery',
    'Atlanta',
    'GA',
    '30339',
    'entertainment_venue',
    'https://punchbowlsocial.com'
)
ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address,
    website = EXCLUDED.website;

-- Blue Martini Atlanta (Sunday)
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'Blue Martini Atlanta',
    'blue-martini-atlanta',
    '3402 Piedmont Rd NE',
    'Buckhead',
    'Atlanta',
    'GA',
    '30305',
    'bar',
    'https://bluemartinilounge.com'
)
ON CONFLICT (slug) DO UPDATE SET
    address = EXCLUDED.address,
    website = EXCLUDED.website;

-- ============================================
-- 5. CREATE SINGLE SOURCE FOR RECURRING EVENTS
-- ============================================

INSERT INTO sources (name, slug, source_type, url, is_active, owner_portal_id)
VALUES (
    'Atlanta Recurring Social Events',
    'atlanta-recurring-social',
    'venue_calendar',
    'https://badslava.com/',
    true,
    (SELECT id FROM portals WHERE slug = 'atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    is_active = true;
