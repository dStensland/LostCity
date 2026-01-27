-- Add PushPush Arts as a crawl source
INSERT INTO sources (name, slug, source_type, url, is_active, owner_portal_id)
VALUES (
    'PushPush Arts',
    'pushpush-arts',
    'venue_calendar',
    'https://www.pushpusharts.com/calendar',
    true,
    (SELECT id FROM portals WHERE slug = 'atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    is_active = true;

-- Update venue name and info
UPDATE venues SET
    name = 'PushPush Arts',
    address = '1805 Harvard Ave',
    neighborhood = 'College Park',
    city = 'College Park',
    zip = '30337',
    website = 'https://www.pushpusharts.com'
WHERE slug = 'pushpush-theater';
