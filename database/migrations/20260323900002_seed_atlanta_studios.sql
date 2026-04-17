-- Seed studio fields on existing venues + insert new studio venues.
-- Research-based: actual Atlanta studios/workspaces as of March 2026.

-- ============================================================
-- Update existing venues with studio fields
-- ============================================================

-- Goat Farm Arts Center — 1,200+ person waitlist, Atlanta's most prominent studio complex
UPDATE venues SET
  studio_type = 'shared',
  availability_status = 'waitlist',
  monthly_rate_range = '$400-$800',
  studio_application_url = 'https://www.thegoatfarm.com/studios'
WHERE slug = 'goat-farm-arts-center' AND studio_type IS NULL;

-- Atlanta Contemporary — studio artist program, 13 spots
UPDATE venues SET
  studio_type = 'residency',
  availability_status = 'application_only',
  studio_application_url = 'https://atlantacontemporary.org/studio-artist-program'
WHERE slug = 'atlanta-contemporary' AND studio_type IS NULL;

-- Callanwolde Fine Arts Center — studio classes and workspace
UPDATE venues SET
  studio_type = 'shared',
  availability_status = 'open',
  monthly_rate_range = '$200-$500',
  studio_application_url = 'https://callanwolde.org/studios'
WHERE slug = 'callanwolde-fine-arts-center' AND studio_type IS NULL;

-- Spruill Center for the Arts — studio rentals + classes
UPDATE venues SET
  studio_type = 'shared',
  availability_status = 'open',
  monthly_rate_range = '$250-$450',
  studio_application_url = 'https://spruillarts.org/studio-rentals'
WHERE slug = 'spruill-center-for-the-arts' AND studio_type IS NULL;

-- Mudfire Clayworks — ceramics makerspace
UPDATE venues SET
  studio_type = 'makerspace',
  availability_status = 'open',
  monthly_rate_range = '$175-$300',
  studio_application_url = 'https://www.mudfire.com/memberships'
WHERE slug = 'mudfire-clayworks' AND studio_type IS NULL;

-- Chastain Arts Center — city-run studio space
UPDATE venues SET
  studio_type = 'shared',
  availability_status = 'open',
  monthly_rate_range = '$100-$250'
WHERE slug = 'chastain-arts-center' AND studio_type IS NULL;

-- Atlanta Printmakers Studio
UPDATE venues SET
  studio_type = 'makerspace',
  availability_status = 'open',
  monthly_rate_range = '$150-$300',
  studio_application_url = 'https://www.atlantaprintmakersstudio.org/membership'
WHERE slug = 'atlanta-printmakers-studio' AND studio_type IS NULL;

-- ============================================================
-- Insert new studio venues that may not exist yet
-- ============================================================

-- TILA Studios — artist studios in Westside
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, vibes, studio_type, availability_status, monthly_rate_range)
SELECT 'TILA Studios', 'tila-studios', '1021 Howell Mill Rd NW', 'West Midtown', 'Atlanta', 'GA', '30318',
  33.7806, -84.4131, 'studio', 'studio', 'https://www.tilastudios.com',
  'Multi-discipline artist studios in West Midtown offering private and shared studio spaces for visual artists.',
  ARRAY['studio', 'visual-art', 'creative-space', 'west-midtown'],
  'private', 'waitlist', '$400-$700'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'tila-studios');

-- Dashboard Co-op — artist-run cooperative
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, vibes, studio_type, availability_status)
SELECT 'Dashboard Co-op', 'dashboard-co-op', '514 Lambert Dr NE', 'Reynoldstown', 'Atlanta', 'GA', '30306',
  33.7455, -84.3496, 'studio', 'studio', 'https://www.dashboardcoop.org',
  'Artist-run cooperative studio and exhibition space in Reynoldstown. Member-operated with rotating exhibitions.',
  ARRAY['studio', 'coop', 'gallery', 'diy', 'community'],
  'coop', 'application_only'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'dashboard-co-op');

-- Guardian Studios
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, vibes, studio_type, availability_status, monthly_rate_range)
SELECT 'Guardian Studios', 'guardian-studios', '87 Broad St NW', 'South Downtown', 'Atlanta', 'GA', '30303',
  33.7507, -84.3926, 'studio', 'studio', NULL,
  'Artist studios in South Downtown Atlanta. Affordable private studios in a converted warehouse space.',
  ARRAY['studio', 'visual-art', 'affordable', 'warehouse'],
  'private', 'waitlist', '$300-$600'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'guardian-studios');

-- Creatives Project
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, vibes, studio_type, availability_status, monthly_rate_range)
SELECT 'Creatives Project', 'creatives-project', '965 Joseph E Lowery Blvd NW', 'Bankhead', 'Atlanta', 'GA', '30318',
  33.7694, -84.4284, 'studio', 'studio', NULL,
  'Shared creative workspace and studios in Bankhead. Offers affordable studio rentals for emerging artists.',
  ARRAY['studio', 'creative-space', 'affordable', 'emerging-artists'],
  'shared', 'open', '$200-$450'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'creatives-project');

-- Atlanta Clay Works
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, vibes, studio_type, availability_status, monthly_rate_range)
SELECT 'Atlanta Clay Works', 'atlanta-clay-works', '1190 Foster St NW', 'West Midtown', 'Atlanta', 'GA', '30318',
  33.7837, -84.4157, 'studio', 'studio', NULL,
  'Community ceramics studio offering classes, memberships, and kiln access for potters and ceramic artists.',
  ARRAY['ceramics', 'pottery', 'makerspace', 'classes', 'community'],
  'makerspace', 'open', '$150-$275'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'atlanta-clay-works');

-- The Bakery Atlanta — arts incubator
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, vibes, studio_type, availability_status)
SELECT 'The Bakery Atlanta', 'the-bakery-atlanta', '868 Joseph E Lowery Blvd NW', 'English Avenue', 'Atlanta', 'GA', '30318',
  33.7682, -84.4273, 'studio', 'studio', 'https://thebakeryatlanta.com',
  'Arts incubator and cultural center in English Avenue. Provides affordable studio space, exhibitions, and community programming.',
  ARRAY['studio', 'incubator', 'gallery', 'community', 'diy'],
  'shared', 'application_only'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'the-bakery-atlanta');

-- Wonderroot — community arts center
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, vibes, studio_type, availability_status, monthly_rate_range)
SELECT 'Wonderroot', 'wonderroot', '982 Memorial Dr SE', 'Grant Park', 'Atlanta', 'GA', '30316',
  33.7400, -84.3677, 'studio', 'studio', 'https://wonderroot.org',
  'Community arts center offering subsidized studio space, darkroom access, and arts programming. Focus on equitable access to creative resources.',
  ARRAY['studio', 'community', 'nonprofit', 'darkroom', 'affordable'],
  'shared', 'application_only', '$100-$300'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'wonderroot');

-- Notch8 Gallery & Studios
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, vibes, studio_type, availability_status, monthly_rate_range)
SELECT 'Notch8 Gallery & Studios', 'notch8-gallery-studios', '437 Memorial Dr SE', 'Grant Park', 'Atlanta', 'GA', '30312',
  33.7432, -84.3790, 'studio', 'studio', NULL,
  'Gallery and artist studios on Memorial Drive. Features rotating exhibitions and private studio rentals.',
  ARRAY['studio', 'gallery', 'visual-art', 'grant-park'],
  'private', 'open', '$350-$550'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE slug = 'notch8-gallery-studios');
