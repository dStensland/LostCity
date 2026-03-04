-- Add more well-known Atlanta-area trails to improve trail coverage.
-- Migration 270 added Silver Comet, Tanyard Creek, Sope Creek, and Fernbank Forest.
-- This adds the major trails people actually search for.

BEGIN;

-- Atlanta BeltLine Eastside Trail (the flagship)
INSERT INTO venues (
    name, slug, address, city, state, zip, neighborhood,
    venue_type, website, lat, lng,
    vibes, is_event_venue, active, is_experience, typical_duration_minutes
) VALUES (
    'Atlanta BeltLine Eastside Trail', 'atlanta-beltline-eastside-trail',
    'Ponce de Leon Ave NE & North Ave NE', 'Atlanta', 'GA', '30308', 'Old Fourth Ward',
    'trail', 'https://beltline.org/explore/eastside-trail/',
    33.7710, -84.3650,
    ARRAY['outdoors', 'running', 'cycling', 'art', 'date-spot', 'dog-friendly'], false, true, true, 90
) ON CONFLICT (slug) DO UPDATE SET
    venue_type = EXCLUDED.venue_type, is_experience = true;

-- Atlanta BeltLine Westside Trail
INSERT INTO venues (
    name, slug, address, city, state, zip, neighborhood,
    venue_type, website, lat, lng,
    vibes, is_event_venue, active, is_experience, typical_duration_minutes
) VALUES (
    'Atlanta BeltLine Westside Trail', 'atlanta-beltline-westside-trail',
    'Washington Park', 'Atlanta', 'GA', '30314', 'West End',
    'trail', 'https://beltline.org/explore/westside-trail/',
    33.7380, -84.4140,
    ARRAY['outdoors', 'running', 'cycling', 'nature'], false, true, true, 60
) ON CONFLICT (slug) DO UPDATE SET
    venue_type = EXCLUDED.venue_type, is_experience = true;

-- Sweetwater Creek State Park
INSERT INTO venues (
    name, slug, address, city, state, zip, neighborhood,
    venue_type, website, lat, lng,
    vibes, is_event_venue, active, is_experience, typical_duration_minutes
) VALUES (
    'Sweetwater Creek State Park', 'sweetwater-creek-state-park',
    '1750 Mt Vernon Rd', 'Lithia Springs', 'GA', '30122', 'Lithia Springs',
    'trail', 'https://gastateparks.org/sweetwatercreek',
    33.7570, -84.6290,
    ARRAY['outdoors', 'hiking', 'nature', 'historic', 'family-friendly'], false, true, true, 120
) ON CONFLICT (slug) DO UPDATE SET
    venue_type = EXCLUDED.venue_type, is_experience = true;

-- East Palisades Trail (along the Chattahoochee)
INSERT INTO venues (
    name, slug, address, city, state, zip, neighborhood,
    venue_type, website, lat, lng,
    vibes, is_event_venue, active, is_experience, typical_duration_minutes
) VALUES (
    'East Palisades Trail', 'east-palisades-trail',
    '1425 Indian Trail NW', 'Atlanta', 'GA', '30327', 'Vinings',
    'trail', 'https://www.nps.gov/chat/planyourvisit/east-palisades.htm',
    33.8830, -84.4400,
    ARRAY['outdoors', 'hiking', 'nature', 'dog-friendly'], false, true, true, 90
) ON CONFLICT (slug) DO UPDATE SET
    venue_type = EXCLUDED.venue_type, is_experience = true;

-- Cascade Springs Nature Preserve
INSERT INTO venues (
    name, slug, address, city, state, zip, neighborhood,
    venue_type, website, lat, lng,
    vibes, is_event_venue, active, is_experience, typical_duration_minutes
) VALUES (
    'Cascade Springs Nature Preserve', 'cascade-springs-nature-preserve',
    '2846 Cascade Rd SW', 'Atlanta', 'GA', '30311', 'Cascade Heights',
    'trail', 'https://www.atlantatrails.com/hiking-trails/cascade-springs-nature-preserve/',
    33.7160, -84.4580,
    ARRAY['outdoors', 'hiking', 'nature', 'peaceful'], false, true, true, 60
) ON CONFLICT (slug) DO UPDATE SET
    venue_type = EXCLUDED.venue_type, is_experience = true;

-- Morningside Nature Preserve
INSERT INTO venues (
    name, slug, address, city, state, zip, neighborhood,
    venue_type, website, lat, lng,
    vibes, is_event_venue, active, is_experience, typical_duration_minutes
) VALUES (
    'Morningside Nature Preserve', 'morningside-nature-preserve',
    '1401 Wellbourne Dr NE', 'Atlanta', 'GA', '30306', 'Morningside',
    'trail', 'https://www.atlantatrails.com/hiking-trails/morningside-nature-preserve/',
    33.7880, -84.3530,
    ARRAY['outdoors', 'hiking', 'nature', 'dog-friendly'], false, true, true, 45
) ON CONFLICT (slug) DO UPDATE SET
    venue_type = EXCLUDED.venue_type, is_experience = true;

-- Arabia Mountain PATH
INSERT INTO venues (
    name, slug, address, city, state, zip, neighborhood,
    venue_type, website, lat, lng,
    vibes, is_event_venue, active, is_experience, typical_duration_minutes
) VALUES (
    'Arabia Mountain PATH', 'arabia-mountain-path',
    '3787 Klondike Rd', 'Lithonia', 'GA', '30038', 'Lithonia',
    'trail', 'https://arabiaalliance.org',
    33.6660, -84.1230,
    ARRAY['outdoors', 'hiking', 'nature', 'scenic'], false, true, true, 90
) ON CONFLICT (slug) DO UPDATE SET
    venue_type = EXCLUDED.venue_type, is_experience = true;

-- Cochran Shoals Trail (Chattahoochee River)
INSERT INTO venues (
    name, slug, address, city, state, zip, neighborhood,
    venue_type, website, lat, lng,
    vibes, is_event_venue, active, is_experience, typical_duration_minutes
) VALUES (
    'Cochran Shoals Trail', 'cochran-shoals-trail',
    '1978 Columns Dr SE', 'Marietta', 'GA', '30067', 'East Cobb',
    'trail', 'https://www.nps.gov/chat/planyourvisit/cochran-shoals.htm',
    33.9030, -84.4350,
    ARRAY['outdoors', 'running', 'cycling', 'dog-friendly', 'family-friendly'], false, true, true, 60
) ON CONFLICT (slug) DO UPDATE SET
    venue_type = EXCLUDED.venue_type, is_experience = true;

-- Stone Mountain Walk-Up Trail
INSERT INTO venues (
    name, slug, address, city, state, zip, neighborhood,
    venue_type, website, lat, lng,
    vibes, is_event_venue, active, is_experience, typical_duration_minutes
) VALUES (
    'Stone Mountain Walk-Up Trail', 'stone-mountain-walk-up-trail',
    '1000 Robert E Lee Blvd', 'Stone Mountain', 'GA', '30083', 'Stone Mountain',
    'trail', 'https://www.stonemountainpark.com',
    33.8090, -84.1450,
    ARRAY['outdoors', 'hiking', 'scenic', 'family-friendly'], false, true, true, 90
) ON CONFLICT (slug) DO UPDATE SET
    venue_type = EXCLUDED.venue_type, is_experience = true;

-- Kennesaw Mountain Trail (the park was retyped in 270 but this is the trail itself)
INSERT INTO venues (
    name, slug, address, city, state, zip, neighborhood,
    venue_type, website, lat, lng,
    vibes, is_event_venue, active, is_experience, typical_duration_minutes
) VALUES (
    'Kennesaw Mountain Trail', 'kennesaw-mountain-trail',
    '900 Kennesaw Mountain Dr', 'Kennesaw', 'GA', '30152', 'Kennesaw',
    'trail', 'https://www.nps.gov/kemo/',
    33.9830, -84.5780,
    ARRAY['outdoors', 'hiking', 'nature', 'historic', 'scenic'], false, true, true, 120
) ON CONFLICT (slug) DO UPDATE SET
    venue_type = EXCLUDED.venue_type, is_experience = true;

COMMIT;
