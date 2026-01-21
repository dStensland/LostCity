-- Migration 027: Fix NULL and inconsistent spot_types on venues
-- Many venues have NULL spot_type preventing icons from displaying

-- =====================
-- COLLEGES & UNIVERSITIES
-- =====================
UPDATE venues SET spot_type = 'college' WHERE name ILIKE '%college%' AND spot_type IS NULL;
UPDATE venues SET spot_type = 'university' WHERE name ILIKE '%university%' AND spot_type IS NULL;
UPDATE venues SET spot_type = 'university' WHERE name IN (
    'Georgia Tech',
    'Georgia Tech Campus',
    'Emory University',
    'Agnes Scott College',
    'Spelman College',
    'Morehouse College',
    'Clark Atlanta University'
) AND spot_type IS NULL;

-- =====================
-- LIBRARIES
-- =====================
UPDATE venues SET spot_type = 'library' WHERE name ILIKE '%library%' AND spot_type IS NULL;

-- =====================
-- THEATERS & PERFORMANCE
-- =====================
UPDATE venues SET spot_type = 'theater' WHERE name ILIKE '%theatre%' AND spot_type IS NULL;
UPDATE venues SET spot_type = 'theater' WHERE name ILIKE '%theater%' AND spot_type IS NULL;
UPDATE venues SET spot_type = 'theater' WHERE name IN (
    'Fox Theatre',
    'Dad''s Garage',
    'Dad''s Garage Theatre Company',
    'Shakespeare Tavern Playhouse',
    'Pinch ''n'' Ouch Theatre',
    'PushPush Theater',
    'OnStage Atlanta',
    '7 Stages',
    'Working Title Playwrights'
) AND spot_type IS NULL;

-- =====================
-- MUSIC VENUES
-- =====================
UPDATE venues SET spot_type = 'music_venue' WHERE name IN (
    'The Earl',
    'The Eastern',
    'Terminal West',
    'The Masquerade',
    'Smith''s Olde Bar',
    'Eddie''S Attic',
    'Basement Atlanta',
    'MJQ Concourse',
    'Madlife Stage & Studios',
    'St. James Live',
    'Believe Music Hall (basement entrance)'
) AND spot_type IS NULL;

-- =====================
-- BARS & PUBS
-- =====================
UPDATE venues SET spot_type = 'bar' WHERE name ILIKE '%pub%' AND spot_type IS NULL;
UPDATE venues SET spot_type = 'bar' WHERE name ILIKE '%tavern%' AND spot_type IS NULL;
UPDATE venues SET spot_type = 'bar' WHERE name IN (
    'Manuel''s Tavern',
    'Atkins Park Tavern',
    'Park Tavern',
    'Limerick Junction Pub',
    'Meehan''s Public House',
    'Fado Irish Pub',
    'Gene''s',
    'Johnny''s Hideaway',
    'Friends on Ponce',
    'Neighbor''s Pub',
    'The Pub at EAV',
    'Moe''s and Joe''s',
    'Holy Taco',
    'Rowdy Tiger',
    'Side Saddle',
    'Woofs',
    'Woody''s Atlanta'
) AND spot_type IS NULL;

-- =====================
-- BREWERIES
-- =====================
UPDATE venues SET spot_type = 'brewery' WHERE name ILIKE '%brewing%' AND spot_type IS NULL;
UPDATE venues SET spot_type = 'brewery' WHERE name ILIKE '%brewery%' AND spot_type IS NULL;
UPDATE venues SET spot_type = 'brewery' WHERE name IN (
    'Monday Night Brewing',
    'Wild Heaven Beer',
    'Cherry Street Brewing',
    'Eventide Brewing',
    'Fire Maker Brewing',
    'From The Earth Brewing Company',
    'Halfway Crooks',
    'Pontoon Brewing Company',
    'Round Trip Brewing',
    'Steady Hand Beer Co',
    'Sweetwater Brewing Company',
    'Three Taverns Imaginarium'
) AND spot_type IS NULL;

-- =====================
-- SPORTS BARS
-- =====================
UPDATE venues SET spot_type = 'sports_bar' WHERE name IN (
    'STATS Brewpub'
) AND spot_type IS NULL;

-- =====================
-- CLUBS & NIGHTLIFE
-- =====================
UPDATE venues SET spot_type = 'club' WHERE name IN (
    'Club Wander',
    'Opium',
    'Compound Atlanta',
    'Pisces Atlanta',
    'Lore Atlanta',
    'Jungle Atlanta'
) AND spot_type IS NULL;

-- Normalize nightclub to club
UPDATE venues SET spot_type = 'club' WHERE spot_type = 'nightclub';

-- =====================
-- RESTAURANTS
-- =====================
UPDATE venues SET spot_type = 'restaurant' WHERE name IN (
    'Gypsy Kitchen',
    'Kat''s Cafe',
    'The Sun Dial Restaurant',
    'Sweet Auburn BBQ',
    'Urban Pie',
    'Gino''s New York Pizza Bar',
    'Three Arches Bar & Restaurant',
    'Cirque Daiquiri Bar & Grill'
) AND spot_type IS NULL;

-- =====================
-- COFFEE SHOPS
-- =====================
UPDATE venues SET spot_type = 'coffee_shop' WHERE name IN (
    'Urban Grind',
    'Lux Cafe'
) AND spot_type IS NULL;

-- =====================
-- HOTELS
-- =====================
UPDATE venues SET spot_type = 'hotel' WHERE name ILIKE '%hotel%' AND spot_type IS NULL;
UPDATE venues SET spot_type = 'hotel' WHERE name ILIKE '%marriott%' AND spot_type IS NULL;
UPDATE venues SET spot_type = 'hotel' WHERE name ILIKE '%hilton%' AND spot_type IS NULL;
UPDATE venues SET spot_type = 'hotel' WHERE name ILIKE '%waldorf%' AND spot_type IS NULL;
UPDATE venues SET spot_type = 'hotel' WHERE name ILIKE '%sonesta%' AND spot_type IS NULL;

-- =====================
-- ARENAS & STADIUMS
-- =====================
UPDATE venues SET spot_type = 'arena' WHERE name ILIKE '%stadium%' AND spot_type IS NULL;
UPDATE venues SET spot_type = 'arena' WHERE name IN (
    'Bobby Dodd Stadium',
    'Center Parc Stadium',
    'Fifth Third Bank Stadium',
    'Russ Chandler Stadium',
    'EEG Arena'
) AND spot_type IS NULL;

-- Normalize stadium to arena
UPDATE venues SET spot_type = 'arena' WHERE spot_type = 'stadium';

-- =====================
-- PARKS & OUTDOOR
-- =====================
UPDATE venues SET spot_type = 'park' WHERE name ILIKE '%park%' AND spot_type IS NULL AND name NOT ILIKE '%parking%';
UPDATE venues SET spot_type = 'park' WHERE name IN (
    'Piedmont Park',
    'Piedmont Park Greystone',
    'Fourth Ward Skatepark Playground',
    'Roper Park'
) AND spot_type IS NULL;

-- =====================
-- MUSEUMS & GALLERIES
-- =====================
UPDATE venues SET spot_type = 'museum' WHERE name IN (
    'High Museum of Art',
    'National Center For Civil And Human Rights'
) AND spot_type IS NULL;

UPDATE venues SET spot_type = 'gallery' WHERE name ILIKE '%gallery%' AND spot_type IS NULL;
UPDATE venues SET spot_type = 'gallery' WHERE name IN (
    'Hathaway Contemporary',
    'Luca Fine Art',
    'Poem88 Gallery',
    'The 109 Gallery',
    'Cat Eye Creative'
) AND spot_type IS NULL;

-- =====================
-- GARDENS
-- =====================
UPDATE venues SET spot_type = 'garden' WHERE name IN (
    'Atlanta Botanical Garden'
) AND spot_type IS NULL;

-- =====================
-- GAMING
-- =====================
UPDATE venues SET spot_type = 'games' WHERE name IN (
    'ATL Gaming',
    'Level Up Gaming Lounge',
    'Token Gaming Pub',
    'Area 51 - Aurora Cineplex And The Fringe Miniature Golf'
) AND spot_type IS NULL;

-- Normalize gaming to games
UPDATE venues SET spot_type = 'games' WHERE spot_type = 'gaming';

-- =====================
-- BOOKSTORES
-- =====================
UPDATE venues SET spot_type = 'bookstore' WHERE name IN (
    'Book Boutique',
    'Wild Aster Books'
) AND spot_type IS NULL;

-- =====================
-- FITNESS & DANCE STUDIOS
-- =====================
UPDATE venues SET spot_type = 'fitness_center' WHERE name ILIKE '%fitness%' AND spot_type IS NULL;
UPDATE venues SET spot_type = 'fitness_center' WHERE name ILIKE '%gym%' AND spot_type IS NULL;
UPDATE venues SET spot_type = 'fitness_center' WHERE name ILIKE '%running%' AND spot_type IS NULL;
UPDATE venues SET spot_type = 'fitness_center' WHERE name ILIKE '%cycling%' AND spot_type IS NULL;
UPDATE venues SET spot_type = 'fitness_center' WHERE name IN (
    'Atlanta Dance Ballroom',
    'Atlanta Fusion Belly Dance',
    'Arthur Murray Atlanta',
    'Ballroom Impact',
    'Core Dance Studios',
    'Dancing4Fun',
    'Academy Ballroom',
    'Terminus Modern Ballet'
) AND spot_type IS NULL;

-- Normalize fitness to fitness_center
UPDATE venues SET spot_type = 'fitness_center' WHERE spot_type = 'fitness';

-- =====================
-- CHURCHES
-- =====================
UPDATE venues SET spot_type = 'church' WHERE name ILIKE '%church%' AND spot_type IS NULL;
UPDATE venues SET spot_type = 'church' WHERE name IN (
    'Greenforest Community Baptist Church',
    'Neighborhood Church',
    'Southeast Atlanta 7th Day Baptist Church',
    'Community Church Atlanta'
) AND spot_type IS NULL;

-- =====================
-- COMMUNITY CENTERS & ORGANIZATIONS
-- =====================
UPDATE venues SET spot_type = 'community_center' WHERE name ILIKE '%community center%' AND spot_type IS NULL;
UPDATE venues SET spot_type = 'community_center' WHERE name ILIKE '%recreation center%' AND spot_type IS NULL;
UPDATE venues SET spot_type = 'community_center' WHERE name IN (
    'Smyrna Community Center',
    'Lang Carson Recreation Center',
    'Tracey Wyatt Recreation Complex',
    'Russell Innovation Center for Entrepreneurs'
) AND spot_type IS NULL;

UPDATE venues SET spot_type = 'organization' WHERE name IN (
    'Trees Atlanta',
    'Park Pride',
    'Friends of Westside Park',
    'Girl Scouts of Greater Atlanta',
    'Atlanta Pride',
    'Atlanta Inner-City Ministry',
    'Atlanta Music Project',
    'First African Community Development Corporation (FACDC)',
    'Enough to Share Inc.',
    'Giving Hands Food Pantry',
    'SafeRide America',
    'Stella Love Non-Profit',
    'The Launch Pad Foundation',
    'Wylde Center'
) AND spot_type IS NULL;

-- =====================
-- CINEMAS
-- =====================
UPDATE venues SET spot_type = 'cinema' WHERE name ILIKE '%cineplex%' AND spot_type IS NULL;
UPDATE venues SET spot_type = 'cinema' WHERE name IN (
    'Aurora Cineplex'
) AND spot_type IS NULL;

-- =====================
-- EVENT SPACES & VENUES
-- =====================
UPDATE venues SET spot_type = 'event_space' WHERE name IN (
    'The Betty',
    'The Independent',
    'The Crown Room event center',
    'Heaven''s Banquet Hall',
    'Underground Atlanta',
    'Ponce City Market',
    'Atlantic Station Retail Space 14125'
) AND spot_type IS NULL;

-- =====================
-- HOSPITALS & HEALTHCARE
-- =====================
UPDATE venues SET spot_type = 'hospital' WHERE name ILIKE 'piedmont%' AND spot_type IS NULL;
UPDATE venues SET spot_type = 'hospital' WHERE name IN (
    'Grady Health System - Food as Medicine',
    'Community Whole Health'
) AND spot_type IS NULL;

-- =====================
-- ZOO
-- =====================
UPDATE venues SET spot_type = 'attraction' WHERE name IN (
    'Zoo Atlanta'
) AND spot_type IS NULL;

-- =====================
-- STUDIOS (production/recording)
-- =====================
UPDATE venues SET spot_type = 'studio' WHERE name ILIKE '%studio%' AND spot_type IS NULL;

-- =====================
-- NORMALIZE OTHER INCONSISTENCIES
-- =====================
-- convention -> convention_center
UPDATE venues SET spot_type = 'convention_center' WHERE spot_type = 'convention';

-- entertainment -> event_space
UPDATE venues SET spot_type = 'event_space' WHERE spot_type = 'entertainment';

-- neighborhood -> remove (not a valid spot type)
UPDATE venues SET spot_type = NULL WHERE spot_type = 'neighborhood';

-- plaza -> event_space
UPDATE venues SET spot_type = 'event_space' WHERE spot_type = 'plaza';

-- retail/shopping -> NULL (not event venues)
UPDATE venues SET spot_type = NULL WHERE spot_type IN ('retail', 'shopping');

-- street -> NULL
UPDATE venues SET spot_type = NULL WHERE spot_type = 'street';

-- pharmacy -> healthcare
UPDATE venues SET spot_type = 'healthcare' WHERE spot_type = 'pharmacy';

-- art_fair -> festival
UPDATE venues SET spot_type = 'festival' WHERE spot_type = 'art_fair';
