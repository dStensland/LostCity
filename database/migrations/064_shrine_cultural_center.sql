-- Add Shrine Cultural Center source
INSERT INTO sources (name, slug, source_type, url, crawl_frequency, is_active)
VALUES (
    'Shrine Cultural Center',
    'shrine-cultural-center',
    'scrape',
    'https://www.eventbrite.com/o/shrine-cultural-center-51764997263',
    'daily',
    true
) ON CONFLICT (slug) DO UPDATE SET
    url = EXCLUDED.url,
    is_active = EXCLUDED.is_active;
