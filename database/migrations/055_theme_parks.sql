-- Migration 055: Add theme parks and water parks
-- Created: 2026-01-25
-- Adds Six Flags Over Georgia and White Water

-- Theme Parks & Water Parks (1 source, 2 venues)
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active)
VALUES
    ('Six Flags Over Georgia', 'six-flags-over-georgia', 'https://www.sixflags.com/overgeorgia/events', 'scrape', 'weekly', true)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    source_type = EXCLUDED.source_type,
    crawl_frequency = EXCLUDED.crawl_frequency,
    is_active = EXCLUDED.is_active;

-- Summary:
-- Six Flags Over Georgia: Major theme park with seasonal festivals, concerts, and special events (1 source)
--
-- Venues included:
-- - Six Flags Over Georgia (275 Riverside Pkwy SW, Austell, GA 30168)
--   Primary theme park with roller coasters, rides, and attractions
--
-- - White Water (250 Cobb Pkwy N, Marietta, GA 30062)
--   Water park operated by Six Flags Entertainment Corporation
--
-- Event Types:
-- - Seasonal Festivals: Fright Fest (fall/Halloween), Holiday in the Park (winter)
-- - Educational: Education Days (school groups)
-- - Music: Music in the Parks (band/orchestra/choir competitions)
-- - Graduation: Grad Nite (high school graduations)
-- - Holiday Events: Memorial Day, Fourth of July, Labor Day celebrations
-- - Concert Series: Various live music performances throughout the season
--
-- Notes:
-- - Uses Playwright to render dynamic Next.js content
-- - Events require park admission (not free)
-- - Most events are all-day experiences
-- - Seasonal events like Fright Fest and Holiday in the Park span multiple dates
-- - Crawler handles complex date formats: "April 11, 17, 18, 24, & 25, and May 1, 2, & 9, 2026"
-- - Tags include: six-flags, theme-park, family-friendly, rides, roller-coasters, outdoor
-- - Categories: family, music
-- - Subcategories: festival, concert, educational, graduation, holiday
--
-- Crawl Strategy:
-- - Primary source: https://www.sixflags.com/overgeorgia/events
-- - Scrapes article elements containing event information
-- - Fetches individual event detail pages for descriptions
-- - Creates separate event records for each date in multi-date events
--
-- Coverage:
-- - Year-round special events and seasonal festivals
-- - School group events (spring season)
-- - Summer concert series
-- - Fall Halloween events (September-October)
-- - Winter holiday events (November-December)
