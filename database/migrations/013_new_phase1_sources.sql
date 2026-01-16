-- ============================================
-- MIGRATION 013: New Phase 1 Sources
-- ============================================
-- Adds event sources from gap analysis:
-- 1. The Masquerade (legendary multi-room music venue)
-- 2. Fox Theatre (historic Midtown theater)
-- 3. The Tabernacle (Downtown concert venue)
-- 4. Variety Playhouse (Little Five Points music venue)
-- 5. Monday Night Brewing (brewery with events)
-- 6. Atlanta Pride (LGBTQ+ organization)
-- 7. Alliance Theatre (flagship theater company)
-- 8. Creative Loafing (local events aggregator)

-- The Masquerade
INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'the-masquerade',
    'The Masquerade',
    'https://www.masqueradeatlanta.com/events/',
    'website',
    true,
    'daily'
)
ON CONFLICT (slug) DO NOTHING;

-- Fox Theatre
INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'fox-theatre',
    'Fox Theatre',
    'https://www.foxtheatre.org/events',
    'website',
    true,
    'daily'
)
ON CONFLICT (slug) DO NOTHING;

-- The Tabernacle
INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'tabernacle',
    'The Tabernacle',
    'https://www.tabernacleatl.com/shows',
    'website',
    true,
    'daily'
)
ON CONFLICT (slug) DO NOTHING;

-- Variety Playhouse (may already exist, update URL if needed)
INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'variety-playhouse',
    'Variety Playhouse',
    'https://www.variety-playhouse.com/calendar/',
    'website',
    true,
    'daily'
)
ON CONFLICT (slug) DO UPDATE SET
    url = EXCLUDED.url,
    is_active = true;

-- Monday Night Brewing
INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'monday-night',
    'Monday Night Brewing',
    'https://mondaynightbrewing.com/category/events/',
    'website',
    true,
    'daily'
)
ON CONFLICT (slug) DO NOTHING;

-- Atlanta Pride
INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'atlanta-pride',
    'Atlanta Pride',
    'https://atlantapride.org/events-page/',
    'organization',
    true,
    'weekly'
)
ON CONFLICT (slug) DO NOTHING;

-- Alliance Theatre
INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'alliance-theatre',
    'Alliance Theatre',
    'https://www.alliancetheatre.org/season/',
    'website',
    true,
    'weekly'
)
ON CONFLICT (slug) DO NOTHING;

-- Creative Loafing (may already exist, update URL if needed)
INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'creative-loafing',
    'Creative Loafing',
    'https://creativeloafing.com/atlanta-events',
    'aggregator',
    true,
    'daily'
)
ON CONFLICT (slug) DO UPDATE SET
    url = EXCLUDED.url,
    source_type = 'aggregator',
    is_active = true;

-- ============================================
-- Add Venues
-- ============================================

-- The Masquerade
INSERT INTO venues (slug, name, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'the-masquerade',
    'The Masquerade',
    '50 Lower Alabama St SW #110',
    'Downtown',
    'Atlanta',
    'GA',
    '30303',
    'music_venue',
    'https://www.masqueradeatlanta.com'
)
ON CONFLICT (slug) DO NOTHING;

-- Fox Theatre
INSERT INTO venues (slug, name, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'fox-theatre',
    'Fox Theatre',
    '660 Peachtree St NE',
    'Midtown',
    'Atlanta',
    'GA',
    '30308',
    'theater',
    'https://www.foxtheatre.org'
)
ON CONFLICT (slug) DO NOTHING;

-- The Tabernacle
INSERT INTO venues (slug, name, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'tabernacle',
    'The Tabernacle',
    '152 Luckie St NW',
    'Downtown',
    'Atlanta',
    'GA',
    '30303',
    'music_venue',
    'https://www.tabernacleatl.com'
)
ON CONFLICT (slug) DO NOTHING;

-- Variety Playhouse
INSERT INTO venues (slug, name, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'variety-playhouse',
    'Variety Playhouse',
    '1099 Euclid Ave NE',
    'Little Five Points',
    'Atlanta',
    'GA',
    '30307',
    'music_venue',
    'https://www.variety-playhouse.com'
)
ON CONFLICT (slug) DO NOTHING;

-- Monday Night Garage (West End location)
INSERT INTO venues (slug, name, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'monday-night-garage',
    'Monday Night Garage',
    '933 Lee St SW',
    'West End',
    'Atlanta',
    'GA',
    '30310',
    'brewery',
    'https://mondaynightbrewing.com'
)
ON CONFLICT (slug) DO NOTHING;

-- Monday Night Brewing West Midtown
INSERT INTO venues (slug, name, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'monday-night-west-midtown',
    'Monday Night Brewing West Midtown',
    '670 Trabert Ave NW',
    'Westside',
    'Atlanta',
    'GA',
    '30318',
    'brewery',
    'https://mondaynightbrewing.com'
)
ON CONFLICT (slug) DO NOTHING;

-- Atlanta Pride (organization venue)
INSERT INTO venues (slug, name, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'atlanta-pride',
    'Atlanta Pride',
    '1530 DeKalb Ave NE',
    'Candler Park',
    'Atlanta',
    'GA',
    '30307',
    'organization',
    'https://atlantapride.org'
)
ON CONFLICT (slug) DO NOTHING;

-- Piedmont Park (for Pride events)
INSERT INTO venues (slug, name, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'piedmont-park',
    'Piedmont Park',
    '1320 Monroe Dr NE',
    'Midtown',
    'Atlanta',
    'GA',
    '30306',
    'park',
    'https://piedmontpark.org'
)
ON CONFLICT (slug) DO NOTHING;

-- Alliance Theatre
INSERT INTO venues (slug, name, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'alliance-theatre',
    'Alliance Theatre',
    '1280 Peachtree St NE',
    'Midtown',
    'Atlanta',
    'GA',
    '30309',
    'theater',
    'https://www.alliancetheatre.org'
)
ON CONFLICT (slug) DO NOTHING;
