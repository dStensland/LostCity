-- Migration: Art Farm Serenbe Source Registration
--
-- Keep this file mirrored in database/migrations and supabase/migrations.
-- Update database/schema.sql in the same change set when schema changes are involved.

-- Venue: Art Farm at Serenbe (Chattahoochee Hills, GA)
INSERT INTO venues (
    name, slug, address, neighborhood, city, state, zip,
    lat, lng, venue_type, spot_type, website,
    description, vibes, is_active
)
SELECT
    'Art Farm at Serenbe',
    'art-farm-serenbe',
    '10950 Hutchesons Ferry Rd',
    'Serenbe',
    'Chattahoochee Hills',
    'GA',
    '30268',
    33.4467,
    -84.7267,
    'theater',
    'theater',
    'https://www.artfarmatserenbe.org',
    'Multi-disciplinary arts organization in the Serenbe community. Presents immersive outdoor theater, dance, film, and intimate performances in natural settings. Successor to Serenbe Playhouse.',
    ARRAY['theater', 'performing-arts', 'outdoor', 'immersive', 'nature'],
    true
WHERE NOT EXISTS (
    SELECT 1 FROM venues WHERE slug = 'art-farm-serenbe'
);

-- Source: Art Farm at Serenbe
INSERT INTO sources (
    name, slug, url, source_type, crawl_frequency,
    is_active, owner_portal_id, integration_method, expected_event_count
)
SELECT
    'Art Farm at Serenbe',
    'art-farm-serenbe',
    'https://www.artfarmatserenbe.org/events',
    'venue',
    'weekly',
    true,
    p.id,
    'html',
    10
FROM portals p WHERE p.slug = 'atlanta'
AND NOT EXISTS (
    SELECT 1 FROM sources WHERE slug = 'art-farm-serenbe'
);
