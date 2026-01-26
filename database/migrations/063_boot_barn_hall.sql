-- Migration 063: Add Boot Barn Hall (The Hall)
-- Created: 2026-01-26
-- Boot Barn Hall (The Hall) is a country music venue and event space in Gainesville, GA

INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active)
VALUES
    ('Boot Barn Hall at The Hall', 'boot-barn-hall', 'https://www.thehallga.com/calendar', 'scrape', 'daily', true)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    source_type = EXCLUDED.source_type,
    crawl_frequency = EXCLUDED.crawl_frequency,
    is_active = EXCLUDED.is_active;
