-- Migration: Consolidate Organization and Venue Types
-- Reduces org_types from 22 → 10 and venue_types from 70 → 20

-- ============================================================================
-- PART 1: Consolidate Organization Types (22 → 10)
-- ============================================================================

-- Arts consolidation: arts_org, artist_collective, cultural_org → arts_nonprofit
UPDATE organizations SET org_type = 'arts_nonprofit'
WHERE org_type IN ('arts_org', 'artist_collective', 'cultural_org');

-- Civic consolidation: political_party, government → advocacy_org
UPDATE organizations SET org_type = 'advocacy_org'
WHERE org_type IN ('political_party', 'government');

-- Entertainment consolidation: media → entertainment_company
UPDATE organizations SET org_type = 'entertainment_company'
WHERE org_type = 'media';

-- Food consolidation: food_festival → food_nonprofit
UPDATE organizations SET org_type = 'food_nonprofit'
WHERE org_type = 'food_festival';

-- Fitness: running_club stays (it's specific and meaningful)

-- Community consolidation: mutual_aid, safety_nonprofit, religious_nonprofit → community_nonprofit
UPDATE organizations SET org_type = 'community_nonprofit'
WHERE org_type IN ('mutual_aid', 'safety_nonprofit', 'religious_nonprofit');

-- Museum → arts_nonprofit (museums are arts organizations)
UPDATE organizations SET org_type = 'arts_nonprofit'
WHERE org_type = 'museum';

-- Fix orgs that have venue as org_type (shouldn't happen)
-- These are likely venues that got migrated incorrectly
UPDATE organizations SET org_type = 'community_nonprofit'
WHERE org_type = 'venue';

-- Rename for clarity
UPDATE organizations SET org_type = 'arts' WHERE org_type = 'arts_nonprofit';
UPDATE organizations SET org_type = 'community' WHERE org_type IN ('community_nonprofit', 'community_group');
UPDATE organizations SET org_type = 'advocacy' WHERE org_type = 'advocacy_org';
UPDATE organizations SET org_type = 'entertainment' WHERE org_type = 'entertainment_company';
UPDATE organizations SET org_type = 'food' WHERE org_type = 'food_nonprofit';
UPDATE organizations SET org_type = 'environmental' WHERE org_type = 'environmental_nonprofit';
UPDATE organizations SET org_type = 'youth' WHERE org_type = 'youth_nonprofit';
UPDATE organizations SET org_type = 'fitness' WHERE org_type = 'running_club';
UPDATE organizations SET org_type = 'film' WHERE org_type = 'film_society';

-- ============================================================================
-- PART 2: Consolidate Venue Types (70 → 20)
-- ============================================================================

-- Bar consolidation
UPDATE venues SET venue_type = 'bar'
WHERE venue_type IN ('sports_bar', 'rooftop_bar', 'lounge', 'wine_bar');

-- Restaurant consolidation
UPDATE venues SET venue_type = 'restaurant'
WHERE venue_type IN ('cafe', 'coffee_shop', 'coffeehouse', 'bakery', 'food_hall');

-- Brewery consolidation
UPDATE venues SET venue_type = 'brewery'
WHERE venue_type = 'distillery';

-- Music venue consolidation
UPDATE venues SET venue_type = 'music_venue'
WHERE venue_type IN ('concert_hall', 'performing_arts');

-- Theater consolidation
UPDATE venues SET venue_type = 'theater'
WHERE venue_type = 'comedy_club';

-- Nightclub consolidation
UPDATE venues SET venue_type = 'nightclub'
WHERE venue_type IN ('club', 'dance_studio');

-- Stadium consolidation
UPDATE venues SET venue_type = 'stadium'
WHERE venue_type = 'arena';

-- Museum consolidation
UPDATE venues SET venue_type = 'museum'
WHERE venue_type IN ('historic_site', 'memorial');

-- Gallery consolidation
UPDATE venues SET venue_type = 'gallery'
WHERE venue_type IN ('art_studio', 'studio');

-- Arts center consolidation
UPDATE venues SET venue_type = 'arts_center'
WHERE venue_type = 'cultural_center';

-- Event space consolidation
UPDATE venues SET venue_type = 'event_space'
WHERE venue_type IN ('convention_center', 'convention', 'event_venue');

-- Park consolidation
UPDATE venues SET venue_type = 'park'
WHERE venue_type IN ('garden', 'outdoor');

-- Community center consolidation
UPDATE venues SET venue_type = 'community_center'
WHERE venue_type = 'church';

-- Institution consolidation (universities, hospitals)
UPDATE venues SET venue_type = 'institution'
WHERE venue_type IN ('university', 'hospital');

-- Retail consolidation
UPDATE venues SET venue_type = 'retail'
WHERE venue_type IN ('shopping', 'pharmacy', 'bank');

-- Fitness consolidation
UPDATE venues SET venue_type = 'fitness'
WHERE venue_type IN ('fitness_center', 'gym');

-- Coworking consolidation
UPDATE venues SET venue_type = 'coworking'
WHERE venue_type = 'office';

-- Recreation consolidation
UPDATE venues SET venue_type = 'recreation'
WHERE venue_type IN ('games', 'gaming_venue', 'golf_course', 'zoo', 'recreation_center');

-- Clean up misc types → event_space (generic but valid)
UPDATE venues SET venue_type = 'event_space'
WHERE venue_type IN ('various', 'mixed_use', 'neighborhood', 'street',
                     'entertainment', 'entertainment_venue', 'event_producer', 'community');

-- Set NULL types to event_space
UPDATE venues SET venue_type = 'event_space'
WHERE venue_type IS NULL;

-- ============================================================================
-- PART 3: Verify Results
-- ============================================================================

-- This is just for logging in the migration output
DO $$
DECLARE
    org_count INTEGER;
    venue_count INTEGER;
BEGIN
    SELECT COUNT(DISTINCT org_type) INTO org_count FROM organizations;
    SELECT COUNT(DISTINCT venue_type) INTO venue_count FROM venues WHERE active != false;
    RAISE NOTICE 'Consolidated to % org_types and % venue_types', org_count, venue_count;
END $$;
