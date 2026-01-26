-- Migration: Add Freeside Atlanta source and venue
-- Freeside is an Atlanta hackerspace that hosts events via Meetup

-- Add the source
INSERT INTO sources (slug, name, url, is_active, category, description)
VALUES (
    'freeside-atlanta',
    'Freeside Atlanta',
    'https://www.meetup.com/freeside-atlanta/',
    TRUE,
    'community',
    'Atlanta hackerspace and makerspace hosting tech meetups, workshops, and maker events'
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    is_active = EXCLUDED.is_active,
    category = EXCLUDED.category,
    description = EXCLUDED.description;

-- Add the venue
INSERT INTO venues (slug, name, address, city, state, spot_type, vibes, is_event_venue)
VALUES (
    'freeside-atlanta',
    'Freeside Atlanta',
    '675 Metropolitan Pkwy SW',
    'Atlanta',
    'GA',
    'community_center',
    ARRAY['artsy', 'chill'],
    TRUE
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    spot_type = EXCLUDED.spot_type,
    vibes = EXCLUDED.vibes,
    is_event_venue = EXCLUDED.is_event_venue;
