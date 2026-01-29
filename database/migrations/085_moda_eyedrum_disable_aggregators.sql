-- Migration: Add MODA and Eyedrum sources, disable media aggregators
-- Date: 2026-01-28
-- Purpose:
--   1. Add direct sources for MODA and Eyedrum to replace aggregator coverage
--   2. Disable Creative Loafing, ArtsATL, and Access Atlanta aggregators
--   3. These sites should be used for discovery, not as data sources

-- ============================================================================
-- Add new direct sources
-- ============================================================================

-- Museum of Design Atlanta (MODA)
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active)
VALUES (
    'Museum of Design Atlanta',
    'moda',
    'https://www.museumofdesign.org/events',
    'scrape',
    'daily',
    true
)
ON CONFLICT (slug) DO UPDATE SET
    is_active = true,
    url = EXCLUDED.url;

-- Eyedrum Art & Music Gallery
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active)
VALUES (
    'Eyedrum',
    'eyedrum',
    'https://eyedrum.org/calendar-events-performances-art-music',
    'scrape',
    'daily',
    true
)
ON CONFLICT (slug) DO UPDATE SET
    is_active = true,
    url = EXCLUDED.url;

-- ============================================================================
-- Disable media aggregator sources
-- These should be used for discovery/research, not as primary data sources
-- ============================================================================

-- Disable Creative Loafing (alt-weekly media outlet)
UPDATE sources
SET is_active = false
WHERE slug = 'creative-loafing';

-- Disable ArtsATL Calendar (arts journalism site)
UPDATE sources
SET is_active = false
WHERE slug = 'artsatl-calendar';

-- Disable ArtsATL main (duplicate/related source)
UPDATE sources
SET is_active = false
WHERE slug = 'arts-atl';

-- Disable Access Atlanta (Cox Media / AJC)
UPDATE sources
SET is_active = false
WHERE slug = 'access-atlanta';

-- ============================================================================
-- Add venues if not present
-- ============================================================================

-- MODA venue
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'Museum of Design Atlanta (MODA)',
    'moda',
    '1315 Peachtree St NE',
    'Midtown',
    'Atlanta',
    'GA',
    '30309',
    'museum',
    'https://www.museumofdesign.org'
)
ON CONFLICT (slug) DO NOTHING;

-- Eyedrum venue
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'Eyedrum',
    'eyedrum',
    '515 Ralph David Abernathy Blvd SW',
    'West End',
    'Atlanta',
    'GA',
    '30312',
    'gallery',
    'https://eyedrum.org'
)
ON CONFLICT (slug) DO NOTHING;
