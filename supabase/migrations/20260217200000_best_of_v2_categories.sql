-- ============================================================================
-- Best Of V2: Replace generic listicle categories with oddly specific ones
-- ============================================================================

-- Clean slate — no real user data yet, safe to wipe
DELETE FROM best_of_case_upvotes;
DELETE FROM best_of_cases;
DELETE FROM best_of_votes;
DELETE FROM best_of_nominations;
DELETE FROM best_of_categories;

-- ============================================================================
-- 10 new categories
-- ============================================================================
INSERT INTO best_of_categories (slug, name, description, icon, portal_id, sort_order) VALUES
  ('where-you-end-up-at-1am',   'Where You End Up at 1am',        'Where the paths converge',   'moon',      (SELECT id FROM portals WHERE slug = 'atlanta'), 1),
  ('medium-effort-first-date',   'Medium Effort First Date',       'Goldilocksing between the tryhards and showing up in your sweats', 'heart', (SELECT id FROM portals WHERE slug = 'atlanta'), 2),
  ('cool-patio',                 'Cool Patio',                     'People watching, getting that fresh city air. It''s the life', 'sun', (SELECT id FROM portals WHERE slug = 'atlanta'), 3),
  ('place-to-hear-a-band',      'Place to Hear a Band',           'Even the trashy ones sound great here', 'music', (SELECT id FROM portals WHERE slug = 'atlanta'), 4),
  ('underrated-kitchen',         'Underrated Kitchen',             'Wouldn''t think it but they got sneaky good food', 'utensils', (SELECT id FROM portals WHERE slug = 'atlanta'), 5),
  ('the-cheers-bar',             'The Cheers Bar',                 'Old friends who just met. Nobody''s a stranger', 'beer', (SELECT id FROM portals WHERE slug = 'atlanta'), 6),
  ('out-of-towner-converter',    'The Out-of-Towner Converter',    'Where to take your too-cool out-of-town friend to get them to shut up. We get it Henry, you moved to Seattle, whoop de doo', 'sparkles', (SELECT id FROM portals WHERE slug = 'atlanta'), 7),
  ('third-place',                'Third Place',                    'Not home, not work, but somehow more you than both', 'coffee', (SELECT id FROM portals WHERE slug = 'atlanta'), 8),
  ('where-you-find-local-art',   'Where You Find Local Art',       'The stuff that''s never ending up at Target', 'palette', (SELECT id FROM portals WHERE slug = 'atlanta'), 9),
  ('in-this-economy',             'In This Economy',                'Where to go and not spend money', 'gift', (SELECT id FROM portals WHERE slug = 'atlanta'), 10)
ON CONFLICT (slug, portal_id) DO NOTHING;

-- ============================================================================
-- Curated nominations: 6-8 per category
-- ============================================================================

-- 1. Where You End Up at 1am
INSERT INTO best_of_nominations (category_id, venue_id, status)
SELECT c.id, v.id, 'approved'
FROM best_of_categories c, venues v
WHERE c.slug = 'where-you-end-up-at-1am'
  AND (
    v.name IN ('MJQ Concourse', 'Star Community Bar', 'Drunken Unicorn', 'Jungle Atlanta', 'Church')
    OR v.name ILIKE 'Sister Louisa%'
    OR v.name ILIKE '%Clermont Lounge%'
    OR v.name ILIKE '%Majestic Diner%'
  )
ON CONFLICT (category_id, venue_id) DO NOTHING;

-- 2. Medium Effort First Date
INSERT INTO best_of_nominations (category_id, venue_id, status)
SELECT c.id, v.id, 'approved'
FROM best_of_categories c, venues v
WHERE c.slug = 'medium-effort-first-date'
  AND (
    v.name IN ('Ormsby''s', 'Barcelona Wine Bar', 'Park Tavern', 'Venkman''s', 'City Winery Atlanta', 'Gypsy Kitchen', 'The Sound Table')
    OR v.name ILIKE '%Brick Store Pub%'
  )
ON CONFLICT (category_id, venue_id) DO NOTHING;

-- 3. Cool Patio
INSERT INTO best_of_nominations (category_id, venue_id, status)
SELECT c.id, v.id, 'approved'
FROM best_of_categories c, venues v
WHERE c.slug = 'cool-patio'
  AND (
    v.name IN ('Orpheus Brewing', 'Monday Night Brewing', 'Wild Heaven Beer', 'New Realm Brewing', 'Eventide Brewing', 'Park Tavern', 'Pontoon Brewing')
    OR v.name ILIKE '%SweetWater%'
  )
ON CONFLICT (category_id, venue_id) DO NOTHING;

-- 4. Place to Hear a Band
INSERT INTO best_of_nominations (category_id, venue_id, status)
SELECT c.id, v.id, 'approved'
FROM best_of_categories c, venues v
WHERE c.slug = 'place-to-hear-a-band'
  AND (
    v.name IN ('Terminal West', 'Variety Playhouse', 'Eddie''s Attic', 'Smith''s Olde Bar', 'Aisle 5', 'The Eastern')
    OR v.name ILIKE '%Tabernacle%'
    OR v.name ILIKE '%Masquerade%'
  )
ON CONFLICT (category_id, venue_id) DO NOTHING;

-- 5. Underrated Kitchen
INSERT INTO best_of_nominations (category_id, venue_id, status)
SELECT c.id, v.id, 'approved'
FROM best_of_categories c, venues v
WHERE c.slug = 'underrated-kitchen'
  AND (
    v.name IN ('The Porter Beer Bar', 'Ormsby''s', 'Halfway Crooks', 'Venkman''s', 'The Sound Table')
    OR v.name ILIKE '%Brick Store Pub%'
    OR v.name ILIKE '%Bold Monk%'
    OR v.name ILIKE '%Wrecking Bar%'
  )
ON CONFLICT (category_id, venue_id) DO NOTHING;

-- 6. The Cheers Bar
INSERT INTO best_of_nominations (category_id, venue_id, status)
SELECT c.id, v.id, 'approved'
FROM best_of_categories c, venues v
WHERE c.slug = 'the-cheers-bar'
  AND (
    v.name IN ('Blind Willie''s', 'The Porter Beer Bar', 'Friends on Ponce', 'Bookhouse Pub', 'Mary''s')
    OR v.name ILIKE '%Brick Store Pub%'
    OR v.name ILIKE '%Atkins Park%'
    OR v.name ILIKE '%Manuel''s Tavern%'
  )
ON CONFLICT (category_id, venue_id) DO NOTHING;

-- 7. The Out-of-Towner Converter
INSERT INTO best_of_nominations (category_id, venue_id, status)
SELECT c.id, v.id, 'approved'
FROM best_of_categories c, venues v
WHERE c.slug = 'out-of-towner-converter'
  AND (
    v.name IN ('Fox Theatre', 'Ponce City Market', 'Krog Street Market')
    OR v.name ILIKE '%Atlanta Botanical%'
    OR v.name ILIKE '%High Museum%'
    OR v.name ILIKE '%Tabernacle%'
    OR v.name ILIKE '%Piedmont Park%'
    OR v.name ILIKE '%Atlanta BeltLine%'
  )
ON CONFLICT (category_id, venue_id) DO NOTHING;

-- 8. Third Place
INSERT INTO best_of_nominations (category_id, venue_id, status)
SELECT c.id, v.id, 'approved'
FROM best_of_categories c, venues v
WHERE c.slug = 'third-place'
  AND (
    v.name IN ('Criminal Records', 'Charis Books', 'Switchyards', 'Bookhouse Pub')
    OR v.name ILIKE '%A Cappella Books%'
    OR v.name ILIKE '%Little Shop of Stories%'
    OR v.name ILIKE '%Hodgepodge%'
    OR v.name ILIKE '%Dancing Goats%'
  )
ON CONFLICT (category_id, venue_id) DO NOTHING;

-- 9. Where You Find Local Art
INSERT INTO best_of_nominations (category_id, venue_id, status)
SELECT c.id, v.id, 'approved'
FROM best_of_categories c, venues v
WHERE c.slug = 'where-you-find-local-art'
  AND (
    v.name IN ('Atlanta Contemporary', 'Eyedrum', 'Whitespace Gallery', 'Sandler Hudson Gallery')
    OR v.name ILIKE '%MOCA GA%'
    OR v.name ILIKE '%Goat Farm%'
    OR v.name ILIKE '%Hammonds House%'
    OR v.name ILIKE '%Callanwolde%'
  )
ON CONFLICT (category_id, venue_id) DO NOTHING;

-- 10. Best Free Thing to Do
INSERT INTO best_of_nominations (category_id, venue_id, status)
SELECT c.id, v.id, 'approved'
FROM best_of_categories c, venues v
WHERE c.slug = 'in-this-economy'
  AND (
    v.name IN ('Piedmont Park', 'Oakland Cemetery', 'Sweet Auburn Market', 'Freedom Farmers Market')
    OR v.name ILIKE '%Atlanta BeltLine%'
    OR v.name ILIKE '%Grant Park%'
    OR v.name ILIKE '%Krog Street Market%'
    OR v.name ILIKE '%Castleberry%'
  )
ON CONFLICT (category_id, venue_id) DO NOTHING;
