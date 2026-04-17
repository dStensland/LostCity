-- Register Burnaway Open Calls as a source for the Arts portal.
-- Burnaway is an Atlanta-based art publication covering the American South.
-- Their monthly Call for Artists roundups aggregate residencies, grants,
-- exhibition submissions, and fellowships — primarily for Southern artists.

INSERT INTO sources (name, slug, url, source_type, integration_method, owner_portal_id, is_active)
VALUES (
    'Burnaway Open Calls',
    'open-calls-burnaway',
    'https://burnaway.org/daily/call-for-artists/',
    'organization',
    'html',
    (SELECT id FROM portals WHERE slug = 'arts-atlanta'),
    true
)
ON CONFLICT (slug) DO UPDATE
    SET url = EXCLUDED.url,
        owner_portal_id = EXCLUDED.owner_portal_id,
        is_active = EXCLUDED.is_active;
