-- Migration: Dos Caminos Venue
--
-- Keep this file mirrored in database/migrations and supabase/migrations.
-- Update database/schema.sql in the same change set when schema changes are involved.
--
-- Registers Dos Caminos (Midtown Atlanta) as a venue and inactive source.
-- Opened January 27, 2026. No crawlable events page; source marked inactive
-- with integration_method=none until an event feed becomes available.

-- Venue record
INSERT INTO venues (
    name,
    slug,
    address,
    neighborhood,
    city,
    state,
    zip,
    lat,
    lng,
    venue_type,
    spot_type,
    website,
    cuisine,
    description,
    vibes
)
VALUES (
    'Dos Caminos',
    'dos-caminos-midtown',
    '1100 Peachtree St NE',
    'Midtown',
    'Atlanta',
    'GA',
    '30309',
    33.7857,
    -84.3834,
    'restaurant',
    'restaurant',
    'https://doscaminos.com',
    ARRAY['Mexican'],
    'Upscale Mexican restaurant with 400+ seats and private dining. Known for being voted #1 Margarita in NYC three consecutive years. Mexico City-inspired design with Atlanta-exclusive cocktails. Happy hour Mon-Fri 3-5pm, Sunday brunch 11am-3pm.',
    ARRAY['upscale-mexican', 'craft-cocktails', 'date-night', 'brunch', 'happy-hour', 'large-groups']
)
ON CONFLICT (slug) DO NOTHING;

-- Source record (inactive — no crawlable events page)
INSERT INTO sources (
    slug,
    name,
    url,
    source_type,
    is_active,
    integration_method,
    owner_portal_id
)
VALUES (
    'dos-caminos-midtown',
    'Dos Caminos',
    'https://doscaminos.com',
    'venue',
    false,
    'none',
    (SELECT id FROM portals WHERE slug = 'atlanta')
)
ON CONFLICT (slug) DO NOTHING;
