-- Add Mary's as a crawl source (schedule-based recurring events)
INSERT INTO sources (name, slug, source_type, url, is_active, owner_portal_id)
VALUES (
    'Mary''s',
    'marys',
    'venue_calendar',
    'https://www.instagram.com/marysatl/',
    true,
    (SELECT id FROM portals WHERE slug = 'atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    is_active = true;
