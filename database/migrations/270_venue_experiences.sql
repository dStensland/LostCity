-- Migration: Add experience venue support
-- Treats qualifying venues (parks, museums, trails, etc.) as always-visitable
-- destinations independent of scheduled events.

-- 1. Add columns
ALTER TABLE venues ADD COLUMN IF NOT EXISTS is_experience boolean DEFAULT false;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS typical_duration_minutes smallint;

-- 2. Retype misclassified venues BEFORE auto-populate so they get caught

-- Recreation: bars/restaurants that are actually entertainment destinations
UPDATE venues SET venue_type = 'entertainment' WHERE id = 4942;  -- The Painted Pin (bar → entertainment)
UPDATE venues SET venue_type = 'entertainment' WHERE id = 264;   -- The Painted Duck (bar → entertainment)
UPDATE venues SET venue_type = 'entertainment' WHERE id = 998;   -- Your 3rd Spot (restaurant → entertainment)
UPDATE venues SET venue_type = 'entertainment' WHERE id = 261;   -- Stars and Strikes Dacula (restaurant → entertainment)
UPDATE venues SET venue_type = 'entertainment' WHERE id = 251;   -- Andretti Indoor Karting Buford (games → entertainment)
UPDATE venues SET venue_type = 'entertainment' WHERE id = 250;   -- Andretti Indoor Karting Marietta (fitness_center → entertainment)
UPDATE venues SET venue_type = 'entertainment' WHERE id = 1744;  -- Stone Summit Climbing (fitness_center → entertainment)
UPDATE venues SET venue_type = 'entertainment' WHERE id = 1745;  -- Stone Summit Kennesaw (fitness_center → entertainment)
UPDATE venues SET venue_type = 'entertainment' WHERE id = 2611;  -- Challenge Aerial (fitness_center → entertainment)
UPDATE venues SET venue_type = 'entertainment' WHERE id = 2123;  -- Urban Air Adventure Park (fitness_center → entertainment)

-- Attractions
UPDATE venues SET venue_type = 'attraction' WHERE id = 890;   -- Six Flags Over Georgia (entertainment → attraction)
UPDATE venues SET venue_type = 'museum' WHERE id = 4983;      -- Illuminarium Atlanta (entertainment → museum)

-- Parks / outdoor spaces mistyped as event_space
UPDATE venues SET venue_type = 'park' WHERE id = 4346;     -- Kennesaw Mountain National Battlefield Park
UPDATE venues SET venue_type = 'park' WHERE id = 4159;     -- Centennial Olympic Park

-- Food halls mistyped as restaurant/market
UPDATE venues SET venue_type = 'food_hall' WHERE id = 421;   -- Krog Street Market (restaurant → food_hall)
UPDATE venues SET venue_type = 'food_hall' WHERE id = 897;   -- The Battery Atlanta (market → food_hall)

-- Historic/cultural sites
UPDATE venues SET venue_type = 'historic_site' WHERE id = 985;   -- Ebenezer Baptist Church (community_center → historic_site)
UPDATE venues SET venue_type = 'historic_site' WHERE id = 4435;  -- Swan House (historic_building → historic_site)

-- Trails mistyped
UPDATE venues SET venue_type = 'trail' WHERE id = 4051;     -- Doll's Head Trail (artifact → trail)

-- 2b. Add missing experience venues

-- Silver Comet Trail
INSERT INTO venues (
    name, slug, address, city, state, zip, neighborhood,
    venue_type, spot_type, website, lat, lng,
    vibes, is_event_venue, active
) VALUES (
    'Silver Comet Trail', 'silver-comet-trail',
    '4573 Mavell Rd', 'Smyrna', 'GA', '30082', 'Smyrna',
    'trail', 'outdoors', 'https://silvercometga.com',
    33.8590, -84.5230,
    ARRAY['outdoors', 'running', 'cycling', 'family-friendly'], false, true
) ON CONFLICT (slug) DO UPDATE SET
    venue_type = EXCLUDED.venue_type, spot_type = EXCLUDED.spot_type;

-- Tanyard Creek Trail
INSERT INTO venues (
    name, slug, address, city, state, zip, neighborhood,
    venue_type, spot_type, website, lat, lng,
    vibes, is_event_venue, active
) VALUES (
    'Tanyard Creek Trail', 'tanyard-creek-trail',
    '460 Collier Rd NW', 'Atlanta', 'GA', '30309', 'Buckhead',
    'trail', 'outdoors', 'https://www.atlantatrails.com/hiking-trails/tanyard-creek-trail/',
    33.8050, -84.4040,
    ARRAY['outdoors', 'hiking', 'nature'], false, true
) ON CONFLICT (slug) DO UPDATE SET
    venue_type = EXCLUDED.venue_type, spot_type = EXCLUDED.spot_type;

-- Sope Creek Trail
INSERT INTO venues (
    name, slug, address, city, state, zip, neighborhood,
    venue_type, spot_type, website, lat, lng,
    vibes, is_event_venue, active
) VALUES (
    'Sope Creek Trail', 'sope-creek-trail',
    '3726 Paper Mill Rd SE', 'Marietta', 'GA', '30067', 'East Cobb',
    'trail', 'outdoors', 'https://www.nps.gov/chat/planyourvisit/sope-creek.htm',
    33.9378, -84.4428,
    ARRAY['outdoors', 'hiking', 'nature', 'historic'], false, true
) ON CONFLICT (slug) DO UPDATE SET
    venue_type = EXCLUDED.venue_type, spot_type = EXCLUDED.spot_type;

-- Fernbank Forest (distinct from Fernbank Museum)
INSERT INTO venues (
    name, slug, address, city, state, zip, neighborhood,
    venue_type, spot_type, website, lat, lng,
    vibes, is_event_venue, active
) VALUES (
    'Fernbank Forest', 'fernbank-forest',
    '767 Clifton Rd NE', 'Atlanta', 'GA', '30307', 'Druid Hills',
    'park', 'outdoors', 'https://www.fernbankmuseum.org/explore/fernbank-forest/',
    33.7740, -84.3280,
    ARRAY['outdoors', 'nature', 'family-friendly', 'educational'], false, true
) ON CONFLICT (slug) DO UPDATE SET
    venue_type = EXCLUDED.venue_type, spot_type = EXCLUDED.spot_type;

-- Monastery of the Holy Spirit
INSERT INTO venues (
    name, slug, address, city, state, zip, neighborhood,
    venue_type, spot_type, website, lat, lng,
    vibes, is_event_venue, active
) VALUES (
    'Monastery of the Holy Spirit', 'monastery-of-the-holy-spirit',
    '2625 Highway 212 SW', 'Conyers', 'GA', '30094', 'Conyers',
    'landmark', 'outdoors', 'https://www.trappist.net',
    33.5560, -84.0230,
    ARRAY['historic', 'nature', 'peaceful', 'spiritual'], false, true
) ON CONFLICT (slug) DO UPDATE SET
    venue_type = EXCLUDED.venue_type, spot_type = EXCLUDED.spot_type;

-- Painted Pickle
INSERT INTO venues (
    name, slug, address, city, state, zip, neighborhood,
    venue_type, spot_type, website, lat, lng,
    vibes, is_event_venue, active
) VALUES (
    'Painted Pickle', 'painted-pickle',
    '279 Ottley Dr NE', 'Atlanta', 'GA', '30324', 'Armour/Ottley',
    'entertainment', 'bar', 'https://www.thepaintedpickle.com',
    33.8114, -84.3782,
    ARRAY['games', 'social', 'date-night', 'group-hangout'], false, true
) ON CONFLICT (slug) DO UPDATE SET
    venue_type = EXCLUDED.venue_type, spot_type = EXCLUDED.spot_type;

-- 3. Auto-populate is_experience from venue_type (retypes above now included)
UPDATE venues SET is_experience = true
WHERE venue_type IN (
  -- Outdoors
  'park', 'trail', 'garden', 'zoo', 'aquarium',
  -- Sightseeing
  'landmark', 'public_art', 'viewpoint', 'historic_site', 'skyscraper',
  -- Cultural
  'museum', 'gallery',
  -- Recreation
  'attraction', 'arcade', 'eatertainment', 'bowling', 'pool_hall',
  'entertainment',
  -- Markets
  'farmers_market', 'food_hall'
) AND active IS NOT false;

-- 4. Set reasonable duration defaults
UPDATE venues SET typical_duration_minutes = CASE
  WHEN venue_type IN ('park', 'trail', 'garden') THEN 90
  WHEN venue_type IN ('zoo', 'aquarium', 'museum', 'attraction') THEN 120
  WHEN venue_type IN ('gallery', 'public_art', 'viewpoint', 'landmark', 'historic_site', 'skyscraper') THEN 45
  WHEN venue_type IN ('arcade', 'eatertainment', 'bowling', 'pool_hall', 'entertainment') THEN 90
  WHEN venue_type IN ('farmers_market', 'food_hall') THEN 60
  ELSE 60
END
WHERE is_experience = true;

-- 5. Partial index for experience lookups
CREATE INDEX IF NOT EXISTS idx_venues_experience ON venues (is_experience) WHERE is_experience = true;
