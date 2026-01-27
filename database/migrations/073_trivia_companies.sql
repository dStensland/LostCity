-- ============================================
-- MIGRATION 073: Add Trivia Companies as Event Producers
-- ============================================
-- Adding major Atlanta-area trivia companies as event producers
-- These run weekly trivia nights at bars/restaurants across the metro
-- ============================================

-- ============================================
-- 1. CREATE EVENT PRODUCER RECORDS
-- ============================================

-- Team Trivia (100+ venues, metro-wide)
INSERT INTO event_producers (id, name, slug, org_type, website, city, categories, description)
VALUES (
    'team-trivia',
    'Team Trivia',
    'team-trivia',
    'entertainment_company',
    'https://www.teamtrivia.com',
    'Atlanta',
    ARRAY['trivia', 'nightlife', 'games'],
    'Providing trivia games for bars and restaurants across metro Atlanta since 1987. Offers Team Trivia, Team Feud, Soundcheck Music Bingo, and traditional Bingo at 100+ locations.'
)
ON CONFLICT (id) DO UPDATE SET
    website = EXCLUDED.website,
    categories = EXCLUDED.categories,
    description = EXCLUDED.description;

-- Dirty South Trivia (~40 ITP venues)
INSERT INTO event_producers (id, name, slug, org_type, website, city, categories, description)
VALUES (
    'dirty-south-trivia',
    'Dirty South Trivia',
    'dirty-south-trivia',
    'entertainment_company',
    'https://www.dirtysouthtrivia.com',
    'Atlanta',
    ARRAY['trivia', 'nightlife', 'games'],
    'Atlanta''s best trivia voted by Creative Loafing and Atlanta Magazine. ITP-focused with Pub Quiz, themed trivia (Sex, Drugs & Music), and Music Bingo at bars across intown Atlanta and Athens.'
)
ON CONFLICT (id) DO UPDATE SET
    website = EXCLUDED.website,
    categories = EXCLUDED.categories,
    description = EXCLUDED.description;

-- Geeks Who Drink (7 Atlanta-area venues)
INSERT INTO event_producers (id, name, slug, org_type, website, city, categories, description)
VALUES (
    'geeks-who-drink',
    'Geeks Who Drink',
    'geeks-who-drink',
    'entertainment_company',
    'https://www.geekswhodrink.com',
    'Atlanta',
    ARRAY['trivia', 'nightlife', 'games'],
    'National pub quiz franchise with 7 Atlanta-area locations. Known for their flagship GWD Classic trivia, Small Batch Trivia, and official Jeopardy! Bar League (JBL) games.'
)
ON CONFLICT (id) DO UPDATE SET
    website = EXCLUDED.website,
    categories = EXCLUDED.categories,
    description = EXCLUDED.description;

-- Outspoken Entertainment (105 suburban locations)
INSERT INTO event_producers (id, name, slug, org_type, website, city, categories, description)
VALUES (
    'outspoken-entertainment',
    'Outspoken Entertainment',
    'outspoken-entertainment',
    'entertainment_company',
    'https://www.outspokenentertainment.com',
    'Atlanta',
    ARRAY['trivia', 'nightlife', 'games', 'karaoke'],
    'Atlanta pub trivia gurus since 2000. Provides trivia, music bingo, karaoke, and private events at 105+ locations across metro Atlanta suburbs.'
)
ON CONFLICT (id) DO UPDATE SET
    website = EXCLUDED.website,
    categories = EXCLUDED.categories,
    description = EXCLUDED.description;

-- ============================================
-- 2. CREATE CRAWL SOURCES FOR EACH COMPANY
-- ============================================

-- Team Trivia source
INSERT INTO sources (name, slug, source_type, url, is_active, owner_portal_id)
VALUES (
    'Team Trivia',
    'team-trivia',
    'organization_calendar',
    'https://www.teamtrivia.com/locations/',
    true,
    (SELECT id FROM portals WHERE slug = 'atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    is_active = true;

-- Dirty South Trivia source
INSERT INTO sources (name, slug, source_type, url, is_active, owner_portal_id)
VALUES (
    'Dirty South Trivia',
    'dirty-south-trivia',
    'organization_calendar',
    'https://www.dirtysouthtrivia.com/',
    true,
    (SELECT id FROM portals WHERE slug = 'atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    is_active = true;

-- Geeks Who Drink source
INSERT INTO sources (name, slug, source_type, url, is_active, owner_portal_id)
VALUES (
    'Geeks Who Drink',
    'geeks-who-drink',
    'organization_calendar',
    'https://www.geekswhodrink.com/venues/?location=Atlanta%2C+GA',
    true,
    (SELECT id FROM portals WHERE slug = 'atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    is_active = true;

-- Outspoken Entertainment source
INSERT INTO sources (name, slug, source_type, url, is_active, owner_portal_id)
VALUES (
    'Outspoken Entertainment',
    'outspoken-entertainment',
    'organization_calendar',
    'https://www.outspokenentertainment.com/wheretoplay',
    true,
    (SELECT id FROM portals WHERE slug = 'atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    is_active = true;

-- ============================================
-- 3. ADD TRIVIA-RELATED TAGS IF NOT EXISTS
-- ============================================
-- Note: Tags are typically managed elsewhere, but documenting recommended tags:
-- trivia, pub-quiz, music-bingo, geek-trivia, team-feud
