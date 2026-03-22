-- Migration: Lionheart Theatre Source Registration
--
-- Keep this file mirrored in database/migrations and supabase/migrations.
-- Update database/schema.sql in the same change set when schema changes are involved.

-- Venue: Lionheart Theatre Company (Norcross, GA)
INSERT INTO venues (
    name, slug, address, neighborhood, city, state, zip,
    lat, lng, venue_type, spot_type, website,
    description, vibes, active
)
SELECT
    'Lionheart Theatre Company',
    'lionheart-theatre',
    '10 College St NW',
    'Downtown Norcross',
    'Norcross',
    'GA',
    '30071',
    33.9421,
    -84.2110,
    'theater',
    'theater',
    'https://lionhearttheatre.org',
    'Award-winning community theatre in a restored 1877 church in historic downtown Norcross. Oldest operating community theatre in Gwinnett County. Presents a full season of comedies, dramas, and musicals in an intimate historic setting.',
    ARRAY['theater', 'community-theater', 'historic', 'family-friendly'],
    true
WHERE NOT EXISTS (
    SELECT 1 FROM venues WHERE slug = 'lionheart-theatre'
);

-- Source: Lionheart Theatre Company
INSERT INTO sources (
    name, slug, url, source_type, crawl_frequency,
    is_active, owner_portal_id, integration_method, expected_event_count
)
SELECT
    'Lionheart Theatre Company',
    'lionheart-theatre',
    'https://lionhearttheatre.org/2026-season/',
    'venue',
    'weekly',
    true,
    p.id,
    'html',
    8
FROM portals p WHERE p.slug = 'atlanta'
AND NOT EXISTS (
    SELECT 1 FROM sources WHERE slug = 'lionheart-theatre'
);
