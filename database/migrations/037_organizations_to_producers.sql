-- ============================================
-- MIGRATION 037: Move Organizations from Venues to Event Producers
-- ============================================
-- Organizations shouldn't be "places" - they're entities that produce events
-- at various venues. This migration:
-- 1. Creates event_producer records for organization venues
-- 2. Links any events to the producer instead
-- 3. Removes organization venues or converts them to headquarters
-- ============================================

-- ============================================
-- 1. CREATE EVENT_PRODUCER RECORDS
-- ============================================

-- Trees Atlanta
INSERT INTO event_producers (id, name, slug, org_type, website, neighborhood, city, categories, description)
VALUES (
    'trees-atlanta',
    'Trees Atlanta',
    'trees-atlanta',
    'environmental_nonprofit',
    'https://treesatlanta.org',
    'Atlanta',
    'Atlanta',
    ARRAY['community', 'outdoors', 'volunteer'],
    'Nonprofit organization protecting and improving Atlanta''s urban forest through planting, conservation, and education.'
)
ON CONFLICT (id) DO UPDATE SET
    org_type = EXCLUDED.org_type,
    categories = EXCLUDED.categories,
    description = EXCLUDED.description;

-- Park Pride
INSERT INTO event_producers (id, name, slug, org_type, website, neighborhood, city, categories, description)
VALUES (
    'park-pride',
    'Park Pride',
    'park-pride',
    'environmental_nonprofit',
    'https://parkpride.org',
    'Atlanta',
    'Atlanta',
    ARRAY['community', 'outdoors', 'volunteer'],
    'Nonprofit organization that engages communities to activate the power of parks.'
)
ON CONFLICT (id) DO UPDATE SET
    org_type = EXCLUDED.org_type,
    categories = EXCLUDED.categories,
    description = EXCLUDED.description;

-- Friends of Westside Park
INSERT INTO event_producers (id, name, slug, org_type, website, neighborhood, city, categories, description)
VALUES (
    'friends-westside-park',
    'Friends of Westside Park',
    'friends-westside-park',
    'environmental_nonprofit',
    NULL,
    'Westside',
    'Atlanta',
    ARRAY['community', 'outdoors', 'volunteer'],
    'Community group supporting Westside Park at Bellwood Quarry.'
)
ON CONFLICT (id) DO UPDATE SET
    org_type = EXCLUDED.org_type,
    categories = EXCLUDED.categories,
    description = EXCLUDED.description;

-- Girl Scouts of Greater Atlanta
INSERT INTO event_producers (id, name, slug, org_type, website, neighborhood, city, categories, description)
VALUES (
    'girl-scouts-atlanta',
    'Girl Scouts of Greater Atlanta',
    'girl-scouts-atlanta',
    'youth_nonprofit',
    'https://www.girlscoutsatl.org',
    'Atlanta',
    'Atlanta',
    ARRAY['community', 'family', 'youth'],
    'Building girls of courage, confidence, and character who make the world a better place.'
)
ON CONFLICT (id) DO UPDATE SET
    org_type = EXCLUDED.org_type,
    categories = EXCLUDED.categories,
    description = EXCLUDED.description;

-- Atlanta Pride (may already exist)
INSERT INTO event_producers (id, name, slug, org_type, website, neighborhood, city, categories, description)
VALUES (
    'atlanta-pride',
    'Atlanta Pride Committee',
    'atlanta-pride',
    'cultural_org',
    'https://atlantapride.org',
    'Midtown',
    'Atlanta',
    ARRAY['community', 'lgbtq', 'festival'],
    'Producers of the Atlanta Pride Festival, one of the largest Pride celebrations in the Southeast.'
)
ON CONFLICT (id) DO UPDATE SET
    org_type = EXCLUDED.org_type,
    categories = EXCLUDED.categories,
    description = EXCLUDED.description;

-- Atlanta Inner-City Ministry
INSERT INTO event_producers (id, name, slug, org_type, website, neighborhood, city, categories, description)
VALUES (
    'atlanta-inner-city-ministry',
    'Atlanta Inner-City Ministry',
    'atlanta-inner-city-ministry',
    'religious_nonprofit',
    NULL,
    'Atlanta',
    'Atlanta',
    ARRAY['community', 'volunteer', 'faith'],
    'Faith-based organization serving Atlanta''s inner-city communities.'
)
ON CONFLICT (id) DO UPDATE SET
    org_type = EXCLUDED.org_type,
    categories = EXCLUDED.categories,
    description = EXCLUDED.description;

-- Atlanta Music Project
INSERT INTO event_producers (id, name, slug, org_type, website, neighborhood, city, categories, description)
VALUES (
    'atlanta-music-project',
    'Atlanta Music Project',
    'atlanta-music-project',
    'arts_nonprofit',
    'https://atlantamusicproject.org',
    'Atlanta',
    'Atlanta',
    ARRAY['music', 'community', 'youth', 'education'],
    'Empowering Atlanta''s youth through music education and performance opportunities.'
)
ON CONFLICT (id) DO UPDATE SET
    org_type = EXCLUDED.org_type,
    categories = EXCLUDED.categories,
    description = EXCLUDED.description;

-- First African Community Development Corporation
INSERT INTO event_producers (id, name, slug, org_type, website, neighborhood, city, categories, description)
VALUES (
    'facdc',
    'First African Community Development Corporation',
    'facdc',
    'community_nonprofit',
    NULL,
    'Atlanta',
    'Atlanta',
    ARRAY['community', 'volunteer'],
    'Community development organization serving Atlanta neighborhoods.'
)
ON CONFLICT (id) DO UPDATE SET
    org_type = EXCLUDED.org_type,
    categories = EXCLUDED.categories,
    description = EXCLUDED.description;

-- Enough to Share Inc.
INSERT INTO event_producers (id, name, slug, org_type, website, neighborhood, city, categories, description)
VALUES (
    'enough-to-share',
    'Enough to Share Inc.',
    'enough-to-share',
    'food_nonprofit',
    NULL,
    'Atlanta',
    'Atlanta',
    ARRAY['community', 'volunteer', 'food'],
    'Food assistance and community support organization.'
)
ON CONFLICT (id) DO UPDATE SET
    org_type = EXCLUDED.org_type,
    categories = EXCLUDED.categories,
    description = EXCLUDED.description;

-- Giving Hands Food Pantry
INSERT INTO event_producers (id, name, slug, org_type, website, neighborhood, city, categories, description)
VALUES (
    'giving-hands-food-pantry',
    'Giving Hands Food Pantry',
    'giving-hands-food-pantry',
    'food_nonprofit',
    NULL,
    'Atlanta',
    'Atlanta',
    ARRAY['community', 'volunteer', 'food'],
    'Food pantry serving Atlanta communities in need.'
)
ON CONFLICT (id) DO UPDATE SET
    org_type = EXCLUDED.org_type,
    categories = EXCLUDED.categories,
    description = EXCLUDED.description;

-- SafeRide America
INSERT INTO event_producers (id, name, slug, org_type, website, neighborhood, city, categories, description)
VALUES (
    'saferide-america',
    'SafeRide America',
    'saferide-america',
    'safety_nonprofit',
    'https://saferideamerica.org',
    'Atlanta',
    'Atlanta',
    ARRAY['community', 'safety'],
    'Nonprofit providing safe transportation alternatives.'
)
ON CONFLICT (id) DO UPDATE SET
    org_type = EXCLUDED.org_type,
    categories = EXCLUDED.categories,
    description = EXCLUDED.description;

-- Stella Love Non-Profit
INSERT INTO event_producers (id, name, slug, org_type, website, neighborhood, city, categories, description)
VALUES (
    'stella-love',
    'Stella Love Non-Profit',
    'stella-love',
    'community_nonprofit',
    NULL,
    'Atlanta',
    'Atlanta',
    ARRAY['community', 'volunteer'],
    'Community support organization.'
)
ON CONFLICT (id) DO UPDATE SET
    org_type = EXCLUDED.org_type,
    categories = EXCLUDED.categories,
    description = EXCLUDED.description;

-- The Launch Pad Foundation
INSERT INTO event_producers (id, name, slug, org_type, website, neighborhood, city, categories, description)
VALUES (
    'launch-pad-foundation',
    'The Launch Pad Foundation',
    'launch-pad-foundation',
    'youth_nonprofit',
    NULL,
    'Atlanta',
    'Atlanta',
    ARRAY['community', 'youth', 'education'],
    'Youth development and education foundation.'
)
ON CONFLICT (id) DO UPDATE SET
    org_type = EXCLUDED.org_type,
    categories = EXCLUDED.categories,
    description = EXCLUDED.description;

-- Wylde Center
INSERT INTO event_producers (id, name, slug, org_type, website, neighborhood, city, categories, description)
VALUES (
    'wylde-center',
    'Wylde Center',
    'wylde-center',
    'environmental_nonprofit',
    'https://wyldecenter.org',
    'Decatur',
    'Decatur',
    ARRAY['community', 'outdoors', 'education', 'garden'],
    'Environmental education center with community gardens and sustainability programs.'
)
ON CONFLICT (id) DO UPDATE SET
    org_type = EXCLUDED.org_type,
    categories = EXCLUDED.categories,
    description = EXCLUDED.description;

-- ============================================
-- 2. UPDATE EVENTS TO LINK TO PRODUCERS
-- ============================================
-- For events at organization venues, set the producer_id
-- (Events should already have venue_id pointing to actual event location)

-- This is a data cleanup - events at "organization" venues should have
-- their producer_id set and venue_id changed to actual location
-- For now, just ensure producer links exist

-- ============================================
-- 3. REMOVE ORGANIZATION FROM VENUE SPOT_TYPES
-- ============================================
-- Change organization venues to 'other' or delete them
-- These shouldn't show up as places you can visit

UPDATE venues
SET spot_type = 'community_center',
    venue_type = 'community_center'
WHERE spot_type = 'organization'
  AND name IN ('Wylde Center');  -- Wylde Center has a physical location people visit

-- For the rest, mark them as 'nonprofit_hq' (they're not venues for events)
UPDATE venues
SET spot_type = 'nonprofit_hq',
    venue_type = 'nonprofit_hq'
WHERE spot_type = 'organization';

-- ============================================
-- 4. ADD PRODUCER_ID TO VENUES TABLE (optional link)
-- ============================================
-- This allows venues to be associated with their operating organization

ALTER TABLE venues ADD COLUMN IF NOT EXISTS producer_id TEXT REFERENCES event_producers(id);

-- Link the converted organization venues to their producers
UPDATE venues SET producer_id = 'trees-atlanta' WHERE name = 'Trees Atlanta';
UPDATE venues SET producer_id = 'park-pride' WHERE name = 'Park Pride';
UPDATE venues SET producer_id = 'friends-westside-park' WHERE name = 'Friends of Westside Park';
UPDATE venues SET producer_id = 'girl-scouts-atlanta' WHERE name = 'Girl Scouts of Greater Atlanta';
UPDATE venues SET producer_id = 'atlanta-pride' WHERE name = 'Atlanta Pride';
UPDATE venues SET producer_id = 'atlanta-inner-city-ministry' WHERE name = 'Atlanta Inner-City Ministry';
UPDATE venues SET producer_id = 'atlanta-music-project' WHERE name = 'Atlanta Music Project';
UPDATE venues SET producer_id = 'facdc' WHERE name = 'First African Community Development Corporation (FACDC)';
UPDATE venues SET producer_id = 'enough-to-share' WHERE name = 'Enough to Share Inc.';
UPDATE venues SET producer_id = 'giving-hands-food-pantry' WHERE name = 'Giving Hands Food Pantry';
UPDATE venues SET producer_id = 'saferide-america' WHERE name = 'SafeRide America';
UPDATE venues SET producer_id = 'stella-love' WHERE name = 'Stella Love Non-Profit';
UPDATE venues SET producer_id = 'launch-pad-foundation' WHERE name = 'The Launch Pad Foundation';
UPDATE venues SET producer_id = 'wylde-center' WHERE name = 'Wylde Center';

-- ============================================
-- 5. CREATE INDEX FOR PRODUCER LINK
-- ============================================
CREATE INDEX IF NOT EXISTS idx_venues_producer ON venues(producer_id);
