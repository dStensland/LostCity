-- Migration 058: Add Gas South Arena
-- Created: 2026-01-26
-- Gas South Arena (formerly Infinite Energy Arena) hosts concerts, hockey (Atlanta Gladiators), and major events in Gwinnett County

INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active)
VALUES
    ('Gas South Arena', 'gas-south', 'https://www.gassouthdistrict.com/events', 'scrape', 'daily', true)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    source_type = EXCLUDED.source_type,
    crawl_frequency = EXCLUDED.crawl_frequency,
    is_active = EXCLUDED.is_active;
