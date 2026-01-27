-- Migration: Add Auburn Avenue Research Library and APEX Museum sources
-- Both located in Sweet Auburn neighborhood, focusing on African American culture and history

-- ===== SOURCES =====

-- Auburn Avenue Research Library
INSERT INTO sources (slug, name, url, is_active, source_type)
VALUES (
    'auburn-ave-library',
    'Auburn Avenue Research Library',
    'https://gateway.bibliocommons.com/v2/libraries/fulcolibrary/rss/events?types=5faac707c118654500b6f842',
    TRUE,
    'venue'
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    is_active = EXCLUDED.is_active,
    source_type = EXCLUDED.source_type;

-- APEX Museum
INSERT INTO sources (slug, name, url, is_active, source_type)
VALUES (
    'apex-museum',
    'APEX Museum',
    'https://www.eventbrite.com/o/apex-museum-8742952001',
    TRUE,
    'venue'
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    is_active = EXCLUDED.is_active,
    source_type = EXCLUDED.source_type;

-- ===== VENUES =====

-- Auburn Avenue Research Library
INSERT INTO venues (slug, name, address, neighborhood, city, state, zip, spot_type, vibes, is_event_venue, description)
VALUES (
    'auburn-ave-library',
    'Auburn Avenue Research Library',
    '101 Auburn Ave NE',
    'Sweet Auburn',
    'Atlanta',
    'GA',
    '30303',
    'library',
    ARRAY['educational', 'historic', 'community'],
    TRUE,
    'Premier research library dedicated to African American culture and history, part of the Fulton County Library System. Features extensive archives, special collections, and community programming.'
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

-- APEX Museum (African American Panoramic Experience)
INSERT INTO venues (slug, name, address, neighborhood, city, state, zip, spot_type, vibes, is_event_venue, description)
VALUES (
    'apex-museum',
    'APEX Museum',
    '135 Auburn Ave NE',
    'Sweet Auburn',
    'Atlanta',
    'GA',
    '30303',
    'museum',
    ARRAY['family-friendly', 'educational', 'historic', 'cultural'],
    TRUE,
    'The African American Panoramic Experience (APEX) Museum showcases the history and culture of African Americans in Atlanta and the Sweet Auburn community. Features exhibits, music tributes, and educational programs.'
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
