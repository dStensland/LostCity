-- Migration 083: Add The Supermarket ATL venue and source
-- Multi-use arts space in East Point with comedy, music, markets, and community events

-- ============================================================================
-- EVENT PRODUCER
-- ============================================================================

INSERT INTO event_producers (
    id, name, slug, org_type, website, categories, city, description
) VALUES (
    'the-supermarket-atl',
    'The Supermarket',
    'the-supermarket-atl',
    'venue',
    'https://www.thesupermarketatl.com',
    ARRAY['music', 'theater', 'art', 'community', 'markets'],
    'East Point',
    'Multi-use creative arts space hosting comedy, live music, art markets, and community events in East Point'
) ON CONFLICT (id) DO UPDATE SET
    website = EXCLUDED.website,
    description = EXCLUDED.description,
    categories = EXCLUDED.categories;

-- ============================================================================
-- VENUE
-- ============================================================================

INSERT INTO venues (
    name, slug, address, city, state, zip, venue_type, website
) VALUES (
    'The Supermarket',
    'the-supermarket-atl',
    '3428 Main St',
    'East Point',
    'GA',
    '30344',
    'event_space',
    'https://www.thesupermarketatl.com'
) ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- SOURCE (for crawling)
-- ============================================================================

INSERT INTO sources (
    name, slug, url, source_type, crawl_frequency, is_active, producer_id
) VALUES (
    'The Supermarket ATL',
    'supermarket-atl',
    'https://www.thesupermarketatl.com/events',
    'venue_website',
    'daily',
    true,
    'the-supermarket-atl'
) ON CONFLICT (slug) DO NOTHING;
