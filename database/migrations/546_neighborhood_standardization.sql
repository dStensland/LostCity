-- Migration: Neighborhood Label Standardization
--
-- Keep this file mirrored in database/migrations and supabase/migrations.
-- Update database/schema.sql in the same change set when schema changes are involved.
--
-- Fixes two data quality issues:
-- 1. "East Atlanta" vs "East Atlanta Village" fragmentation
-- 2. Wild Heaven Avondale address inconsistency

-- ============================================================
-- 1. Standardize "East Atlanta" → "East Atlanta Village"
-- ============================================================
-- "East Atlanta" and "East Atlanta Village" are used interchangeably across
-- venue data. This fragments neighborhood filtering. Standardize to
-- "East Atlanta Village" for all venues in Atlanta with this neighborhood.
UPDATE venues
SET neighborhood = 'East Atlanta Village'
WHERE neighborhood = 'East Atlanta'
  AND city = 'Atlanta';

-- ============================================================
-- 2. Wild Heaven Avondale — address standardization
-- ============================================================
-- Multiple crawlers reference the Avondale location with different addresses:
--   wild_heaven.py: "135B Clairemont Ave"
--   wild_heaven_beer.py: "135 Maple St"
--   dirty_south_trivia.py: "135B Sams St"
-- The canonical address is 135B Clairemont Ave, Avondale Estates, GA 30030.
-- Standardize any variant slugs/addresses that exist in the DB.
UPDATE venues
SET address = '135B Clairemont Ave',
    city = 'Avondale Estates',
    state = 'GA',
    zip = '30030'
WHERE slug IN ('wild-heaven-beer', 'wild-heaven-beer-decatur', 'wild-heaven-avondale')
  AND city IN ('Decatur', 'Avondale Estates');

-- Merge events from duplicate slugs onto the canonical slug if both exist.
-- Handles both known duplicates: wild-heaven-beer-decatur and wild-heaven-avondale.
UPDATE events
SET venue_id = (SELECT id FROM venues WHERE slug = 'wild-heaven-beer' LIMIT 1)
WHERE venue_id IN (
  SELECT id FROM venues WHERE slug IN ('wild-heaven-beer-decatur', 'wild-heaven-avondale', 'wild-heaven-beer-avondale')
)
AND EXISTS (SELECT 1 FROM venues WHERE slug = 'wild-heaven-beer');

-- Deactivate the duplicate venue records (keep canonical wild-heaven-beer).
UPDATE venues
SET active = false
WHERE slug IN ('wild-heaven-beer-decatur', 'wild-heaven-avondale', 'wild-heaven-beer-avondale')
  AND EXISTS (SELECT 1 FROM venues WHERE slug = 'wild-heaven-beer');
