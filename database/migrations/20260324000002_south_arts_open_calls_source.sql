-- Register South Arts as an open calls source for the Arts portal.
-- South Arts is a regional arts council covering 13 Southern states (AL, AR, FL,
-- GA, KY, LA, MI, MS, NC, SC, TN, VA, WV). They post their own grants and
-- opportunities directly, making them a verified (not aggregated) source.
--
-- Crawl frequency: weekly — South Arts typically posts new cycles monthly,
-- but deadlines shift and new programs appear at any time.

INSERT INTO sources (name, slug, url, source_type, integration_method, owner_portal_id, is_active)
VALUES (
    'South Arts (Open Calls)',
    'open-calls-south-arts',
    'https://www.southarts.org/grants-opportunities',
    'organization',
    'html',
    (SELECT id FROM portals WHERE slug = 'arts-atlanta'),
    true
)
ON CONFLICT (slug) DO UPDATE
    SET url            = EXCLUDED.url,
        owner_portal_id = EXCLUDED.owner_portal_id,
        is_active      = EXCLUDED.is_active;
