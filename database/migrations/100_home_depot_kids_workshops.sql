-- Add Home Depot Kids Workshops source
-- Free monthly workshops for kids ages 5-12 at Atlanta-area Home Depot stores

INSERT INTO sources (slug, name, url, is_active, source_type, crawl_frequency)
VALUES (
    'home-depot-kids-workshops',
    'Home Depot Kids Workshops',
    'https://www.homedepot.com/workshops/',
    true,
    'venue',
    'monthly'
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    is_active = EXCLUDED.is_active,
    source_type = EXCLUDED.source_type,
    crawl_frequency = EXCLUDED.crawl_frequency;
