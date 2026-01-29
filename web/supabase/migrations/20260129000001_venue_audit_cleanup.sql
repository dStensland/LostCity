-- Migration: Venue Audit Cleanup
-- 1. Migrate org-typed venues to organizations table
-- 2. Classify unclassified venues (type='venue')
-- 3. Delete bad data entries

-- ============================================================================
-- PART 1: Delete bad data entries
-- ============================================================================

-- Delete placeholder/garbage venue entries
DELETE FROM venues WHERE name IN (
  'Online / Virtual Event',
  'Atlanta',
  'Atlanta Area',
  'TBD',
  'TBA',
  'Various'
);

-- Delete venues with promotional text or dates as names
DELETE FROM venues WHERE
  name LIKE '%returns in%' OR
  name LIKE 'April%2026%' OR
  name LIKE 'March%2026%' OR
  name LIKE '%, 2026%';

-- ============================================================================
-- PART 2: Migrate org-typed venues to organizations
-- ============================================================================

-- Insert venues typed as 'organization', 'nonprofit', 'network' into organizations
-- (only if they don't already exist by slug)
INSERT INTO organizations (
  id, name, slug, org_type, description, website, instagram, neighborhood,
  categories, hidden, created_at
)
SELECT
  gen_random_uuid() as id,
  v.name,
  v.slug,
  CASE
    WHEN v.venue_type = 'organization' THEN 'community_nonprofit'
    WHEN v.venue_type = 'nonprofit' THEN 'community_nonprofit'
    WHEN v.venue_type = 'nonprofit_hq' THEN 'community_nonprofit'
    WHEN v.venue_type = 'network' THEN 'community_group'
    WHEN v.venue_type = 'arts_center' THEN 'arts_nonprofit'
    ELSE 'community_nonprofit'
  END as org_type,
  v.description,
  v.website,
  v.instagram,
  v.neighborhood,
  ARRAY['community']::text[] as categories,
  false as hidden,
  COALESCE(v.created_at, NOW()) as created_at
FROM venues v
WHERE v.venue_type IN ('organization', 'nonprofit', 'nonprofit_hq', 'network', 'arts_center')
  AND NOT EXISTS (
    SELECT 1 FROM organizations o
    WHERE LOWER(o.slug) = LOWER(v.slug)
       OR LOWER(o.name) = LOWER(v.name)
  );

-- After creating orgs, hide the venue records (don't delete to preserve event references)
UPDATE venues
SET active = false
WHERE venue_type IN ('organization', 'nonprofit', 'nonprofit_hq', 'network')
  AND venue_type != 'arts_center'; -- Keep arts_center venues as they might be physical locations

-- ============================================================================
-- PART 3: Classify unclassified venues (type='venue')
-- ============================================================================

-- Theaters
UPDATE venues SET venue_type = 'theater' WHERE venue_type = 'venue' AND (
  LOWER(name) LIKE '%theatre%' OR
  LOWER(name) LIKE '%theater%' OR
  LOWER(name) LIKE '%playhouse%' OR
  LOWER(name) LIKE '% stage%' OR
  name IN ('7 Stages', 'Variety Playhouse', 'Fox Theatre - Atlanta', 'Buckhead Theatre',
           'Center Stage Theater', 'Academy Theatre', 'Madlife Stage & Studios')
);

-- Music venues
UPDATE venues SET venue_type = 'music_venue' WHERE venue_type = 'venue' AND (
  LOWER(name) LIKE '%music%' OR
  name IN ('Terminal West', 'Tabernacle', 'The Eastern-GA', 'The Loft', 'Echo Room',
           'Eddie''S Attic', 'Coca-Cola Roxy', 'Vinyl', 'Aisle 5', 'Smith''S Olde Bar',
           'Smith''s Olde Bar', 'The Masquerade  - Altar', 'The Masquerade - Heaven',
           'The Masquerade - Hell', 'The Masquerade - Purgatory', 'The Masquerade Music Park')
);

-- Bars
UPDATE venues SET venue_type = 'bar' WHERE venue_type = 'venue' AND (
  LOWER(name) LIKE '%bar%' OR
  LOWER(name) LIKE '%tavern%' OR
  LOWER(name) LIKE '%pub %' OR
  name IN ('Atkins Park Tavern', 'Trolley Barn')
);

-- Breweries
UPDATE venues SET venue_type = 'brewery' WHERE venue_type = 'venue' AND (
  LOWER(name) LIKE '%brewing%' OR
  LOWER(name) LIKE '%brewery%' OR
  name IN ('Pontoon Brewing Company', 'Sweetwater Brewing Company', 'From The Earth Brewing Company')
);

-- Churches
UPDATE venues SET venue_type = 'church' WHERE venue_type = 'venue' AND (
  LOWER(name) LIKE '%church%' OR
  LOWER(name) LIKE '%methodist%' OR
  LOWER(name) LIKE '%baptist%' OR
  LOWER(name) LIKE '%episcopal%' OR
  LOWER(name) LIKE '%cathedral%' OR
  name IN ('Birmingham United Methodist Church', 'Greenforest Community Baptist Church')
);

-- Stadiums/Arenas
UPDATE venues SET venue_type = 'stadium' WHERE venue_type = 'venue' AND (
  LOWER(name) LIKE '%stadium%' OR
  LOWER(name) LIKE '%arena%' OR
  LOWER(name) LIKE '%pavilion%' OR
  name IN ('Mercedes-Benz Stadium', 'Truist Park', 'McCamish Pavilion', 'Overtime Elite Arena',
           'Presence Arena', 'Van Andel Arena', 'GSU Convocation Center')
);

-- Concert halls / Performing arts
UPDATE venues SET venue_type = 'concert_hall' WHERE venue_type = 'venue' AND (
  LOWER(name) LIKE '%symphony%' OR
  LOWER(name) LIKE '%performing arts%' OR
  name IN ('Atlanta Symphony Hall', 'Symphony Hall', 'Cobb Energy Performing Arts Centre',
           'Schwartz Center For Performing Arts', 'John S. Burd Center For The Performing Arts')
);

-- Cinemas
UPDATE venues SET venue_type = 'cinema' WHERE venue_type = 'venue' AND (
  LOWER(name) LIKE '%cinema%' OR
  LOWER(name) LIKE '%cineplex%' OR
  name IN ('Aurora Cineplex', 'Area 51 - Aurora Cineplex And The Fringe Miniature Golf')
);

-- Museums
UPDATE venues SET venue_type = 'museum' WHERE venue_type = 'venue' AND (
  LOWER(name) LIKE '%museum%' OR
  LOWER(name) LIKE '%moda%' OR
  name IN ('Moda (Museum Of Design Atlanta)', 'National Center For Civil And Human Rights',
           'The Dekalb History Center')
);

-- Galleries
UPDATE venues SET venue_type = 'gallery' WHERE venue_type = 'venue' AND (
  LOWER(name) LIKE '%gallery%' OR
  LOWER(name) LIKE '%art %' OR
  name IN ('Emory Visual Arts Gallery', 'Atlanta Printmakers Studio', 'Callanwolde Fine Arts Center',
           'Mary Schmidt Campbell Center for Innovation a')
);

-- Hotels
UPDATE venues SET venue_type = 'hotel' WHERE venue_type = 'venue' AND (
  LOWER(name) LIKE '%hotel%' OR
  LOWER(name) LIKE '%waldorf%' OR
  LOWER(name) LIKE '%sonesta%' OR
  LOWER(name) LIKE '%marriott%' OR
  name IN ('Waldorf Astoria Atlanta Buckhead', 'Sonesta Atlanta Northwest Galleria')
);

-- Convention centers
UPDATE venues SET venue_type = 'convention_center' WHERE venue_type = 'venue' AND (
  LOWER(name) LIKE '%galleria centre%' OR
  LOWER(name) LIKE '%convention%' OR
  name IN ('Cobb Galleria Centre')
);

-- Restaurants
UPDATE venues SET venue_type = 'restaurant' WHERE venue_type = 'venue' AND (
  LOWER(name) LIKE '%steakhouse%' OR
  LOWER(name) LIKE '%grill%' OR
  LOWER(name) LIKE '%cafe%' OR
  LOWER(name) LIKE '%hard rock%' OR
  name IN ('Hard Rock Cafe - Atlanta', 'Enzo Steakhouse & Bar')
);

-- Recreation centers
UPDATE venues SET venue_type = 'recreation_center' WHERE venue_type = 'venue' AND (
  LOWER(name) LIKE '%recreation%' OR
  name IN ('Lang Carson Recreation Center', 'Tracey Wyatt Recreation Complex')
);

-- Cultural centers
UPDATE venues SET venue_type = 'cultural_center' WHERE venue_type = 'venue' AND (
  LOWER(name) LIKE '%cultural center%' OR
  LOWER(name) LIKE '%shrine%' OR
  name IN ('Shrine Cultural Center')
);

-- Libraries
UPDATE venues SET venue_type = 'library' WHERE venue_type = 'venue' AND (
  LOWER(name) LIKE '%library%' OR
  name IN ('Robert W. Woodruff Library, Auc', 'Fulton County Library System - Central Librar')
);

-- Golf courses
UPDATE venues SET venue_type = 'golf_course' WHERE venue_type = 'venue' AND (
  LOWER(name) LIKE '%golf%' OR
  name IN ('Turtle Cove Golf Course')
);

-- Event spaces (catch-all for remaining unclassified)
UPDATE venues SET venue_type = 'event_space' WHERE venue_type = 'venue' AND (
  LOWER(name) LIKE '%big top%' OR
  LOWER(name) LIKE '%cooking school%' OR
  name IN ('Under the Big Top - Atlanta', 'The Cooking School at Irwin Street', 'Bloom',
           'GoldFord', 'Jenovelle', 'Molly B''s Hospitality', 'Sunset Atlanta', 'District - GA',
           'Aurora Theatre – Metro Waterproofing Main Stage', 'Aurora Theatre &#8211; Metro Waterproofing Main Stage')
);

-- Sports teams (these are orgs, not venues - mark as inactive)
UPDATE venues SET active = false WHERE name IN (
  'Atlanta Braves', 'Atlanta United', 'Atlanta Hawks Bar Network', 'Atlanta United Pub Partners'
);

-- Test venues (mark as inactive)
UPDATE venues SET active = false WHERE LOWER(name) LIKE '%ticketmaster test%';

-- ============================================================================
-- PART 4: Update community_center typed venues
-- ============================================================================

-- Keep community centers as venues but ensure they have proper type
-- (they are physical locations, not organizations to migrate)

-- Done!
