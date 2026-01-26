-- Migration 052: Add university and community center sources
-- Created: 2026-01-25
-- Adds crawlers for Georgia Tech Arts, Emory Schwartz Center, GSU events, and YMCA Atlanta

-- Universities & Arts Centers (3)
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active)
VALUES
    ('Georgia Tech Arts', 'georgia-tech-arts', 'https://arts.gatech.edu/events', 'scrape', 'daily', true),
    ('Emory Schwartz Center', 'emory-schwartz-center', 'https://schwartz.emory.edu/events-tickets/calendar.html', 'scrape', 'daily', true),
    ('Georgia State University', 'georgia-state-university', 'https://calendar.gsu.edu', 'api', 'daily', true)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    source_type = EXCLUDED.source_type,
    crawl_frequency = EXCLUDED.crawl_frequency,
    is_active = EXCLUDED.is_active;

-- Community Centers (1)
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active)
VALUES
    ('YMCA of Metro Atlanta', 'ymca-atlanta', 'https://ymcaatlanta.org/events', 'scrape', 'weekly', true)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    source_type = EXCLUDED.source_type,
    crawl_frequency = EXCLUDED.crawl_frequency,
    is_active = EXCLUDED.is_active;

-- Summary:
-- Universities: Georgia Tech Arts, Emory Schwartz Center, GSU (3)
-- Community Centers: YMCA Atlanta (1)
-- Total: 4 new sources
--
-- Notes:
-- - GSU uses Localist API (excellent structured data)
-- - Georgia Tech Arts and Schwartz Center use Playwright for JS rendering
-- - YMCA uses Drupal-based calendar with Playwright
