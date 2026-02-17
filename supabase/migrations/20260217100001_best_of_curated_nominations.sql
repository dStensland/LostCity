-- ============================================================================
-- Best Of: Curated Venue Nominations
-- Seeds ~8 hand-picked contenders per category from real Atlanta venues
-- ============================================================================

-- Helper: insert nomination by venue name + category slug
-- Uses ILIKE for fuzzy matching, ON CONFLICT to skip dupes

-- ============================================================================
-- best-dive-bar
-- ============================================================================
INSERT INTO best_of_nominations (category_id, venue_id, status)
SELECT c.id, v.id, 'approved'
FROM best_of_categories c, venues v
WHERE c.slug = 'best-dive-bar'
  AND v.name IN (
    'Star Community Bar',
    'Blind Willie''s',
    'The Porter Beer Bar',
    'Brake Pad',
    'Friends on Ponce',
    'Drunken Unicorn',
    'MJQ Concourse',
    'Bookhouse Pub'
  )
  AND v.city = 'Atlanta'
ON CONFLICT (category_id, venue_id) DO NOTHING;

-- ============================================================================
-- best-brunch
-- ============================================================================
INSERT INTO best_of_nominations (category_id, venue_id, status)
SELECT c.id, v.id, 'approved'
FROM best_of_categories c, venues v
WHERE c.slug = 'best-brunch'
  AND v.name IN (
    'Venkman''s',
    'Park Tavern',
    'Gypsy Kitchen',
    'City Winery Atlanta',
    'Le Colonial Atlanta',
    'Barcelona Wine Bar',
    'Sun Dial Restaurant',
    'Sweet Auburn Market'
  )
ON CONFLICT (category_id, venue_id) DO NOTHING;

-- ============================================================================
-- best-date-night
-- ============================================================================
INSERT INTO best_of_nominations (category_id, venue_id, status)
SELECT c.id, v.id, 'approved'
FROM best_of_categories c, venues v
WHERE c.slug = 'best-date-night'
  AND v.name IN (
    'Le Colonial Atlanta',
    'Domaine Atlanta',
    'City Winery Atlanta',
    'Sun Dial Restaurant',
    'Barcelona Wine Bar',
    'Hotel Clermont',
    'Kat''s Cafe',
    'The Sound Table'
  )
ON CONFLICT (category_id, venue_id) DO NOTHING;

-- ============================================================================
-- best-rooftop
-- ============================================================================
INSERT INTO best_of_nominations (category_id, venue_id, status)
SELECT c.id, v.id, 'approved'
FROM best_of_categories c, venues v
WHERE c.slug = 'best-rooftop'
  AND v.name IN (
    'Spaceman',
    'Sun Dial Restaurant',
    'Ponce City Market',
    'New Realm Brewing',
    'Orpheus Brewing',
    'Hotel Clermont',
    'Nine Mile Station',
    'Park Tavern'
  )
ON CONFLICT (category_id, venue_id) DO NOTHING;

-- ============================================================================
-- best-live-music
-- ============================================================================
INSERT INTO best_of_nominations (category_id, venue_id, status)
SELECT c.id, v.id, 'approved'
FROM best_of_categories c, venues v
WHERE c.slug = 'best-live-music'
  AND v.name IN (
    'The Tabernacle',
    'Terminal West',
    'Eddie''s Attic',
    'Variety Playhouse',
    'The Masquerade',
    'The Eastern',
    'Smith''s Olde Bar',
    'Aisle 5'
  )
ON CONFLICT (category_id, venue_id) DO NOTHING;

-- ============================================================================
-- best-patio
-- ============================================================================
INSERT INTO best_of_nominations (category_id, venue_id, status)
SELECT c.id, v.id, 'approved'
FROM best_of_categories c, venues v
WHERE c.slug = 'best-patio'
  AND v.name IN (
    'Monday Night Brewing',
    'Orpheus Brewing',
    'SweetWater Brewing Company',
    'Wild Heaven Beer',
    'Eventide Brewing',
    'Ormsby''s',
    'Park Tavern',
    'New Realm Brewing'
  )
ON CONFLICT (category_id, venue_id) DO NOTHING;

-- ============================================================================
-- best-happy-hour
-- ============================================================================
INSERT INTO best_of_nominations (category_id, venue_id, status)
SELECT c.id, v.id, 'approved'
FROM best_of_categories c, venues v
WHERE c.slug = 'best-happy-hour'
  AND v.name IN (
    'Brick Store Pub',
    'Fado Irish Pub',
    'Scofflaw Brewing Co.',
    'Bold Monk Brewing Co.',
    'Boggs Social & Supply',
    'Second Self Beer Co.',
    'Halfway Crooks Beer',
    'Monday Night Brewing'
  )
ON CONFLICT (category_id, venue_id) DO NOTHING;

-- ============================================================================
-- best-late-night
-- ============================================================================
INSERT INTO best_of_nominations (category_id, venue_id, status)
SELECT c.id, v.id, 'approved'
FROM best_of_categories c, venues v
WHERE c.slug = 'best-late-night'
  AND v.name IN (
    'Opera Nightclub',
    'Compound Atlanta',
    'MJQ Concourse',
    'Gold Room',
    'Club Wander',
    'Jungle Atlanta',
    'Tongue and Groove',
    'District Atlanta'
  )
ON CONFLICT (category_id, venue_id) DO NOTHING;

-- ============================================================================
-- best-hidden-gem
-- ============================================================================
INSERT INTO best_of_nominations (category_id, venue_id, status)
SELECT c.id, v.id, 'approved'
FROM best_of_categories c, venues v
WHERE c.slug = 'best-hidden-gem'
  AND v.name IN (
    'Sister Louisa''s Church of the Living Room & Ping Pong Emporium',
    'Goat Farm Arts Center',
    'Eyedrum Art & Music Gallery',
    'Red Light Cafe',
    'PushPush Arts',
    'Wax n Facts',
    'The Bakery',
    'Bookhouse Pub'
  )
ON CONFLICT (category_id, venue_id) DO NOTHING;

-- Fallback: some hidden gem venues may have shorter names in DB
INSERT INTO best_of_nominations (category_id, venue_id, status)
SELECT c.id, v.id, 'approved'
FROM best_of_categories c, venues v
WHERE c.slug = 'best-hidden-gem'
  AND (
    v.name ILIKE 'Sister Louisa%'
    OR v.name ILIKE 'Goat Farm%'
    OR v.name ILIKE 'Eyedrum%'
    OR v.name ILIKE 'PushPush%'
  )
ON CONFLICT (category_id, venue_id) DO NOTHING;

-- ============================================================================
-- best-new-spot
-- ============================================================================
INSERT INTO best_of_nominations (category_id, venue_id, status)
SELECT c.id, v.id, 'approved'
FROM best_of_categories c, venues v
WHERE c.slug = 'best-new-spot'
  AND v.name IN (
    'Boggs Social & Supply',
    'Lore Atlanta',
    'The Bakery',
    'District Atlanta',
    'Lyfe Atlanta',
    'Ravine Atlanta',
    'Puttshack Atlanta',
    'Common Courtesy'
  )
ON CONFLICT (category_id, venue_id) DO NOTHING;
