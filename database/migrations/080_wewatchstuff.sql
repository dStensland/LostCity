-- Migration 080: Add WeWatchStuff and Encyclomedia
-- WeWatchStuff is an Atlanta community film screening club
-- Encyclomedia is a video production studio in Candler Park that hosts screenings

-- ===== SOURCES =====

-- WeWatchStuff (community film screening organization)
INSERT INTO sources (
    name,
    slug,
    url,
    source_type,
    crawl_schedule,
    is_active
) VALUES (
    'WeWatchStuff',
    'wewatchstuff',
    'https://linktr.ee/wewatchstuff',
    'organization',
    'weekly',
    true
) ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    source_type = EXCLUDED.source_type,
    is_active = EXCLUDED.is_active;

-- ===== VENUES =====

-- WeWatchStuff (organization venue)
INSERT INTO venues (
    name,
    slug,
    city,
    state,
    neighborhood,
    venue_type,
    spot_type,
    website,
    vibes,
    is_event_venue
) VALUES (
    'WeWatchStuff',
    'wewatchstuff',
    'Atlanta',
    'GA',
    'Atlanta',
    'organization',
    'nonprofit',
    'https://linktr.ee/wewatchstuff',
    ARRAY['film', 'community', 'free', 'social'],
    true
) ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    city = EXCLUDED.city,
    state = EXCLUDED.state,
    neighborhood = EXCLUDED.neighborhood,
    venue_type = EXCLUDED.venue_type,
    spot_type = EXCLUDED.spot_type,
    website = EXCLUDED.website,
    vibes = EXCLUDED.vibes,
    is_event_venue = EXCLUDED.is_event_venue;

-- Encyclomedia (video production studio / screening venue)
INSERT INTO venues (
    name,
    slug,
    address,
    city,
    state,
    zip,
    neighborhood,
    venue_type,
    spot_type,
    website,
    lat,
    lng,
    vibes,
    is_event_venue
) VALUES (
    'Encyclomedia',
    'encyclomedia',
    '1526 DeKalb Ave NE',
    'Atlanta',
    'GA',
    '30307',
    'Candler Park',
    'studio',
    'arts',
    'https://encyclomedia.net',
    33.7550,
    -84.3380,
    ARRAY['film', 'artsy', 'creative', 'intimate'],
    true
) ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    city = EXCLUDED.city,
    state = EXCLUDED.state,
    zip = EXCLUDED.zip,
    neighborhood = EXCLUDED.neighborhood,
    venue_type = EXCLUDED.venue_type,
    spot_type = EXCLUDED.spot_type,
    website = EXCLUDED.website,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    vibes = EXCLUDED.vibes,
    is_event_venue = EXCLUDED.is_event_venue;
