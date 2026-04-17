-- MIGRATION: Deactivate dead Chastain source + register Day & Night Projects
--
-- Chastain Arts Center (chastainartscenter.org) has DNS failure — domain no
-- longer resolves. Source is active but producing 0 results every crawl run.
-- The OCA facility still exists but may have moved to a different domain.
--
-- Day & Night Projects has a production-ready crawler file
-- (crawlers/sources/day_night_projects.py) but no source registration.

-- Deactivate Chastain source (DNS dead)
UPDATE sources SET is_active = false
WHERE slug = 'chastain-arts-center';

-- Register Day & Night Projects source
INSERT INTO sources (slug, name, url, source_type, is_active, owner_portal_id)
VALUES (
    'day-and-night-projects',
    'Day & Night Projects',
    'https://www.dayandnightprojects.com',
    'scrape',
    true,
    NULL
)
ON CONFLICT (slug) DO UPDATE SET is_active = true;
