-- ============================================
-- MIGRATION 003: Phase 1 Critical Aggregators
-- ============================================
-- Adds the three highest-priority event sources:
-- 1. Georgia World Congress Center (GWCC)
-- 2. Hands On Atlanta (volunteer hub)
-- 3. Discover Atlanta (official tourism)

-- Georgia World Congress Center
INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'gwcc',
    'Georgia World Congress Center',
    'https://www.gwcca.org/event-calendar',
    'website',
    true,
    'daily'
)
ON CONFLICT (slug) DO NOTHING;

-- Hands On Atlanta
INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'hands-on-atlanta',
    'Hands On Atlanta',
    'https://volunteer.handsonatlanta.org',
    'api',
    true,
    'daily'
)
ON CONFLICT (slug) DO NOTHING;

-- Discover Atlanta
INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'discover-atlanta',
    'Discover Atlanta',
    'https://discoveratlanta.com/events',
    'website',
    true,
    'daily'
)
ON CONFLICT (slug) DO NOTHING;

-- Add GWCC venues if they don't exist
INSERT INTO venues (slug, name, address, neighborhood, city, state, zip, venue_type, website)
VALUES
    ('georgia-world-congress-center', 'Georgia World Congress Center', '285 Andrew Young International Blvd NW', 'Downtown', 'Atlanta', 'GA', '30313', 'convention_center', 'https://www.gwcca.org'),
    ('centennial-olympic-park', 'Centennial Olympic Park', '265 Park Ave W NW', 'Downtown', 'Atlanta', 'GA', '30313', 'outdoor', 'https://www.gwcca.org')
ON CONFLICT (slug) DO NOTHING;
