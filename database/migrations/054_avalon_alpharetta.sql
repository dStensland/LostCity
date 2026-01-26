-- Migration 054: Add Avalon in Alpharetta
-- Created: 2026-01-26
-- Adds crawler for Avalon mixed-use shopping/entertainment district in Alpharetta

INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active)
VALUES
    ('Avalon', 'avalon-alpharetta', 'https://experienceavalon.com/events/', 'scrape', 'weekly', true)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    source_type = EXCLUDED.source_type,
    crawl_frequency = EXCLUDED.crawl_frequency,
    is_active = EXCLUDED.is_active;

-- Summary:
-- Avalon is a premier mixed-use destination in Alpharetta with 500K+ sq ft of retail,
-- restaurants, entertainment, and residential. Located at 2200 Avalon Blvd.
--
-- Event Types:
-- - Concerts on the green (live music)
-- - Seasonal events (holiday lights, ice skating)
-- - Markets and pop-ups (makers markets, fashion)
-- - Family events (kids activities, celebrations)
-- - Community gatherings (Galentine's Day, Mardi Gras, St. Patrick's Day)
--
-- Technical Notes:
-- - Static HTML site with event-item divs (no JavaScript rendering needed)
-- - Events page: https://experienceavalon.com/events/
-- - Individual event pages have more detail (times, descriptions, tickets)
-- - Date format: Month abbreviation + day (Jul 28, Jan 15, etc.)
-- - Date ranges supported with start/end dates
-- - Images available via data-src attributes
--
-- Tags: avalon, alpharetta, shopping, mixed-use, concerts, markets, family, seasonal
-- Categories: music, community, family, food_drink
-- Coordinates: 34.0708, -84.2752
