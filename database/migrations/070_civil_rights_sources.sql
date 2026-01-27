-- Migration: Add civil rights and cultural heritage sources
-- Ebenezer Baptist Church, The King Center, Wren's Nest House Museum

-- ===== SOURCES =====

-- Ebenezer Baptist Church
INSERT INTO sources (slug, name, url, is_active, source_type)
VALUES ('ebenezer-baptist-church', 'Ebenezer Baptist Church', 'https://www.ebenezeratl.org/upcoming-events/', TRUE, 'venue')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, url = EXCLUDED.url, is_active = EXCLUDED.is_active;

-- The King Center
INSERT INTO sources (slug, name, url, is_active, source_type)
VALUES ('king-center', 'The King Center', 'https://thekingcenter.org/events/', TRUE, 'venue')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, url = EXCLUDED.url, is_active = EXCLUDED.is_active;

-- Wren's Nest House Museum
INSERT INTO sources (slug, name, url, is_active, source_type)
VALUES ('wrens-nest', 'Wren''s Nest House Museum', 'https://www.wrensnest.org/calendar', TRUE, 'venue')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, url = EXCLUDED.url, is_active = EXCLUDED.is_active;

-- ===== VENUES =====

-- Ebenezer Baptist Church
INSERT INTO venues (slug, name, address, neighborhood, city, state, spot_type, vibes, is_event_venue)
VALUES (
    'ebenezer-baptist-church',
    'Ebenezer Baptist Church',
    '101 Jackson St NE',
    'Sweet Auburn',
    'Atlanta',
    'GA',
    'church',
    ARRAY['historic', 'community', 'spiritual'],
    TRUE
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    neighborhood = EXCLUDED.neighborhood,
    spot_type = EXCLUDED.spot_type,
    vibes = EXCLUDED.vibes,
    is_event_venue = EXCLUDED.is_event_venue;

-- The King Center
INSERT INTO venues (slug, name, address, neighborhood, city, state, spot_type, vibes, is_event_venue)
VALUES (
    'king-center',
    'The King Center',
    '449 Auburn Ave NE',
    'Sweet Auburn',
    'Atlanta',
    'GA',
    'memorial',
    ARRAY['historic', 'educational', 'community'],
    TRUE
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    neighborhood = EXCLUDED.neighborhood,
    spot_type = EXCLUDED.spot_type,
    vibes = EXCLUDED.vibes,
    is_event_venue = EXCLUDED.is_event_venue;

-- Wren's Nest House Museum
INSERT INTO venues (slug, name, address, neighborhood, city, state, spot_type, vibes, is_event_venue)
VALUES (
    'wrens-nest',
    'Wren''s Nest House Museum',
    '1050 Ralph David Abernathy Blvd SW',
    'West End',
    'Atlanta',
    'GA',
    'museum',
    ARRAY['family-friendly', 'historic', 'educational'],
    TRUE
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    neighborhood = EXCLUDED.neighborhood,
    spot_type = EXCLUDED.spot_type,
    vibes = EXCLUDED.vibes,
    is_event_venue = EXCLUDED.is_event_venue;
