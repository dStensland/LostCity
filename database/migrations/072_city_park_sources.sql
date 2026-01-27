-- Migration: Add City of Decatur, Johns Creek, and Stone Mountain Park sources
-- Municipal event calendars and park events for Atlanta metro area

-- ===== SOURCES =====

-- City of Decatur
INSERT INTO sources (slug, name, url, is_active, source_type)
VALUES (
    'decatur-city',
    'City of Decatur',
    'https://www.decaturga.com/calendar',
    TRUE,
    'aggregator'
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    is_active = EXCLUDED.is_active,
    source_type = EXCLUDED.source_type;

-- City of Johns Creek
INSERT INTO sources (slug, name, url, is_active, source_type)
VALUES (
    'johns-creek',
    'City of Johns Creek',
    'https://johnscreekga.gov/events/',
    TRUE,
    'aggregator'
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    is_active = EXCLUDED.is_active,
    source_type = EXCLUDED.source_type;

-- Stone Mountain Park (update existing if present)
INSERT INTO sources (slug, name, url, is_active, source_type)
VALUES (
    'stone-mountain-park',
    'Stone Mountain Park',
    'https://stonemountainpark.com/activities/events/',
    TRUE,
    'venue'
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    is_active = EXCLUDED.is_active,
    source_type = EXCLUDED.source_type;

-- ===== VENUES =====

-- City of Decatur (default venue for city events)
INSERT INTO venues (slug, name, address, neighborhood, city, state, zip, spot_type, vibes, is_event_venue, description)
VALUES (
    'city-of-decatur',
    'City of Decatur',
    '509 N McDonough St',
    'Decatur',
    'Decatur',
    'GA',
    '30030',
    'government',
    ARRAY['community', 'family-friendly', 'accessible'],
    TRUE,
    'City of Decatur municipal campus. Host to community events, festivals, and public gatherings in the heart of downtown Decatur.'
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

-- Johns Creek City Hall (default venue for Johns Creek events)
INSERT INTO venues (slug, name, address, neighborhood, city, state, zip, spot_type, vibes, is_event_venue, description)
VALUES (
    'johns-creek-city-hall',
    'Johns Creek City Hall',
    '11360 Lakefield Dr',
    'Johns Creek',
    'Johns Creek',
    'GA',
    '30097',
    'government',
    ARRAY['community', 'family-friendly', 'suburban'],
    TRUE,
    'Johns Creek municipal center hosting community events, cultural programs, and city celebrations in North Fulton County.'
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

-- Stone Mountain Park (update/insert)
INSERT INTO venues (slug, name, address, neighborhood, city, state, zip, spot_type, vibes, is_event_venue, description)
VALUES (
    'stone-mountain-park',
    'Stone Mountain Park',
    '1000 Robert E Lee Blvd',
    'Stone Mountain',
    'Stone Mountain',
    'GA',
    '30083',
    'park',
    ARRAY['family-friendly', 'outdoor', 'scenic', 'historic'],
    TRUE,
    'Georgia''s most popular attraction featuring 3,200 acres of natural beauty, hiking trails, family attractions, festivals, and outdoor recreation. Home to the world''s largest piece of exposed granite.'
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
