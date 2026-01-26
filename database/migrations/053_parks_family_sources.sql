-- Migration 053: Add parks, trails, and family-friendly sources
-- Created: 2026-01-25
-- Adds crawlers for Trees Atlanta, libraries, Stone Mountain Park, and parks/rec departments

-- Trails & Outdoor Organizations (1)
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active)
VALUES
    ('Trees Atlanta', 'trees-atlanta', 'https://www.treesatlanta.org/get-involved/events/', 'scrape', 'weekly', true)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    source_type = EXCLUDED.source_type,
    crawl_frequency = EXCLUDED.crawl_frequency,
    is_active = EXCLUDED.is_active;

-- Libraries (2)
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active)
VALUES
    ('Gwinnett County Public Library', 'gwinnett-library', 'https://gwinnettpl.libnet.info/events', 'scrape', 'weekly', true),
    ('Cobb County Public Library', 'cobb-library', 'https://www.cobbcounty.gov/events?department=85', 'scrape', 'weekly', true)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    source_type = EXCLUDED.source_type,
    crawl_frequency = EXCLUDED.crawl_frequency,
    is_active = EXCLUDED.is_active;

-- Parks & Attractions (1)
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active)
VALUES
    ('Stone Mountain Park', 'stone-mountain-park', 'https://stonemountainpark.com/activities/events/', 'api', 'weekly', true)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    source_type = EXCLUDED.source_type,
    crawl_frequency = EXCLUDED.crawl_frequency,
    is_active = EXCLUDED.is_active;

-- Summary:
-- Trees Atlanta: Tree planting, nature walks, trail maintenance, volunteer events (1)
-- Gwinnett County Public Library: 15 library branches with storytimes, book clubs, educational programs (1)
-- Cobb County Public Library: 15 library branches with storytimes, book clubs, educational programs, kids activities (1)
-- Stone Mountain Park: 3,200-acre park with hiking, attractions, seasonal festivals (Yellow Daisy Festival, Christmas events, etc.) (1)
-- Atlanta Parks & Recreation: City parks programs, fitness classes, youth activities (1)
-- Total: 5 new sources
--
-- Notes:
-- - Trees Atlanta uses JavaScript rendering (requires Playwright)
-- - Events are typically free, family-friendly, outdoor/community focused
-- - Trees Atlanta tags: volunteer, outdoor, nature, free, family-friendly, trees, parks, walking
-- - Categories: sports, outdoor, community
--
-- - Gwinnett Library uses Communico events platform (requires Playwright, similar to DeKalb Library)
-- - All library events are free with 15 branches across Gwinnett County
-- - Tags include: library, free, family-friendly, kids, teens, adults, educational
-- - Categories: words (storytelling, book clubs), learning, art, music, film, fitness, play
--
-- - Cobb County Library uses custom Next.js site with event listing page
-- - 15 library branches across Cobb County (Marietta, Kennesaw, Mableton, Austell, Powder Springs)
-- - Events include storytimes, book clubs, computer classes, crafts, author talks
-- - All events are free
-- - Tags include: library, free, public, family-friendly, kids, teens, adults, educational
-- - Categories: words (storytelling, book clubs), learning, art, music, film, fitness, play
--
-- - Stone Mountain Park uses The Events Calendar API (WordPress plugin)
-- - Major family destination with festivals (Yellow Daisy Festival, Highland Games, Christmas)
-- - Attractions: Summit Skyride, zipline, laser shows, hiking trails
-- - Tags include: stone-mountain-park, family-friendly, outdoor, parks, hiking
-- - Categories: family, community, outdoors, music (laser shows)

-- Parks & Recreation Departments (1)
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active)
VALUES
    ('Atlanta Parks & Recreation', 'atlanta-parks-rec', 'https://www.atlantaga.gov/Home/Components/Calendar/Event/Index', 'scrape', 'weekly', true)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    source_type = EXCLUDED.source_type,
    crawl_frequency = EXCLUDED.crawl_frequency,
    is_active = EXCLUDED.is_active;

-- Atlanta Parks & Recreation Notes:
-- - Crawls Atlanta city calendar and filters for parks/recreation events
-- - City operates 300+ parks, 17 recreation centers, aquatic centers
-- - Events: fitness classes, youth programs, sports leagues, senior activities
-- - Major parks: Piedmont Park, Grant Park, Chastain Park
-- - Tags: parks, recreation, community, free, family-friendly, fitness, sports
-- - Categories: community, sports, family
