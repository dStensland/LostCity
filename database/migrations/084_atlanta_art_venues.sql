-- Migration 084: Add Atlanta Art & Creative Venues
-- The Oddities Museum, 404 Found ATL, MASS Collective

-- ============================================================================
-- EVENT PRODUCERS
-- ============================================================================

-- The Oddities Museum
INSERT INTO event_producers (
    id, name, slug, org_type, website, categories, city, description
) VALUES (
    'oddities-museum',
    'The Oddities Museum',
    'oddities-museum',
    'museum',
    'https://theodditiesmuseum.org',
    ARRAY['art', 'community', 'markets'],
    'Chamblee',
    '501(c)(3) nonprofit museum preserving intriguing historical artifacts - oddities, curiosities, and unique exhibits'
) ON CONFLICT (id) DO UPDATE SET
    website = EXCLUDED.website,
    description = EXCLUDED.description;

-- 404 Found ATL Artist Collective
INSERT INTO event_producers (
    id, name, slug, org_type, website, categories, city, description
) VALUES (
    '404-found-atl',
    '404 Found ATL',
    '404-found-atl',
    'artist_collective',
    'https://www.404foundatl.com',
    ARRAY['art', 'community'],
    'Atlanta',
    'Atlanta artist collective fostering creativity and community through exhibitions, workshops, and collaborative events'
) ON CONFLICT (id) DO UPDATE SET
    website = EXCLUDED.website,
    description = EXCLUDED.description;

-- MASS Collective
INSERT INTO event_producers (
    id, name, slug, org_type, website, categories, city, description
) VALUES (
    'mass-collective',
    'MASS Collective',
    'mass-collective',
    'artist_collective',
    'https://www.masscollective.org',
    ARRAY['art', 'community'],
    'Atlanta',
    'Atlanta-based artist collective offering printmaking workshops, classes, and community art events'
) ON CONFLICT (id) DO UPDATE SET
    website = EXCLUDED.website,
    description = EXCLUDED.description;

-- ============================================================================
-- VENUES
-- ============================================================================

-- The Oddities Museum
INSERT INTO venues (
    name, slug, address, city, state, zip, venue_type, website
) VALUES (
    'The Oddities Museum',
    'oddities-museum',
    '3870 North Peachtree Rd',
    'Chamblee',
    'GA',
    '30341',
    'museum',
    'https://theodditiesmuseum.org'
) ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- SOURCES (for crawling)
-- ============================================================================

-- The Oddities Museum
INSERT INTO sources (
    name, slug, url, source_type, crawl_frequency, is_active, producer_id
) VALUES (
    'The Oddities Museum',
    'oddities-museum',
    'https://theodditiesmuseum.org/calendar-of-events',
    'venue_website',
    'daily',
    true,
    'oddities-museum'
) ON CONFLICT (slug) DO NOTHING;

-- 404 Found ATL
INSERT INTO sources (
    name, slug, url, source_type, crawl_frequency, is_active, producer_id
) VALUES (
    '404 Found ATL',
    '404-found-atl',
    'https://www.404foundatl.com/events',
    'venue_website',
    'daily',
    true,
    '404-found-atl'
) ON CONFLICT (slug) DO NOTHING;

-- MASS Collective
INSERT INTO sources (
    name, slug, url, source_type, crawl_frequency, is_active, producer_id
) VALUES (
    'MASS Collective',
    'mass-collective',
    'https://www.masscollective.org/classes',
    'venue_website',
    'daily',
    true,
    'mass-collective'
) ON CONFLICT (slug) DO NOTHING;
