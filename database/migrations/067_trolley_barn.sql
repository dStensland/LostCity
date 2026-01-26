-- Add Trolley Barn source
INSERT INTO sources (name, slug, source_type, url, crawl_frequency, is_active)
VALUES (
    'Trolley Barn',
    'trolley-barn',
    'scrape',
    'https://trolleybarn.org',
    'daily',
    true
) ON CONFLICT (slug) DO UPDATE SET
    url = EXCLUDED.url,
    is_active = EXCLUDED.is_active;
