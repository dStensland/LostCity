-- Add Brake Pad source
INSERT INTO sources (name, slug, source_type, url, crawl_frequency, is_active)
VALUES (
    'Brake Pad',
    'brake-pad',
    'scrape',
    'https://www.brakepadatlanta.com/events',
    'daily',
    true
) ON CONFLICT (slug) DO UPDATE SET
    url = EXCLUDED.url,
    is_active = EXCLUDED.is_active;
