-- Migration: Add Brick Store Pub source and venue
-- One of America's best beer bars in Downtown Decatur with special events

-- ===== SOURCE =====

INSERT INTO sources (slug, name, url, is_active, source_type)
VALUES (
    'brick-store-pub',
    'Brick Store Pub',
    'https://www.brickstorepub.com/events',
    TRUE,
    'venue'
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    is_active = EXCLUDED.is_active,
    source_type = EXCLUDED.source_type;

-- ===== VENUE =====

INSERT INTO venues (slug, name, address, neighborhood, city, state, zip, spot_type, vibes, is_event_venue, description)
VALUES (
    'brick-store-pub',
    'Brick Store Pub',
    '125 E Court Sq',
    'Downtown Decatur',
    'Decatur',
    'GA',
    '30030',
    'bar',
    ARRAY['casual', 'craft-beer', 'date-night', 'local-favorite'],
    TRUE,
    'Historic pub recognized as one of America''s best beer bars, featuring rare and craft beers, special beer celebrations, Oktoberfest events, and an upstairs Belgian bar. A beloved Decatur institution since 1997.'
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    neighborhood = EXCLUDED.neighborhood,
    city = EXCLUDED.city,
    state = EXCLUDED.state,
    zip = EXCLUDED.zip,
    spot_type = EXCLUDED.spot_type,
    vibes = EXCLUDED.vibes,
    is_event_venue = EXCLUDED.is_event_venue,
    description = EXCLUDED.description;
