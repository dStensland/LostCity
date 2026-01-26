-- Migration: Add makerspaces and creative studio sources and venues

-- ===== SOURCES =====

-- Decatur Makers
INSERT INTO sources (slug, name, url, is_active, source_type)
VALUES ('decatur-makers', 'Decatur Makers', 'https://www.meetup.com/decatur-makers/', TRUE, 'venue')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, url = EXCLUDED.url, is_active = EXCLUDED.is_active;

-- The Maker Station
INSERT INTO sources (slug, name, url, is_active, source_type)
VALUES ('the-maker-station', 'The Maker Station', 'https://www.themakerstation.com/', TRUE, 'venue')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, url = EXCLUDED.url, is_active = EXCLUDED.is_active;

-- Janke Studios
INSERT INTO sources (slug, name, url, is_active, source_type)
VALUES ('janke-studios', 'Janke Studios', 'http://jankestudios.com/', TRUE, 'venue')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, url = EXCLUDED.url, is_active = EXCLUDED.is_active;

-- MudFire
INSERT INTO sources (slug, name, url, is_active, source_type)
VALUES ('mudfire', 'MudFire', 'https://www.mudfire.com/', TRUE, 'venue')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, url = EXCLUDED.url, is_active = EXCLUDED.is_active;

-- Spruill Center for the Arts
INSERT INTO sources (slug, name, url, is_active, source_type)
VALUES ('spruill-center', 'Spruill Center for the Arts', 'https://www.spruillarts.org/', TRUE, 'venue')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, url = EXCLUDED.url, is_active = EXCLUDED.is_active;

-- Atlanta Clay Works
INSERT INTO sources (slug, name, url, is_active, source_type)
VALUES ('atlanta-clay-works', 'Atlanta Clay Works', 'https://www.atlclayworks.org/', TRUE, 'venue')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, url = EXCLUDED.url, is_active = EXCLUDED.is_active;

-- ===== VENUES =====

-- Decatur Makers
INSERT INTO venues (slug, name, address, city, state, spot_type, vibes, is_event_venue)
VALUES (
    'decatur-makers',
    'Decatur Makers',
    '230 E Ponce de Leon Ave',
    'Decatur',
    'GA',
    'community_center',
    ARRAY['artsy', 'chill', 'family-friendly'],
    TRUE
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    spot_type = EXCLUDED.spot_type,
    vibes = EXCLUDED.vibes,
    is_event_venue = EXCLUDED.is_event_venue;

-- The Maker Station
INSERT INTO venues (slug, name, address, city, state, spot_type, vibes, is_event_venue)
VALUES (
    'the-maker-station',
    'The Maker Station',
    '2985 Gordy Pkwy',
    'Marietta',
    'GA',
    'community_center',
    ARRAY['artsy', 'chill', 'family-friendly'],
    TRUE
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    spot_type = EXCLUDED.spot_type,
    vibes = EXCLUDED.vibes,
    is_event_venue = EXCLUDED.is_event_venue;

-- Janke Studios
INSERT INTO venues (slug, name, address, neighborhood, city, state, spot_type, vibes, is_event_venue)
VALUES (
    'janke-studios',
    'Janke Studios',
    '659 Auburn Ave NE',
    'Old Fourth Ward',
    'Atlanta',
    'GA',
    'gallery',
    ARRAY['artsy', 'date-spot', 'intimate'],
    TRUE
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    neighborhood = EXCLUDED.neighborhood,
    spot_type = EXCLUDED.spot_type,
    vibes = EXCLUDED.vibes,
    is_event_venue = EXCLUDED.is_event_venue;

-- MudFire
INSERT INTO venues (slug, name, address, city, state, spot_type, vibes, is_event_venue)
VALUES (
    'mudfire',
    'MudFire',
    '175 Laredo Dr',
    'Decatur',
    'GA',
    'gallery',
    ARRAY['artsy', 'chill', 'lgbtq-friendly'],
    TRUE
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    spot_type = EXCLUDED.spot_type,
    vibes = EXCLUDED.vibes,
    is_event_venue = EXCLUDED.is_event_venue;

-- Spruill Center for the Arts
INSERT INTO venues (slug, name, address, city, state, spot_type, vibes, is_event_venue)
VALUES (
    'spruill-center',
    'Spruill Center for the Arts',
    '5339 Chamblee Dunwoody Rd',
    'Dunwoody',
    'GA',
    'gallery',
    ARRAY['artsy', 'chill', 'family-friendly'],
    TRUE
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    spot_type = EXCLUDED.spot_type,
    vibes = EXCLUDED.vibes,
    is_event_venue = EXCLUDED.is_event_venue;

-- Atlanta Clay Works
INSERT INTO venues (slug, name, address, city, state, spot_type, vibes, is_event_venue)
VALUES (
    'atlanta-clay-works',
    'Atlanta Clay Works',
    '1401 Southland Cir NW',
    'Atlanta',
    'GA',
    'gallery',
    ARRAY['artsy', 'chill'],
    TRUE
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    spot_type = EXCLUDED.spot_type,
    vibes = EXCLUDED.vibes,
    is_event_venue = EXCLUDED.is_event_venue;
