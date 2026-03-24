-- Register Fulton County Arts & Culture (CFS) as an open calls source for the Arts portal.
-- The Contracts for Services program is Fulton County's primary arts funding initiative,
-- awarding $1,000–$50,000 to individual artists, nonprofits, schools, and municipalities.
-- Next cycle expected late fall 2026; crawler handles off-cycle periods gracefully.

INSERT INTO sources (name, slug, url, source_type, integration_method, owner_portal_id, is_active)
VALUES (
    'Fulton County Arts & Culture (Open Calls)',
    'open-calls-fulton-arts',
    'https://www.fultonarts.org/contract-for-services',
    'organization',
    'html',
    (SELECT id FROM portals WHERE slug = 'arts-atlanta'),
    true
)
ON CONFLICT (slug) DO UPDATE
    SET url = EXCLUDED.url,
        owner_portal_id = EXCLUDED.owner_portal_id,
        is_active = EXCLUDED.is_active;
