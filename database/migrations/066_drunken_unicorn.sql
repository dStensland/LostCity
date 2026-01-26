-- Migration 066: Add The Drunken Unicorn venue
-- Created: 2026-01-26
-- Legendary dive bar and music venue in Little Five Points (via Songkick)

INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active)
VALUES
    ('The Drunken Unicorn', 'drunken-unicorn', 'https://www.songkick.com/venues/3517036-drunken-unicorn', 'scrape', 'daily', true)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    source_type = EXCLUDED.source_type,
    crawl_frequency = EXCLUDED.crawl_frequency,
    is_active = EXCLUDED.is_active;

-- The Drunken Unicorn Notes:
-- - Iconic dive bar and music venue at 736 Ponce De Leon Ave NE in Little Five Points
-- - No official website, so we crawl their Songkick venue page
-- - Known for indie rock, punk, alternative, and underground music
-- - Intimate venue with a gritty, authentic dive bar atmosphere
-- - Popular with local music scene and touring indie/punk bands
-- - Events typically have cover charges at the door
-- - Categories: music, nightlife
-- - Subcategory: concert
-- - Tags: music, concert, little-five-points, dive-bar, indie, punk, alternative, live-music
-- - Songkick page lists all upcoming shows with dates and artist info
-- - Crawl uses Playwright to render JavaScript-based Songkick page
