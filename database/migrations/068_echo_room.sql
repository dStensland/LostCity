-- Add Echo Room source
INSERT INTO sources (name, slug, source_type, url, crawl_frequency, is_active)
VALUES (
    'Echo Room',
    'echo-room',
    'scrape',
    'https://www.songkick.com/venues/3586926-echo-room',
    'daily',
    true
) ON CONFLICT (slug) DO UPDATE SET
    url = EXCLUDED.url,
    is_active = EXCLUDED.is_active;
