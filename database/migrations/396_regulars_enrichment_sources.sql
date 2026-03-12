-- Regulars Content Enrichment: activate new venue sources, deactivate closed venues
-- Part of the Regulars tab content expansion to ~200+ events/week

-- Atlanta portal UUID
DO $$
DECLARE
    atlanta_portal_id UUID := '74c2f211-ee11-453d-8386-ac2861705695';
BEGIN

-- ==========================================================
-- NEW SOURCES: 7 new venue crawlers (5 recurring-only + 2 district scrapers)
-- ==========================================================

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency, owner_portal_id)
VALUES
    ('eclipse-di-luna', 'Eclipse di Luna', 'https://www.eclipsediluna.com', 'venue', true, 'daily', atlanta_portal_id),
    ('grant-park-social', 'Grant Park Social', 'https://www.grantparksocial.com', 'venue', true, 'daily', atlanta_portal_id),
    ('breaker-breaker', 'Breaker Breaker', 'https://www.breakerbreakerbar.com', 'venue', true, 'daily', atlanta_portal_id),
    ('painted-park', 'Painted Park', 'https://www.paintedpark.com', 'venue', true, 'daily', atlanta_portal_id),
    ('wylie-and-rum', 'Wylie & Rum', 'https://www.wylieandrum.com', 'venue', true, 'daily', atlanta_portal_id),
    ('the-works', 'The Works Atlanta', 'https://theworksatl.com', 'venue', true, 'daily', atlanta_portal_id),
    ('buckhead-village', 'Buckhead Village District', 'https://www.buckheadvillagedistrict.com', 'venue', true, 'daily', atlanta_portal_id)
ON CONFLICT (slug) DO UPDATE SET
    is_active = true,
    owner_portal_id = atlanta_portal_id;

-- ==========================================================
-- DEACTIVATE: Permanently closed venues
-- ==========================================================

-- Sound Table — now Pisces
UPDATE sources SET is_active = false WHERE slug = 'sound-table';

-- Eventide Brewing — closed Aug 2024
UPDATE sources SET is_active = false WHERE slug = 'eventide-brewing';

-- Noni's Bar & Deli — closed Oct 2023
UPDATE sources SET is_active = false WHERE slug = 'nonis';

-- Mother Bar — now Iconz
UPDATE sources SET is_active = false WHERE slug = 'mother-bar';

-- Watchman's Seafood & Spirits — closed 2022
UPDATE sources SET is_active = false WHERE slug = 'watchmans';

END $$;
